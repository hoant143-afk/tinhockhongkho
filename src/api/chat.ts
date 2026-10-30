import { Request, Response } from 'express';

const MAX_MESSAGE = 18000;
const MAX_HISTORY = 18;
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BASE_INSTRUCTION = "Bạn là gia sư Python tận tâm. Phong cách của bạn: gợi mở, thân thiện, không trực tiếp đưa đáp án. Hãy giúp học sinh tự tìm ra giải pháp.";

// Dummy rate limiter for now
const hits = new Map();
const ONE_MIN = 60000;
function checkRate(req: Request): boolean {
  const ip = String(req.header('x-forwarded-for') || req.socket?.remoteAddress || 'unknown').split(',')[0].trim().slice(0, 100);
  const now = Date.now();
  const limit = 120;
  if (hits.size > 600) for (const [k, v] of hits) if (v.until < now) hits.delete(k);
  const hit = hits.get(ip);
  if (!hit || hit.until < now) { hits.set(ip, { count: 1, until: now + ONE_MIN }); return true; }
  if (hit.count >= limit) return false;
  hit.count += 1;
  return true;
}

function getConfig(step: number, hints: number, mode: string) {
  if (mode === 'explain') return { instruction: 'Đây là yêu cầu GIẢI THÍCH LÝ THUYẾT. Trả lời trực tiếp, đơn giản, có ví dụ nhỏ nếu cần, không bắt buộc hỏi gợi mở. kind=direct, advance=true.', next: 3 };
  if (step >= 3) return { instruction: 'Đang ở phần TRAO ĐỔI SAU LỜI GIẢI. Trả lời câu hỏi tiếp theo một cách hỗ trợ và rõ ràng, không cần lặp lại quy trình 2 câu. kind=direct, advance=true.', next: 3 };
  if (step === 0) return { instruction: 'GIAI ĐOẠN 1: Chỉ hỏi CÂU 1/2 về cách hiểu đề hoặc kiến thức cần dùng. Chưa đưa code, công thức đáp án hoàn chỉnh. kind=question, advance=true.', next: 1 };
  if (step === 1) {
    if (hints >= 2) return { instruction: 'GIAI ĐOẠN 2: Bạn đã gợi ý 2 lần. Giải thích ngắn đáp án câu 1, sau đó hỏi đúng 1 CÂU 2/2 về bước giải tiếp theo. Không đưa code hoàn chỉnh. kind=question, advance=true.', next: 2 };
    return { instruction: 'Đánh giá câu trả lời của em cho CÂU 1/2 ở tin nhắn cuối. Nếu đúng hoặc gần đúng, xác nhận ngắn gọn và hỏi đúng 1 CÂU 2/2 khác (kind=question, advance=true). Nếu chưa đúng/chưa biết, chỉ gợi ý nhỏ và hỏi lại 1 câu để thử lại (kind=hint, advance=false). Tuyệt đối chưa đưa code hoàn chỉnh.', next: 2 };
  }
  if (hints >= 2) return { instruction: 'Bạn đã gợi ý 2 lần. Giải thích ngắn câu 2, sau đó trình bày lời giải đầy đủ theo cấu trúc ý tưởng, code Python, 2 test, 1 thử thách. kind=solution, advance=true.', next: 3 };
  return { instruction: 'Đánh giá câu trả lời cho CÂU 2/2 ở tin nhắn cuối. Nếu đúng hoặc gần đúng: kết thúc gợi mở, đưa ý tưởng, code Python đúng, đúng 2 test và 1 thử thách (kind=solution, advance=true). Nếu chưa đúng/chưa biết: chỉ gợi ý nhỏ, hỏi lại một câu và KHÔNG đưa code (kind=hint, advance=false).', next: 3 };
}

function cleanHistory(value: any) {
  if (!Array.isArray(value)) return [];
  return value.slice(-MAX_HISTORY)
    .filter((x: any) => x && (x.role === 'user' || x.role === 'model') && typeof x.text === 'string')
    .map((x: any) => ({ role: x.role, parts: [{ text: x.text.slice(0, MAX_MESSAGE) }] }));
}

export async function chatHandler(req: Request, res: Response) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Chỉ hỗ trợ POST.' }); }
  const configuredKey = process.env.GEMINI_API_KEY;
  if (!configuredKey) return res.status(503).json({ error: 'Chatbot chưa được kết nối Gemini API.' });
  
  if (!checkRate(req)) return res.status(429).json({ error: 'Quá nhiều yêu cầu.' });
  
  const body = req.body;
  const message = body && typeof body.message === 'string' ? body.message.trim() : '';
  const mode = body?.mode === 'explain' ? 'explain' : 'coach';
  const step = Number.isInteger(body?.step) ? Math.max(0, Math.min(3, body.step)) : 0;
  const hints = Number.isInteger(body?.hints) ? Math.max(0, Math.min(3, body.hints)) : 0;
  const image = body?.image;
  
  if (!message || message.length > MAX_MESSAGE) return res.status(400).json({ error: 'Hãy nhập câu hỏi.' });
  
  const phase = getConfig(step, hints, mode);
  const contents = cleanHistory(body?.history);
  const latestParts: any[] = [{ text: message }];
  if (image) latestParts.push({ inline_data: { mime_type: image.mime, data: image.data } });
  contents.push({ role: 'user', parts: latestParts });
  
  const apiModel = (process.env.GEMINI_MODEL || 'gemini-1.5-flash').trim();
  
  const requestBody = {
    systemInstruction: { parts: [{ text: BASE_INSTRUCTION + '\nQUY TẮC GIAI ĐOẠN HIỆN TẠI (ƯU TIÊN CAO NHẤT): ' + phase.instruction }] },
    contents,
    generationConfig: { responseMimeType: 'application/json', temperature: 0.35, maxOutputTokens: 1700 }
  };
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta1/models/${apiModel}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': configuredKey },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('API Error Details:', {
        status: response.status,
        url: `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent`,
        errorData,
        requestBody: JSON.stringify(requestBody)
      });
      throw new Error(`API Error: ${response.status}`);
    }
    const data = await response.json();
    const raw = (data?.candidates?.[0]?.content?.parts || []).map((x: any) => x.text || '').join('').trim();
    
    let parsed;
    try { parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
    catch { parsed = { message: raw, advance: true, kind: 'question' }; }
    
    let reply = String(parsed?.message || '').trim().slice(0, 9500);
    const advance = (step === 0 || mode === 'explain' || step === 3 || hints >= 2) ? true : parsed.advance === true;
    const nextStep = advance ? phase.next : step;
    const nextHints = !advance ? Math.min(hints + 1, 3) : 0;
    
    return res.status(200).json({ reply, step: nextStep, hints: nextHints });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: 'Lỗi API.' });
  }
}
