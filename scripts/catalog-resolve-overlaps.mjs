import { readFileSync, writeFileSync } from 'node:fs';
import { preserveExistingRows } from './catalog-import-guards.mjs';

const directory = process.argv[2];
if (!directory) throw Error('Provide batch directory.');
const read = name => JSON.parse(readFileSync(`${directory}/${name}`));
const original = read('prepared.json');
const settled = structuredClone(original);
const baseline = read('live-before.json').rows[0].backup;
const decisions = read('overlap-decisions.json').filter(d => d.action !== 'distinct');
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const oldIds = new Set(baseline.products.map(p => p.id));
const productIds = decisions.map(d => d.incoming_id);
if (new Set(productIds).size !== decisions.length) throw Error('Repeated overlap decision');
for (const d of decisions) {
  if (oldIds.has(d.incoming_id) || !original.products.some(p => p.id === d.incoming_id)) throw Error('Resolution may only remove this import’s new drafts');
  if (d.target_id && !oldIds.has(d.target_id)) throw Error('Resolution target is not an original CMS product');
  if (!['match','hold'].includes(d.action) || !d.reason) throw Error('Incomplete reviewed decision');
}
const idList = productIds.map(quote).join(',');
const sources = original.sources.filter(s => productIds.includes(s.product_id));
const sourceIds = sources.map(s => s.source_id);
const reviewIds = sources.map(s => 'brand-review-' + s.source_id);
const allAuditIds = [...productIds, ...sourceIds, ...reviewIds].map(quote).join(',');
let sql = `begin;
set local standard_conforming_strings=on;
select pg_advisory_xact_lock(hashtext('substrate-catalog-import'));
do $owned_drafts$ begin
 if (select count(*) from public.products where id in (${idList})) not in (0,${productIds.length}) then raise exception 'Partial overlap resolution; inspect before continuing'; end if;
 if exists(select 1 from public.products where id in (${idList}) and (catalog_visible or recommendation_enabled or archived_at is not null or description is not null or image_url is not null or cardinality(aliases)>0 or status<>'draft'))
 then raise exception 'An imported draft was edited or published; preserve it for manual review'; end if;
 if exists(select 1 from public.user_wardrobe_items where product_id in (${idList})) then raise exception 'Imported draft now has a wardrobe reference'; end if;
 if exists(select 1 from public.catalog_engine_expressions where product_id in (${idList})) then raise exception 'Imported draft now has reviewed mappings'; end if;
 if exists(select 1 from public.products where id in (${idList})) and exists(select 1 from public.catalog_changes where record_id in (${allAuditIds}) and actor_id is not null)
 then raise exception 'CMS edits detected on imported overlap records; preserve them'; end if;
end $owned_drafts$;
`;
for (const decision of decisions) {
  const relevant = sources.filter(s => s.product_id === decision.incoming_id);
  const product = original.products.find(p => p.id === decision.incoming_id);
  sql += `do $identity$ begin if exists(select 1 from public.products where id=${quote(product.id)} and (name<>${quote(product.name)} or brand_id<>${quote(product.brand_id)})) then raise exception 'Imported draft identity changed'; end if; end $identity$;\n`;
  const target = decision.target_id ? `${quote(decision.target_id)}::uuid` : 'null::uuid';
  const canonical = decision.target_id ? baseline.catalog_records.find(r => r.product_id === decision.target_id)?.source_id : null;
  for (const source of relevant) {
    const reviewId = 'brand-review-' + source.source_id;
    const priorReview = original.reviews.find(r => r.id === reviewId);
    if (!priorReview) throw Error('Expected an existing review for overlap');
    sql += `do $review$ begin if exists(select 1 from public.products where id=${quote(product.id)}) and exists(select 1 from public.catalog_reviews where id=${quote(reviewId)} and (status<>'OPEN' or resolution_note<>'' or fields<>${quote(JSON.stringify(priorReview.fields))}::jsonb)) then raise exception 'Overlap review has CMS edits'; end if; end $review$;\n`;
    sql += `update public.catalog_sources set product_id=${target} where source_id=${quote(source.source_id)} and exists(select 1 from public.products where id=${quote(product.id)});\n`;
    const patch = {
      product_uuid: decision.target_id ?? null,
      product_id: canonical ?? source.source_id,
      duplicate_resolution: decision.reason,
      candidate_product_ids: decision.candidate_ids,
    };
    sql += `update public.catalog_reviews set fields=fields || ${quote(JSON.stringify(patch))}::jsonb || jsonb_build_object('issue',(fields->>'issue') || chr(10) || ${quote(decision.reason)}) where id=${quote(reviewId)} and exists(select 1 from public.products where id=${quote(product.id)});\n`;
    const finalSource = settled.sources.find(s => s.source_id === source.source_id);
    finalSource.product_id = decision.target_id ?? null;
    finalSource.candidates = decision.candidate_ids;
    const finalReview = settled.reviews.find(r => r.id === reviewId);
    finalReview.fields = { ...finalReview.fields, ...patch, issue: finalReview.fields.issue + '\n' + decision.reason };
  }
}
sql += `delete from public.product_ingredients where product_id in (${idList});
delete from public.catalog_records where product_id in (${idList});
delete from public.products where id in (${idList});
commit;\n`;
sql = preserveExistingRows(sql, { excludeProductIds: productIds, excludeSourceIds: sourceIds, excludeReviewIds: reviewIds });
settled.products = settled.products.filter(p => !productIds.includes(p.id));
settled.records = settled.records.filter(r => !productIds.includes(r.product_id));
settled.ingredientLinks = settled.ingredientLinks.filter(l => !productIds.includes(l.product_id));
const newIds = new Set(settled.products.map(p => p.id));
const matched = settled.sources.filter(s => s.product_id && !newIds.has(s.product_id));
settled.report = {
  ...settled.report, canonicalProducts: settled.products.length, newProducts: settled.products.length,
  existingMatches: matched.length, existingSourceMatches: matched.length, existingProductsMatched: new Set(matched.map(s => s.product_id)).size,
  heldAmbiguousRows: settled.sources.filter(s => !s.product_id).length,
  newIngredientLinks: settled.ingredientLinks.length, overlapResolutions: decisions.length,
};
const summary = {
  removedUneditedImportDrafts: productIds.length,
  additionalExistingMatches: decisions.filter(d => d.action === 'match').length,
  additionalHeldRows: decisions.filter(d => d.action === 'hold').length,
  originalCmsRowsPreserved: true,
};
sql = sql.replace(/commit;\n$/, `select ${quote(JSON.stringify(summary))}::jsonb as overlap_resolution;\ncommit;\n`);
writeFileSync(`${directory}/resolve-overlaps.sql`, sql);
writeFileSync(`${directory}/resolve-overlaps-dry-run.sql`, sql.replace(/commit;\n$/, 'rollback;\n'));
writeFileSync(`${directory}/settled-prepared.json`, JSON.stringify(settled, null, 2) + '\n');
writeFileSync(`${directory}/settled-report.json`, JSON.stringify(settled.report, null, 2) + '\n');
console.log(JSON.stringify({ ...summary, newProducts: settled.products.length, existingMatches: matched.length, held: settled.report.heldAmbiguousRows, ingredientLinks: settled.ingredientLinks.length }));
