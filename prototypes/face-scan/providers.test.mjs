import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createProviders, openAIRequest, parseImage, providerURL, sign, verify } from './providers.mjs';
import { createHandler } from './handler.mjs';

// A JPEG signature suffices for transport tests; no human photo or live API call is used.
const image = 'data:image/jpeg;base64,' + Buffer.from([255, 216, 255, 224, 0, 0, 255, 217]).toString('base64');
const env = { OPENAI_API_KEY: 'test-openai', YOUCAM_API_KEY: 'test-youcam', OPENAI_VISION_MODEL: 'test-model' };
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });

test('detailed analysis uses high image detail and eight nullable concern scores', () => {
  const request = openAIRequest(image, env);
  assert.equal(request.model, 'gpt-5.6-sol');
  const astra = openAIRequest(image, env, 'gpt-6-astra');
  assert.equal(astra.model, 'gpt-6-astra');
  assert.equal(astra.input[0].content[1].detail, 'high');
  assert.equal(astra.reasoning.effort, 'low');
  assert.equal(openAIRequest(image, env, 'gpt-5.6-terra').model, 'gpt-5.6-terra');
  assert.throws(() => openAIRequest(image, env, 'invalid'));
  assert.ok(request.text.format.schema.properties.regions);
  assert.equal(request.input[0].content[1].detail, 'high');
  assert.equal(request.store, false);
  for (const concern of ['redness', 'acne', 'texture', 'pore', 'pigmentation', 'flaking', 'fine_lines', 'residual_marks']) {
    assert.deepEqual(request.text.format.schema.properties[concern].type, ['number', 'null']);
    assert.ok(request.text.format.schema.properties.regions.items.required.includes(concern));
    assert.ok(request.text.format.schema.properties.detailedFindings.items.properties.concern.enum.includes(concern));
  }
  assert.equal(request.input[0].content[1].image_url, image);
});

test('rejects malformed images, forged task references, and arbitrary proxy targets', () => {
  assert.throws(() => parseImage('data:image/jpeg;base64,aGVsbG8='));
  assert.throws(() => parseImage('https://example.com/photo.jpg'));
  assert.throws(() => providerURL('http://169.254.169.254/'));
  assert.throws(() => providerURL('https://amazonaws.com.evil.test/file'));
  const token = sign({ kind: 'task', taskId: '123' }, 'secret');
  assert.equal(verify(token, 'secret', 'task').taskId, '123');
  assert.throws(() => verify(token, 'other-secret', 'task'));
  assert.throws(() => verify(token, 'secret', 'asset'));
  assert.throws(() => verify(token + 'x', 'secret', 'task'));
});

test('YouCam upload, HD task, polling, regional output, overlay retrieval, and deletion follow the documented contract', async () => {
  const calls = [];
  const responses = [
    json({ data: { files: [{ file_id: 'file-1', requests: [{ url: 'https://yce-us.s3-accelerate.amazonaws.com/upload', method: 'PUT', headers: { 'Content-Type': 'image/jpeg' } }] }] } }),
    new Response('', { status: 200 }), json({ data: { task_id: 'task/123' } }),
    json({ data: { task_status: 'running' } }),
    json({ data: { task_status: 'success', results: { output: [
      { type: 'hd_redness', raw_score: 72, ui_score: 77, mask_urls: ['https://yce-us.s3-accelerate.amazonaws.com/redness.jpg'] },
      { type: 'hd_pore', region: 'nose', raw_score: 29, ui_score: 58, mask_urls: [] },
    ] } } }),
    new Response(Buffer.from([255, 216, 255, 224]), { headers: { 'Content-Type': 'binary/octet-stream' } }),
    json({ status: 200 }),
  ];
  const providers = createProviders(env, async (url, options) => { calls.push({ url, options }); return responses.shift(); });
  const task = await providers.start(image);
  assert.equal(JSON.parse(calls[2].options.body).format, 'json');
  assert.deepEqual(JSON.parse(calls[2].options.body).dst_actions, ['hd_redness', 'hd_acne', 'hd_texture', 'hd_pore']);
  assert.equal((await providers.status(task.token)).status, 'running');
  const output = await providers.status(task.token);
  assert.equal(output.rows[0].raw_score, 72);
  assert.equal(output.rows[1].region, 'nose');
  assert.match(calls[4].url, /task%2F123$/);
  assert.equal(output.imageHash, parseImage(image).hash);
  assert.match((await providers.asset(output.assets[0].token)).dataUrl, /^data:image\/jpeg;base64,/);
  assert.equal((await providers.remove(task.token)).deleted, true);
  assert.equal(calls[6].url, 'https://yce-api-01.makeupar.com/s2s/v2.0/task/delete');
  assert.deepEqual(JSON.parse(calls[6].options.body), { task_id: 'task/123' });
});

test('provider error payloads do not expose echoed keys or images', async () => {
  const providers = createProviders(env, async () => new Response(JSON.stringify({ error: { message: env.OPENAI_API_KEY } }), { status: 401 }));
  await assert.rejects(providers.openai(image), error => !error.message.includes(env.OPENAI_API_KEY) && error.message.includes('401'));
});

test('overlay downloads reject non-image bytes even with an image MIME header', async () => {
  const providers = createProviders(env, async () => new Response('<html>error</html>', { headers: { 'Content-Type': 'image/jpeg' } }));
  const token = sign({ kind: 'asset', url: 'https://yce-us.s3-accelerate.amazonaws.com/fake.jpg' }, env.YOUCAM_API_KEY);
  await assert.rejects(providers.asset(token), /not a supported image/);
});

test('failed task creation explicitly reports that an upload may remain', async () => {
  let count = 0;
  const providers = createProviders(env, async () => {
    count++;
    if (count === 1) return json({ data: { files: [{ file_id: 'file', requests: [{ url: 'https://yce-us.s3-accelerate.amazonaws.com/upload', method: 'PUT' }] }] } });
    if (count === 2) return new Response('');
    return new Response('{}', { status: 429 });
  });
  await assert.rejects(providers.start(image), /uploaded image may remain/);
});

test('hosted API fails closed, enforces password and origin, and exposes only key presence', async () => {
  for (const configured of [false, true]) {
    const server = http.createServer(createHandler({ env: { ...env, ...(configured ? { FACE_SCAN_PROTOTYPE_PASSWORD: 'private' } : {}) } }));
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}`;
    const post = headers => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ action: 'config' }) });
    try {
      assert.equal((await post({})).status, configured ? 401 : 503);
      if (configured) {
        assert.equal((await post({ 'X-Prototype-Password': 'private', Origin: 'https://evil.test' })).status, 403);
        const response = await post({ 'X-Prototype-Password': 'private' });
        assert.equal(response.status, 200);
        const text = await response.text(); assert.ok(!text.includes('test-openai')); assert.ok(!text.includes('test-youcam'));
        assert.equal(JSON.parse(text).youcam, true);
      }
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
});
