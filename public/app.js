const STORAGE_KEY = 'tinhockhongkho.python-tutor.v1';
const $ = (selector) => document.querySelector(selector);
const messageScroller = $('#message-scroller');
const messagesEl = $('#messages');
const input = $('#user-input');
const sendButton = $('#send-button');
const form = $('#chat-form');
const fileInput = $('#file-input');
const fileBar = $('#attachment-bar');
const fileName = $('#attachment-name');
const errorBanner = $('#error-banner');
const typing = $('#typing-indicator');
const phaseLabel = $('#phase-label');
const welcome = $('#welcome-content');
const confirmDialog = $('#confirm-dialog');

let state = loadState();
let attachment = null;
let sending = false;

function loadState() {
  const empty = { messages: [], mode: 'coach', step: 0, hints: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || !Array.isArray(saved.messages)) return empty;
    return {
      messages: saved.messages.slice(-36).filter(item => item && ['user', 'model'].includes(item.role) && typeof item.text === 'string')
        .map(item => ({ role: item.role, text: item.text.slice(0, 10000), time: item.time || '', attachmentName: item.attachmentName || '' })),
      mode: saved.mode === 'explain' ? 'explain' : 'coach',
      step: Math.min(3, Math.max(0, Number(saved.step) || 0)),
      hints: Math.min(3, Math.max(0, Number(saved.hints) || 0))
    };
  } catch { return empty; }
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, messages: state.messages.slice(-36) })); }
  catch { /* trình duyệt riêng tư hoặc bộ nhớ đầy, vẫn cho phép trò chuyện */ }
}
function showError(message) { errorBanner.textContent = message; errorBanner.hidden = false; }
function hideError() { errorBanner.textContent = ''; errorBanner.hidden = true; }
function updateUI() {
  welcome.hidden = state.messages.length > 0;
  welcome.style.display = state.messages.length > 0 ? 'none' : 'flex';
  document.querySelectorAll('.mode-btn').forEach(btn => {
    const active = btn.dataset.mode === state.mode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  phaseLabel.textContent = state.mode === 'explain' ? 'Giải thích trực tiếp' : ['Sẵn sàng học tập', 'Câu hỏi 1/2', 'Câu hỏi 2/2', 'Đã hoàn thành gợi mở'][state.step];
}
function scrollBottom() { requestAnimationFrame(() => { messageScroller.scrollTop = messageScroller.scrollHeight; }); }
function adjustHeight() {
  input.style.height = 'auto';
  input.style.height = Math.min(Math.max(input.scrollHeight, 54), 168) + 'px';
}
function make(type, className, text) {
  const el = document.createElement(type);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function appendInline(parent, source) {
  // Markdown tối giản nhưng an toàn: mọi nội dung AI đều qua textContent, không innerHTML.
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
  let start = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index > start) parent.append(document.createTextNode(source.slice(start, match.index)));
    const value = match[0];
    if (value.startsWith('`')) parent.append(make('code', '', value.slice(1, -1)));
    else if (value.startsWith('**')) parent.append(make('strong', '', value.slice(2, -2)));
    else parent.append(make('em', '', value.slice(1, -1)));
    start = match.index + value.length;
  }
  if (start < source.length) parent.append(document.createTextNode(source.slice(start)));
}
function appendTextBlock(container, block) {
  const lines = block.replace(/\r\n/g, '\n').split('\n');
  let currentList = null;
  let paragraph = [];
  function flushParagraph() {
    if (!paragraph.length) return;
    const el = make('p'); appendInline(el, paragraph.join('\n')); el.style.whiteSpace = 'pre-wrap'; container.append(el);
    paragraph = [];
  }
  for (const line of lines) {
    if (!line.trim()) { flushParagraph(); currentList = null; continue; }
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) { flushParagraph(); currentList = null; const h = make('h3'); appendInline(h, heading[1]); container.append(h); continue; }
    const list = line.match(/^\s*(?:([-*])|(\d+)\.)\s+(.+)$/);
    if (list) {
      flushParagraph();
      const listType = list[2] ? 'ol' : 'ul';
      if (!currentList || currentList.tagName.toLowerCase() !== listType) { currentList = make(listType); container.append(currentList); }
      const item = make('li'); appendInline(item, list[3]); currentList.append(item); continue;
    }
    currentList = null;
    paragraph.push(line);
  }
  flushParagraph();
}
function appendRichContent(container, text) {
  const chunks = String(text).split(/```([\w+-]*)\s*\n([\s\S]*?)```/g);
  for (let i = 0; i < chunks.length; i += 3) {
    if (chunks[i]) appendTextBlock(container, chunks[i]);
    if (i + 2 < chunks.length) {
      const frame = make('div', 'code-frame');
      const pre = make('pre');
      const code = make('code', '', chunks[i + 2].trimEnd());
      pre.append(code);
      const copy = make('button', 'code-copy', 'Sao chép');
      copy.type = 'button';
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(code.textContent); copy.textContent = 'Đã chép ✓'; setTimeout(() => { copy.textContent = 'Sao chép'; }, 1400); }
        catch { copy.textContent = 'Không thể sao chép'; }
      });
      frame.append(pre, copy); container.append(frame);
    }
  }
}
function renderMessage(entry) {
  const isUser = entry.role === 'user';
  const article = make('article', 'message ' + (isUser ? 'user' : 'bot'));
  if (!isUser) article.append(make('div', 'message-avatar', '✦'));
  const bubble = make('div', 'bubble');
  bubble.append(make('div', 'message-role', isUser ? 'Em' : 'Gia sư Python'));
  appendRichContent(bubble, entry.text);
  if (entry.attachmentName) bubble.append(make('span', 'message-attachment', '📎 ' + entry.attachmentName));
  if (entry.time) bubble.append(make('div', 'message-time', entry.time));
  article.append(bubble);
  return article;
}
function renderAll() {
  messagesEl.replaceChildren(...state.messages.map(renderMessage));
  updateUI(); scrollBottom();
}
function addMessage(role, text, attachmentName = '') {
  const item = { role, text, attachmentName, time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) };
  state.messages.push(item);
  state.messages = state.messages.slice(-36);
  messagesEl.append(renderMessage(item));
  updateUI(); saveState(); scrollBottom();
}
function setSending(value) {
  sending = value; typing.hidden = !value; sendButton.disabled = value; input.disabled = value;
  fileInput.disabled = value; $('#attach-button').disabled = value;
  document.querySelectorAll('.mode-btn').forEach(btn => { btn.disabled = value; });
  sendButton.querySelector('span').textContent = value ? 'Đang trả lời' : 'Gửi tin nhắn';
  scrollBottom();
}
function attachmentClear() { attachment = null; fileInput.value = ''; fileName.textContent = ''; fileBar.hidden = true; }
function setAttachment(value) { attachment = value; fileName.textContent = value.name; fileBar.hidden = false; hideError(); }
function readText(file) {
  return file.text().then(text => text.slice(0, 12000));
}
function readBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(new Error('Không thể đọc ảnh.'));
    reader.readAsDataURL(file);
  });
}
async function handleFile(file) {
  if (!file) return;
  const ext = file.name.split('.').pop()?.toLowerCase();
  const isImage = ['jpg','jpeg','png','webp'].includes(ext) && ['image/jpeg','image/png','image/webp'].includes(file.type);
  const isText = ['py','txt','md','json','csv'].includes(ext);
  if (!isImage && !isText) return showError('Chỉ nhận ảnh JPG/PNG/WEBP hoặc tệp code .py, .txt, .md, .json, .csv.');
  if (isImage && file.size > 2_000_000) return showError('Ảnh cần nhỏ hơn 2 MB. Hãy nén ảnh rồi thử lại.');
  if (isText && file.size > 120_000) return showError('Tệp code cần nhỏ hơn 120 KB. Hãy chọn tệp ngắn hơn.');
  try {
    if (isImage) setAttachment({ name: file.name, image: { mime: file.type, data: await readBase64(file) } });
    else setAttachment({ name: file.name, text: await readText(file) });
  } catch { showError('Không đọc được tệp này. Hãy thử lại hoặc dán nội dung vào khung chat.'); }
}
async function send() {
  if (sending) return;
  let text = input.value.trim();
  if (!text && !attachment) { input.focus(); return; }
  if (!text) text = attachment?.image ? 'Em gửi ảnh bài tập. Hãy đọc ảnh và hướng dẫn em từng bước.' : 'Em gửi tệp code. Hãy giúp em phân tích.';
  const fullText = attachment?.text ? `${text}\n\nNội dung tệp ${attachment.name}:\n\`\`\`python\n${attachment.text}\n\`\`\`` : text;
  if (fullText.length > 18000) return showError('Tổng nội dung vượt quá 18.000 ký tự. Hãy rút gọn câu hỏi hoặc tệp.');
  const body = {
    message: fullText,
    mode: state.mode,
    step: state.step,
    hints: state.hints,
    history: state.messages.slice(-18).map(entry => ({ role: entry.role, text: entry.text })),
    ...(attachment?.image ? { image: attachment.image } : {})
  };
  const attachmentName = attachment?.name || '';
  hideError();
  addMessage('user', fullText, attachmentName);
  setSending(true);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 42_000);
    let response;
    try { response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal }); }
    finally { clearTimeout(timeout); }
    let data;
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) throw new Error(data.error || 'Không thể gửi câu hỏi. Vui lòng thử lại.');
    if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('AI chưa trả lời được. Hãy thử lại.');
    state.step = Math.min(3, Math.max(0, Number(data.step) || 0));
    state.hints = Math.min(3, Math.max(0, Number(data.hints) || 0));
    addMessage('model', data.reply);
    input.value = ''; attachmentClear(); adjustHeight();
  } catch (err) {
    // Nếu gửi thất bại, rút lại bong bóng vừa gửi để người dùng thử lại mà không trùng lịch sử.
    state.messages.pop();
    if (messagesEl.lastElementChild) messagesEl.lastElementChild.remove();
    updateUI(); saveState();
    showError(err.name === 'AbortError' ? 'Kết nối quá lâu. Em hãy thử gửi lại.' : err.message);
  } finally { setSending(false); input.focus(); }
}

