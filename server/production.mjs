import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createTateHandler } from './ask-tate.mjs';
import { createHandler } from '../prototypes/face-scan/handler.mjs';

const defaultRoot = fileURLToPath(new URL('../dist/', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
};

export function createProductionServer({ root = defaultRoot, tate = createTateHandler(), faceScan = createHandler() } = {}) {
  const send = (res, status, text) => {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(text);
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname === '/api/ask-tate') return await tate(req, res);
      if (pathname === '/api/face-scan-prototype') return await faceScan(req, res);
      if (pathname.startsWith('/api/')) return send(res, 404, 'Not found');
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.setHeader('Allow', 'GET, HEAD');
        return send(res, 405, 'Method not allowed');
      }
      if (pathname === '/healthz') {
        await stat(resolve(root, 'index.html'));
        return send(res, 200, 'ok');
      }
      // Only exported assets are served. Dotfiles, traversal, and symlink escapes are rejected.
      if (pathname.includes('\\') || pathname.split('/').some(part => part.startsWith('.')) || pathname.includes('\0')) {
        return send(res, 404, 'Not found');
      }
      const publicRoot = await realpath(root);
      let file = resolve(publicRoot, '.' + pathname);
      if (file !== publicRoot && !file.startsWith(publicRoot + sep)) return send(res, 404, 'Not found');
      try {
        if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
        file = await realpath(file);
      } catch (error) {
        if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
        if (extname(pathname) || pathname.startsWith('/face-scan-prototype/')) return send(res, 404, 'Not found');
        file = resolve(publicRoot, 'index.html');
      }
      if (!file.startsWith(publicRoot + sep)) return send(res, 404, 'Not found');
      const data = await readFile(file);
      const immutable = pathname.startsWith('/_expo/static/');
      res.writeHead(200, {
        'Content-Type': types[extname(file)] ?? 'application/octet-stream',
        'Content-Length': data.length,
        'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      if (res.headersSent) return res.destroy();
      if (error instanceof URIError) return send(res, 400, 'Invalid URL');
      console.error('Request failed:', error.code ?? error.name);
      send(res, 500, 'Unable to complete request');
    }
  });
  server.requestTimeout = 180_000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await stat(resolve(defaultRoot, 'index.html'));
  const server = createProductionServer();
  const port = Number(process.env.PORT || 8080);
  server.listen(port, '0.0.0.0', () => console.log(`Substrate listening on port ${port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10_000).unref();
    });
  }
}
