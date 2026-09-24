import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createProviders, openAIRequest, parseImage, validateAnalysis } from './providers.mjs';
import { createHandler } from './handler.mjs';

// A JPEG signature suffices for transport tests; no human photo or live API call is used.
const image = 'data:image/jpeg;base64,' + Buffer.from([255, 216, 255, 224, 0, 0, 255, 217]).toString('base64');
const env = { OPENAI_API_KEY: 'test-openai', OPENAI_VISION_MODEL: 'test-model' };
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

test('rejects malformed and remote images', () => { assert.throws(() => parseImage('https://example.com/photo.jpg')); assert.throws(() => parseImage('data:image/jpeg;base64,aGVsbG8=')); });

test('provider error payloads do not expose echoed keys or images', async () => {
  const providers = createProviders(env, async () => new Response(JSON.stringify({ error: { message: env.OPENAI_API_KEY } }), { status: 401 }));
  await assert.rejects(providers.openai(image), error => !error.message.includes(env.OPENAI_API_KEY) && error.message.includes('401'));
});

test('hosted API allows password-free access with or without legacy configuration and enforces origin', async () => {
  for (const configured of [false, true]) {
    const server = http.createServer(createHandler({ env: { ...env, ...(configured ? { FACE_SCAN_PROTOTYPE_PASSWORD: 'private' } : {}) } }));
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}`;
    const post = headers => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ action: 'config' }) });
    try {
      assert.equal((await post({})).status, 200);
      {
        assert.equal((await post({ Origin: 'https://evil.test' })).status, 403);
        const response = await post({});
        assert.equal(response.status, 200);
        const text = await response.text(); assert.ok(!text.includes('test-openai')); assert.ok(!text.includes('test-youcam'));
        assert.equal(JSON.parse(text).youcam, undefined); assert.ok(JSON.parse(text).questions.length >= 11); assert.equal(JSON.parse(text).conditionOptions.length, 16); assert.ok(JSON.parse(text).knowledge.version);
      }
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
});

test('localhost ignores the hosted password setting', async () => {
  const server = http.createServer(createHandler({local:true,env:{...env,FACE_SCAN_PROTOTYPE_PASSWORD:'hosted-only'}}));
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  try {
    const response=await fetch(`http://127.0.0.1:${server.address().port}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'config'})});
    assert.equal(response.status,200);
    assert.equal((await response.json()).local,true);
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
