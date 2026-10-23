import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileRows, prepareIncremental } from './catalog-incremental.mjs';
import { buildBrandSql } from './catalog-brand-import.mjs';

const brand = { id: 'brand', name: 'Example', slug: 'example' };
const product = { id: 'existing', brand_id: 'brand', name: 'CMS renamed serum', aliases: [], variant_label: '30 ml', manufacturer_sku: null };
const backup = {
  brands: [brand], products: [product], ingredients: [],
  catalog_records: [{ source_id: 'old', product_id: 'existing', fields: { product_name: 'Original serum', brand: 'Example', variant: '30 ml', notes: 'CMS edit' } }],
  catalog_sources: [],
};
const row = (variant = '30 ml', name = 'Original serum') => ({
  source_id: 'new-row', source_file_id: 'new-file', sheet: 'Products', row: 2, raw: {},
  fields: { product_name: name, brand: 'Example', variant, product_url: '',
    ingredient_list: '', formula_status: 'missing', category: 'serum',
    product_type: 'topical', is_bundle: 'false', price_amount: '', currency: '', manufacturer_sku: '', price_raw: '' },
});
const snapshots = [{ source: { id: 'new-file', url: 'https://drive.google.com/file/d/new-file', created_time: '2026-10-01', modified_time: '2026-10-01' }, sha256: 'abc', sheets: [] }];

test('a CMS rename still matches immutable source identity and receives evidence only', () => {
  const before = structuredClone(backup);
  const prepared = prepareIncremental([row()], backup, snapshots);
  assert.equal(prepared.products.length, 0);
  assert.equal(prepared.records.length, 0);
  assert.equal(prepared.sources[0].product_id, 'existing');
  assert.deepEqual(backup, before);
  const sql = buildBrandSql(prepared, snapshots);
  assert.doesNotMatch(sql, /insert into public.products|insert into public.catalog_records|update public|delete from/i);
});
test('missing variant against an explicit existing variant is held, not merged or duplicated', () => {
  const result = reconcileRows([row('')], backup);
  assert.equal(result.held.length, 1);
  assert.equal(result.novel.length, 0);
  assert.equal(result.matched.length, 0);
  const prepared = prepareIncremental([row('')], backup, snapshots);
  assert.match(buildBrandSql(prepared, snapshots), /values \('new-row',null,/);
});
test('a distinct explicit size can be inserted separately', () => {
  assert.equal(reconcileRows([row('60 ml')], backup).novel.length, 1);
});
test('held reviews cannot attach to unrelated canonical records with null product IDs', () => {
  const b = structuredClone(backup);
  b.catalog_records.unshift({ source_id: 'unrelated-library-record', product_id: null, fields: {} });
  const prepared = prepareIncremental([row('')], b, snapshots);
  assert.equal(prepared.reviews[0].fields.product_uuid, null);
  assert.equal(prepared.reviews[0].fields.product_id, 'new-row');
});
test('multiple existing matches are held', () => {
  const b = structuredClone(backup);
  b.products.push({ ...product, id: 'another', name: 'Original serum' });
  assert.equal(reconcileRows([row()], b).held.length, 1);
});
test('new product fields do not overwrite any pre-existing canonical record', () => {
  const prepared = prepareIncremental([row('30 ml', 'Different product')], backup, snapshots);
  assert.equal(prepared.products.length, 1);
  assert.notEqual(prepared.products[0].id, 'existing');
  assert.equal(prepared.records.length, 1);
  assert.equal(prepared.report.newProducts, 1);
});
test('a shared collection URL cannot merge different products', () => {
  const b=structuredClone(backup);
  b.catalog_records[0].fields.product_url='https://example.com/collections/all';
  const incoming=row('30 ml','Unrelated serum');
  incoming.fields.product_url='https://example.com/collections/all';
  assert.equal(reconcileRows([incoming],b).novel.length,1);
});
test('a reused product URL across incoming names cannot identify a duplicate alone', () => {
  const b=structuredClone(backup);
  b.catalog_records[0].fields.product_url='https://example.com/products/serum';
  const a=row('30 ml','Unrelated serum'), c=row('30 ml','Another serum');
  a.fields.product_url=c.fields.product_url='https://example.com/products/serum';
  assert.equal(reconcileRows([a,c],b).novel.length,2);
});
test('trademark and punctuation differences do not create duplicate identities', () => {
  assert.equal(reconcileRows([row('30 ml','Original® serum™')],backup).matched.length,1);
});
test('a changed name with the same product URL is held for review, not automatically merged', () => {
  const b=structuredClone(backup);
  b.catalog_records[0].fields.product_url='https://example.com/products/serum';
  const incoming=row('30 ml','Different serum');
  incoming.fields.product_url='https://example.com/products/serum';
  assert.equal(reconcileRows([incoming],b).held.length,1);
});
test('reviewed brand aliases preserve the incoming source brand and existing product', () => {
  const incoming=row();incoming.fields.brand='Example Skincare';
  const p=prepareIncremental([incoming],backup,snapshots,[{incoming:'Example Skincare',existing:'Example',evidence:'Reviewed official source'}]);
  assert.equal(p.sources[0].product_id,'existing');
  assert.equal(p.sources[0].fields.source_brand,'Example Skincare');
  assert.equal(p.brands.length,0);
});
