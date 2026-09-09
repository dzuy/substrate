import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepare, buildSql } from './catalog-import.mjs';
const snapshot = JSON.parse(readFileSync(new URL('../data/catalog/source-v10.json', import.meta.url), 'utf8'));

test('snapshot retains every entity and separates retail from other records', () => {
  const result = prepare(snapshot);
  assert.equal(result.records.length, 285);
  assert.equal(result.report.retailRecords, 192);
  assert.equal(result.report.nonRetailRecords, 93);
  assert.equal(result.records.filter((r) => r.entity_type === 'Finished Product').length, 191);
});
test('shifted and duplicate review IDs cannot overwrite unrelated reviews', () => {
  const { reviews, report } = prepare(snapshot);
  assert.equal(reviews.length, 411);
  assert.equal(report.repairedReviewRows.length, 40);
  assert.equal(report.duplicateReviewIds.length, 10);
  assert.equal(new Set(reviews.map((r) => r.id)).size, 411);
  const closure = reviews.at(-1);
  assert.equal(closure.fields.product_name, 'Pilot Batch 1 CLOSED');
  assert.equal(closure.status, 'RESOLVED');
  assert.equal(closure.fields.affected_ids, 'SKP-0125, SKP-0096, SKP-0272');
});
test('unknown review shapes stop the import', () => {
  const broken = structuredClone(snapshot);
  broken.sheets.find((s) => s.title === 'Review_Queue').values[364][6] = 'UNEXPECTED';
  assert.throws(() => prepare(broken), /Unrecognized review layout/);
});
test('duplicate canonical IDs stop the import', () => {
  const broken = structuredClone(snapshot);
  const rows = broken.sheets.find((s) => s.title === 'Products_Canonical').values;
  rows[4][0] = rows[3][0];
  assert.throws(() => prepare(broken), /Invalid\/duplicate ID/);
});
test('dangling master links are quarantined, never assigned to an invented product', () => {
  const result = prepare(snapshot);
  assert.equal(result.links.length, 421);
  assert.equal(result.report.quarantinedMasterLinks.length, 70);
  const ids = new Set(result.records.map((r) => r.product_id));
  assert.ok(result.links.every((l) => ids.has(l.product_id)));
});
test('SQL serialization quotes apostrophes without interpreting source text as SQL', () => {
  const testSnapshot = structuredClone(snapshot);
  testSnapshot.source.title = "x'); select 1; --";
  assert.ok(buildSql(testSnapshot, prepare(testSnapshot)).includes("x''); select 1; --"));
});
