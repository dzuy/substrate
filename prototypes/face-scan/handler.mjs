import { timingSafeEqual } from 'node:crypto';
import { createProviders } from './providers.mjs';

const MAX_BODY = 3_900_000;
function equal(a, b) {
  const left = Buffer.from(a || ''); const right = Buffer.from(b || '');
  return left.length === right.length && timingSafeEqual(left, right);
}
async function bodyOf(req) {
  if (Number(req.headers['content-length']) > MAX_BODY) throw new Error('Request is too large.');
  if (req.body && typeof req.body === 'object') {
    if (JSON.stringify(req.body).length > MAX_BODY) throw new Error('Request is too large.');
    return req.body;
  }
  if (typeof req.body === 'string') {
    if (req.body.length > MAX_BODY) throw new Error('Request is too large.');
    return JSON.parse(req.body);
  }
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > MAX_BODY) throw new Error('Request is too large.');
  }
  return JSON.parse(text);
}

export function createHandler({ env = process.env, fetcher = fetch, local = false } = {}) {
  const providers = createProviders(env, fetcher);
  return async (req, res) => {
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(data));
    };
    if (req.method !== 'POST') return send(405, { error: 'POST required.' });
    if (local && !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')) return send(403, { error: 'Local host required.' });
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON required.' });
    // JSON requests plus same-origin checks prevent drive-by requests to a local server.
    const origin = req.headers.origin;
    if (origin) {
      try { if (new URL(origin).host !== req.headers.host) return send(403, { error: 'Cross-origin requests are disabled.' }); }
      catch { return send(403, { error: 'Invalid origin.' }); }
    }
    if (!local && !env.FACE_SCAN_PROTOTYPE_PASSWORD) return send(503, { error: 'Set FACE_SCAN_PROTOTYPE_PASSWORD before hosting this prototype.' });
    if (env.FACE_SCAN_PROTOTYPE_PASSWORD && !equal(req.headers['x-prototype-password'], env.FACE_SCAN_PROTOTYPE_PASSWORD)) {
      return send(401, { error: 'Enter the prototype access password.' });
    }
    try {
      const body = await bodyOf(req);
      if (body.action === 'config') return send(200, { openai: Boolean(env.OPENAI_API_KEY), youcam: Boolean(env.YOUCAM_API_KEY),
        model: 'gpt-5.6-sol', local });
      if (body.action === 'openai') {
        if (body.mode !== 'detail') return send(400, { error: 'Unknown comparison mode.' });
        return send(200, await providers.openai(body.image, body.model));
      }
      if (body.action === 'youcam-start') return send(200, await providers.start(body.image));
      if (body.action === 'youcam-status') return send(200, await providers.status(body.token));
      if (body.action === 'youcam-asset') return send(200, await providers.asset(body.token));
      if (body.action === 'youcam-delete') return send(200, await providers.remove(body.token));
      return send(400, { error: 'Unknown action.' });
    } catch (error) {
      const message = error.name === 'TimeoutError' ? 'Provider request timed out. Check the provider console before starting another paid run.' : error.message;
      return send(400, { error: message || 'Request failed.' });
    }
  };
}
