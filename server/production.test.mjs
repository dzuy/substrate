import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProductionServer } from './production.mjs';

test('production routing serves Expo, the lab, and both APIs without exposing server files', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'substrate-hosting-'));
  const root = join(dir, 'dist');
  await mkdir(join(root, 'face-scan-prototype'), { recursive: true });
  await mkdir(join(root, '_expo/static'), { recursive: true });
  await writeFile(join(root, 'index.html'), '<html>Expo app</html>');
  await writeFile(join(root, 'face-scan-prototype/index.html'), '<html>Face Scan Lab</html>');
  await writeFile(join(root, '_expo/static/app.js'), 'console.log("app")');
  await writeFile(join(dir, '.env'), 'SECRET=never-serve');
  await symlink(join(dir, '.env'), join(root, 'leaked.txt'));
  const server = createProductionServer({ root });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  for (const path of ['/', '/profile', '/skin-wardrobe/add-products', '/reset-password?token=test']) {
    const response = await fetch(url + path);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '<html>Expo app</html>');
  }
  for (const path of ['/face-scan-prototype', '/face-scan-prototype/', '/face-scan-prototype/index.html']) {
    assert.equal(await (await fetch(url + path)).text(), '<html>Face Scan Lab</html>');
  }
  const asset = await fetch(url + '/_expo/static/app.js');
  assert.match(asset.headers.get('content-type'), /javascript/);
  assert.match(asset.headers.get('cache-control'), /immutable/);
  const head = await fetch(url + '/', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal(await (await fetch(url + '/healthz')).text(), 'ok');
  for (const path of ['/.env', '/%2eenv', '/leaked.txt', '/missing.js', '/api/missing', '/face-scan-prototype/missing']) {
    assert.equal((await fetch(url + path)).status, 404, path);
  }
  assert.equal((await fetch(url + '/%', { method: 'GET' })).status, 400);
  assert.equal((await fetch(url + '/', { method: 'POST' })).status, 405);
  assert.equal((await fetch(url + '/api/ask-tate', { method: 'POST' })).status, 401);
  assert.equal((await fetch(url + '/api/face-scan-prototype')).status, 405);
  const config = await fetch(url + '/api/face-scan-prototype', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: url }, body: JSON.stringify({ action: 'config' }),
  });
  assert.equal(config.status, 200);
  assert.ok((await config.json()).questions);
  const crossOrigin = await fetch(url + '/api/face-scan-prototype', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://other.example' }, body: '{}',
  });
  assert.equal(crossOrigin.status, 403);
});