form.addEventListener('submit', event => { event.preventDefault(); send(); });
input.addEventListener('input', adjustHeight);
input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); send(); } });
$('#attach-button').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', event => handleFile(event.target.files?.[0]));
$('#remove-attachment').addEventListener('click', attachmentClear);

document.querySelectorAll('[data-prompt]').forEach(button => {
  button.addEventListener('click', () => {
    input.value = button.dataset.prompt;
    adjustHeight(); input.focus();
    if (window.innerWidth <= 850) $('#sidebar').classList.remove('open');
  });
});
document.querySelectorAll('.mode-btn').forEach(button => {
  button.addEventListener('click', () => {
    if (sending) return;
    state.mode = button.dataset.mode;
    if (state.mode === 'explain' && state.step === 0) state.step = 0;
    updateUI(); saveState();
  });
});
function resetChat() {
  if (sending) return;
  state = { messages: [], mode: 'coach', step: 0, hints: 0 };
  attachmentClear(); input.value = ''; hideError(); saveState(); renderAll(); adjustHeight();
  $('#sidebar').classList.remove('open'); $('#menu-button').setAttribute('aria-expanded', 'false'); input.focus();
}
function askReset() { if (!state.messages.length) return resetChat(); if (!sending) confirmDialog.showModal(); }
$('#new-chat-side').addEventListener('click', askReset);
$('#clear-chat').addEventListener('click', askReset);
confirmDialog.addEventListener('close', () => { if (confirmDialog.returnValue === 'confirm') resetChat(); });
$('#menu-button').addEventListener('click', () => {
  const sidebar = $('#sidebar'); const nowOpen = sidebar.classList.toggle('open');
  $('#menu-button').setAttribute('aria-expanded', String(nowOpen));
});
window.addEventListener('keydown', e => { if (e.key === 'Escape') { $('#sidebar').classList.remove('open'); $('#menu-button').setAttribute('aria-expanded', 'false'); } });
window.addEventListener('resize', () => { if (window.innerWidth > 850) $('#sidebar').classList.remove('open'); });
renderAll(); adjustHeight();
