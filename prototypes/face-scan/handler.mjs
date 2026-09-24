import { timingSafeEqual, createHmac, createHash } from 'node:crypto';
import { resolveIngredients, conditionOptions, knowledgeInfo } from './ingredients.mjs';
import { questions } from './public/questions.mjs';
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
  // Separate domain and key derivation from retired provider task tokens.
  const secret = env.FACE_SCAN_SIGNING_SECRET || (env.OPENAI_API_KEY ? createHash('sha256').update('face-scan-analysis-v1:' + env.OPENAI_API_KEY).digest('hex') : null);
  const sign = value => {
    if (!secret) throw new Error('Analysis signing is unavailable.');
    const payload = Buffer.from(JSON.stringify({ ...value, expires: Date.now() + 86400000 })).toString('base64url');
    return payload + '.' + createHmac('sha256', secret).update(payload).digest('base64url');
  };
  const verify = token => {
    if (!secret || typeof token !== 'string' || token.length > 150000) throw new Error('Run a new scan to link ingredients.');
    const [payload, signature, extra] = token.split('.');
    if (extra || !equal(signature, createHmac('sha256', secret).update(payload).digest('base64url'))) throw new Error('Invalid analysis reference.');
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (value.expires < Date.now() || value.kind !== 'analysis-v1') throw new Error('Analysis expired. Run a new scan.');
    return value;
  };
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
    if (!local && env.FACE_SCAN_PROTOTYPE_PASSWORD && !equal(req.headers['x-prototype-password'], env.FACE_SCAN_PROTOTYPE_PASSWORD)) {
      return send(401, { error: 'Enter the prototype access password.' });
    }
    try {
      const body = await bodyOf(req);
      if (body.action === 'config') return send(200, { openai: Boolean(env.OPENAI_API_KEY), model: 'gpt-5.6-sol', local, questions, conditionOptions, knowledge: knowledgeInfo });
      if (body.action === 'openai') {
        if (body.mode !== 'detail') return send(400, { error: 'Unknown analysis mode.' });
        const result = await providers.openai(body.image, body.model);
        const analysisToken = sign({ kind: 'analysis-v1', analysis: result.analysis, imageHash: result.imageHash, model: result.model, promptVersion: result.promptVersion });
        return send(200, { ...result, analysisToken });
      }
      if (body.action === 'test-scenario') {
        if (!conditionOptions.some(c => c.id === body.conditionId)) throw new Error('Unknown test scenario.');
        const concerns = { C_ACNE:['acne'],C_ROSACEA:['redness'],C_PIH:['residual_marks','pigmentation'],C_MELASMA:['pigmentation'],C_BARRIER:['flaking'],C_TEXTURE:['texture','pore'],C_PHOTOAGING:['fine_lines','pigmentation'],C_WRINKLE:['fine_lines'],C_GLOW:[] }[body.conditionId] || [];
        const names = ['redness','acne','texture','pore','pigmentation','flaking','fine_lines','residual_marks'];
        const analysis = { faceDetected:true, lighting:90,sharpness:90,framing:90,confidence:90,retakeReasons:[],regions:[],summary:'Synthetic test fixture. No photo inference was performed.',photoLimitations:['Synthetic test fixture'],observations:[],detailedFindings:names.map(concern=>({concern,assessment:concerns.includes(concern)?'visible':'not visible',observation:'Synthetic scenario',distribution:'Test fixture',uncertainty:'Not a real photo analysis',followUpQuestion:null})),...Object.fromEntries(names.map(n=>[n,concerns.includes(n)?35:0])) };
        return send(200, { analysis, ingredients:resolveIngredients(analysis,body.answers), synthetic:true, conditionId:body.conditionId });
      }
      if (body.action === 'ingredients') {
        const signed = verify(body.analysisToken);
        return send(200, { ...resolveIngredients(signed.analysis, body.answers), imageHash: signed.imageHash, model: signed.model, promptVersion: signed.promptVersion });
      }
      return send(400, { error: 'Unknown action.' });
    } catch (error) {
      const message = error.name === 'TimeoutError' ? 'Provider request timed out. Check the provider console before starting another paid run.' : error.message;
      return send(400, { error: message || 'Request failed.' });
    }
  };
}
