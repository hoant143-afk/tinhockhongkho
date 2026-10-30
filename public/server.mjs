import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import handler from './api/chat.js';
const root = dirname(fileURLToPath(import.meta.url));
// Chỉ cho phép file public đã liệt kê, không phục vụ .env, mã nguồn máy chủ.
const files = new Map([
  ['/', 'index.html'], ['/index.html', 'index.html'],
  ['/styles.css', 'styles.css'], ['/app.js', 'app.js'],
  ['/favicon.svg', 'favicon.svg']
]);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const envFile = join(root, '.env');
try {
  const raw = await readFile(envFile, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch { /* .env không bắt buộc */ }
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/chat') return handler(req, res);
  if (!['GET', 'HEAD'].includes(req.method) || !files.has(pathname)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Không tìm thấy trang.');
  }
  try {
    const file = files.get(pathname);
    const data = await readFile(join(root, file));
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    return res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(500); return res.end('Lỗi đọc tệp.');
  }
});
const port = Number(process.env.PORT) || 3000;
server.listen(port, '127.0.0.1', () => console.log(`Gia sư Python đang chạy tại http://localhost:${port}`));
