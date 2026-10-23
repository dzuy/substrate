import { readFileSync, writeFileSync } from 'node:fs';
import { buildBrandSql } from './catalog-brand-import.mjs';
import { preserveExistingRows } from './catalog-import-guards.mjs';

const directory = process.argv[2];
if (!directory) throw Error('Provide batch directory.');
const read = name => JSON.parse(readFileSync(`${directory}/${name}`));
const p = read('prepared.json');
const linked = new Set(p.ingredientLinks.map(i => i.product_id));
const ids = new Set([
  ...p.products.slice(0, 20),
  ...p.products.filter(p => linked.has(p.id)).slice(0, 10),
  ...p.products.filter(p => p.product_type !== 'topical').slice(0, 10),
].map(p => p.id));
const evidence = p.sources.filter(s => !p.products.some(p => p.id === s.product_id)).slice(0, 10);
const sources = [...p.sources.filter(s => ids.has(s.product_id)), ...evidence];
const sourceIds = new Set(sources.map(s => s.source_id));
const ingredientLinks = p.ingredientLinks.filter(i => ids.has(i.product_id));
const ingredientIds = new Set(ingredientLinks.map(i => i.ingredient_id));
const products = p.products.filter(p => ids.has(p.id));
const brandIds = new Set(products.map(p => p.brand_id));
const sample = {
  brands: p.brands.filter(b => brandIds.has(b.id)),
  products, records: p.records.filter(r => ids.has(r.product_id)), sources,
  reviews: p.reviews.filter(r => sourceIds.has(r.id.replace('brand-review-', ''))),
  newIngredients: p.newIngredients.filter(i => ingredientIds.has(i.id)),
  ingredientLinks,
};
const fileIds = new Set(sources.map(s => s.source_file_id));
const snapshots = read('snapshots.json').filter(s => fileIds.has(s.source.id));
const quotedIds = [...ids].map(id => "'" + id + "'").join(',');
let sql = preserveExistingRows(buildBrandSql(sample, snapshots));
sql = sql.replace(/commit;\n$/, `
do $drafts$ begin
 if (select count(*) from public.products where id in (${quotedIds})) <> ${ids.size}
 then raise exception 'Preflight product count mismatch'; end if;
 if exists(select 1 from public.products where id in (${quotedIds}) and
   (catalog_visible or recommendation_enabled or status <> 'draft'))
 then raise exception 'New product is not an unpublished draft'; end if;
end $drafts$;
select jsonb_build_object('products_tested',${ids.size},'source_rows_tested',${sources.length},'ingredient_links_tested',${ingredientLinks.length},'existing_rows_preserved',true,'rolled_back',true) as preflight;
rollback;
`);
writeFileSync(`${directory}/preflight.sql`, sql);
console.log(JSON.stringify({ products: products.length, sources: sources.length, ingredientLinks: ingredientLinks.length, snapshots: snapshots.length }));
