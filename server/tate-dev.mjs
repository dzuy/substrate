import http from 'node:http';
import { createTateHandler } from './ask-tate.mjs';

const handler = createTateHandler();
const port = Number(process.env.TATE_PORT || 4318);
http.createServer((req, res) => {
  const origin = req.headers.origin;
  if (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) { res.writeHead(403); res.end(); return; }
  if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.url?.split('?')[0] !== '/api/ask-tate') { res.writeHead(404); res.end(); return; }
  void handler(req, res);
}).listen(port, '127.0.0.1', () => console.log(`Ask Tate server: http://localhost:${port}/api/ask-tate`));
