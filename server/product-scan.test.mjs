import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = (await readFile(new URL('../supabase/functions/analyze-products/index.ts', import.meta.url), 'utf8')).replace(/^import .*;\n/, '');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
function setup(provider, authorized = true) {
  let handler, sent;
  vm.runInNewContext(code, {
    Deno: { serve: fn => { handler = fn; }, env: { get: key => ({ OPENAI_API_KEY: 'synthetic', SUPABASE_URL: 'https://example.invalid', SUPABASE_ANON_KEY: 'synthetic' })[key] } },
    createClient: () => ({ auth: { getUser: async () => ({ data: { user: authorized ? { id: 'test' } : null } }) } }),
    fetch: async (url, init) => { sent = { url, ...init, body: JSON.parse(init.body) }; return provider(); },
    Response, AbortSignal, console,
  });
  return { run: body => handler(new Request('https://example.invalid', { method: 'POST', headers: { Authorization: 'Bearer synthetic' }, body: typeof body === 'string' ? body : JSON.stringify(body) })), sent: () => sent };
}
const image = { imageDataUrl: 'data:image/jpeg;base64,YQ==', catalogProducts: [] };
test('product scan rejects malformed input and unauthenticated users before provider call', async () => {
  const app = setup(() => { throw Error('must not call'); });
  for (const body of ['{', 'null', {}, { imageDataUrl: 'data:image/svg+xml;base64,YQ==' }]) assert.equal((await app.run(body)).status, 400);
  assert.equal(app.sent(), undefined);
  const denied = setup(() => { throw Error('must not call'); }, false);
  assert.equal((await denied.run(image)).status, 401);
  assert.equal(denied.sent(), undefined);
});
test('product scan sends no-storage request and requires catalog match confirmation', async () => {
  const app = setup(() => Response.json({ output_text: JSON.stringify({ detections: [{ detectedBrand: 'Example', detectedProductName: 'Serum', matchedProductId: 'invented', confidence: 4, rationale: 'Visible label' }] }) }));
  const response = await app.run(image);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.detections[0].matchedProductId, null);
  assert.equal(body.detections[0].status, 'unknown');
  assert.equal(body.detections[0].confidence, 1);
  assert.equal(body.rawResponse, undefined);
  assert.equal(app.sent().body.store, false);
  assert.ok(app.sent().signal);
});
test('product scan returns recoverable errors without leaking provider payloads', async () => {
  for (const provider of [
    () => Response.json({ error: { message: 'private provider detail' } }, { status: 429 }),
    () => new Response('not-json'),
    () => Response.json({ output_text: '{' }),
    () => Response.json({ output_text: '{"detections":[null]}' }),
    () => { throw new DOMException('timeout', 'TimeoutError'); },
  ]) {
    const response = await setup(provider).run(image);
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /private provider detail|rawResponse/);
  }
});
