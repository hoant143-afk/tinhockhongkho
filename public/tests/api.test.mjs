import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/chat.js';

const realFetch = global.fetch;
const oldKey = process.env.GEMINI_API_KEY;
const oldModel = process.env.GEMINI_MODEL;
after(() => {
  global.fetch = realFetch;
  if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
  if (oldModel === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = oldModel;
});

function run(body, ip = 'test-ip', method = 'POST') {
  return new Promise(async (resolve, reject) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      end(value = '') { try { resolve({ status: this.statusCode, headers: this.headers, data: JSON.parse(value) }); } catch { resolve({ status: this.statusCode, raw: value }); } }
    };
    const req = { method, body, headers: { 'x-forwarded-for': ip }, socket: { remoteAddress: ip } };
    try { await handler(req, res); } catch (error) { reject(error); }
  });
}
function mockResponse(message, advance = true, kind = 'question') {
  global.fetch = async (url, opts) => {
    assert.equal(opts.method, 'POST');
    assert.equal(opts.headers['x-goog-api-key'], 'mock-secret');
    assert.match(url, /gemini-3\.5-flash-lite:generateContent/);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ message, advance, kind }) }] } }] }), { status: 200 });
  };
}

test('Không có API key trả về thông báo cấu hình rõ ràng', async () => {
  delete process.env.GEMINI_API_KEY;
  const r = await run({ message: 'xin chào' });
  assert.equal(r.status, 503);
  assert.match(r.data.error, /GEMINI_API_KEY/);
});

test('Không cho phép phương thức GET', async () => {
  const r = await run({}, 'other-ip', 'GET');
  assert.equal(r.status, 405);
});

test('Câu 1/2 luôn chuyển sang bước 1', async () => {
  process.env.GEMINI_API_KEY = 'mock-secret';
  process.env.GEMINI_MODEL = 'gemini-3.5-flash-lite';
  mockResponse('Câu 1/2: Phép chia lấy dư viết thế nào?');
  const r = await run({ message: 'Viết chương trình tìm số chẵn', step: 0, hints: 0 }, 'ip1');
  assert.equal(r.status, 200);
  assert.equal(r.data.step, 1);
  assert.match(r.data.reply, /Câu 1\/2/);
});

test('Học sinh chưa biết thì ở lại cùng câu, tăng số lần gợi ý', async () => {
  process.env.GEMINI_API_KEY = 'mock-secret';
  mockResponse('Em thử nhớ toán tử chia lấy dư nhé?', false, 'hint');
  const r = await run({ message: 'Em chưa biết', step: 1, hints: 0 }, 'ip2');
  assert.equal(r.status, 200);
  assert.equal(r.data.step, 1);
  assert.equal(r.data.hints, 1);
  assert.equal(r.data.kind, 'hint');
});

test('Đáp đúng câu 2/2 nhận lời giải và kết thúc phần gợi mở', async () => {
  process.env.GEMINI_API_KEY = 'mock-secret';
  mockResponse('Ý tưởng: ...\n```python\nprint(2)\n```', true, 'solution');
  const r = await run({ message: 'n % 2 == 0', step: 2, hints: 0 }, 'ip3');
  assert.equal(r.status, 200);
  assert.equal(r.data.step, 3);
  assert.equal(r.data.kind, 'solution');
});

test('Tệp ảnh có MIME không hỗ trợ bị từ chối', async () => {
  process.env.GEMINI_API_KEY = 'mock-secret';
  const r = await run({ message: 'xem ảnh', image: { mime: 'image/svg+xml', data: 'eA==' } }, 'ip4');
  assert.equal(r.status, 400);
});

test('Yêu cầu không có tin nhắn bị từ chối', async () => {
  process.env.GEMINI_API_KEY = 'mock-secret';
  const r = await run({ message: '' }, 'ip5');
  assert.equal(r.status, 400);
});

test('Chế độ lý thuyết trả lời trực tiếp', async () => {
  process.env.GEMINI_API_KEY = 'mock-secret';
  mockResponse('Biến dùng để lưu giá trị.', true, 'direct');
  const r = await run({ message: 'Biến là gì?', mode: 'explain', step: 0 }, 'ip6');
  assert.equal(r.status, 200);
  assert.equal(r.data.step, 3);
  assert.equal(r.data.kind, 'direct');
});
