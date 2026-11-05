import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/services/catalog-pagination.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports });
const { collectCatalogRows } = exports;

test('bounded concurrent pagination preserves all 10,756 rows in order', async () => {
  const source = Array.from({ length: 10756 }, (_, id) => ({ id }));
  let active = 0, maxActive = 0, calls = 0;
  const result = await collectCatalogRows(async (from, to) => {
    calls++; maxActive = Math.max(maxActive, ++active);
    await new Promise(resolve => setTimeout(resolve, from % 2000 === 0 ? 8 : 0));
    active--;
    return { data: source.slice(from, to + 1), error: null };
  }, 4);
  assert.equal(result.error, null);
  assert.deepEqual(Array.from(result.data, row => row.id), source.map(row => row.id));
  assert.equal(maxActive, 4);
  assert.equal(calls, 24);
});

test('a required later-page error never returns a partial catalog; retry works', async () => {
  let fail = true;
  const source = Array.from({ length: 2450 }, (_, id) => id);
  const page = async (from, to) => fail && from === 2000
    ? { data: null, error: { message: 'network interruption' } }
    : { data: source.slice(from, to + 1), error: null };
  const failed = await collectCatalogRows(page, 4);
  assert.equal(failed.data, null);
  assert.equal(failed.error.message, 'network interruption');
  fail = false;
  assert.deepEqual(Array.from((await collectCatalogRows(page, 4)).data), source);
});

test('default callers remain sequential and exact page boundaries terminate', async () => {
  let active = 0, maxActive = 0, calls = 0;
  const result = await collectCatalogRows(async (from, to) => {
    calls++; maxActive = Math.max(maxActive, ++active);
    await new Promise(resolve => setImmediate(resolve));
    active--;
    return { data: Array.from({ length: Math.max(0, Math.min(to + 1, 1000) - from) }, (_, i) => from + i), error: null };
  });
  assert.equal(result.data.length, 1000);
  assert.equal(maxActive, 1);
  assert.equal(calls, 3);
});

test('empty catalogs terminate and invalid concurrency cannot fan out requests', async () => {
  assert.equal((await collectCatalogRows(async () => ({ data: [], error: null }), 4)).data.length, 0);
  for (const concurrency of [0, 5, 1.5]) {
    await assert.rejects(collectCatalogRows(() => { throw new Error('must not request'); }, concurrency), /concurrency/);
  }
});
