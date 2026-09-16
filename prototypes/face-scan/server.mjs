import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHandler } from './handler.mjs';

// The launch script loads the root .env server-side. Never serve that directory.
const handler = createHandler({ local: true });
const files = { '/face-scan-prototype': 'index.html', '/face-scan-prototype/': 'index.html',
  '/face-scan-prototype/scores.mjs': 'scores.mjs',
  '/face-scan-prototype/app.js': 'app.js', '/face-scan-prototype/style.css': 'style.css' };
const types = { html: 'text/html', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css' };
const port = Number(process.env.FACE_SCAN_PORT || 4317);
http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/face-scan-prototype') return handler(req, res);
  if (pathname === '/') { res.writeHead(302, { Location: '/face-scan-prototype' }); return res.end(); }
  const file = files[pathname];
  if (!file || req.method !== 'GET') { res.writeHead(404); return res.end('Not found'); }
  try {
    const data = await readFile(fileURLToPath(new URL('./public/' + file, import.meta.url)));
    res.writeHead(200, { 'Content-Type': types[file.split('.').pop()], 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    res.end(data);
  } catch { res.writeHead(500); res.end('Unable to read prototype assets.'); }
}).listen(port, '127.0.0.1', () => console.log(`Face Scan Lab: http://localhost:${port}/face-scan-prototype`));
