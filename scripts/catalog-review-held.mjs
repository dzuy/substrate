import { readFileSync, writeFileSync } from 'node:fs';
import { preserveExistingRows } from './catalog-import-guards.mjs';

// Apply only explicitly reviewed source identities. Canonical product data never changes.
const directory = process.argv[2];
if (!directory) throw Error('Provide the review directory containing before.json and decisions.json.');
const read = name => JSON.parse(readFileSync(`${directory}/${name}`));
const before = read('before.json').rows[0].backup;
const decisions = read('decisions.json');
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const json = value => `${quote(JSON.stringify(value))}::jsonb`;
const sources = new Map(before.catalog_sources.map(r => [r.source_id, r]));
const reviews = new Map(before.catalog_reviews.map(r => [r.id, r]));
const products = new Map(before.products.map(r => [r.id, r]));
const withoutUpdated = row => { const { updated_at, ...rest } = row; return rest; };
if (decisions.length !== sources.size || new Set(decisions.map(d => d.source_id)).size !== sources.size) {
  throw Error('Every held source must have exactly one reviewed decision.');
}
const expected = { sources: [], reviews: [] };
const changes = [];
let sql = "begin;\nset local standard_conforming_strings=on;\nselect pg_advisory_xact_lock(hashtext('substrate-catalog-import'));\n";
for (const d of decisions) {
  const source = sources.get(d.source_id), review = reviews.get(d.review_id);
  if (!source || !review || source.product_id || review.status !== 'OPEN' || review.resolution_note) throw Error('Source/review is no longer an untouched hold.');
  if (!['match', 'hold'].includes(d.action) || !d.reason || !d.evidence) throw Error('Incomplete reviewed decision.');
  if (d.action === 'match' && (!products.has(d.target_id) || !d.candidate_ids.includes(d.target_id))) throw Error('Target must be a reviewed existing candidate.');
  if (d.action === 'hold' && d.target_id) throw Error('Held source cannot have a target.');
  const canonical = d.target_id ? before.catalog_records.filter(r => r.product_id === d.target_id) : [];
  if (d.target_id && canonical.length !== 1) throw Error('Ambiguous canonical record.');
  const identityOnly = review.fields.issue === 'Ambiguous existing product or variant; canonical insertion withheld to prevent a duplicate.';
  const status = d.action === 'hold' ? 'OPEN' : identityOnly ? 'RESOLVED' : 'PARTIALLY RESOLVED';
  const scope = 'Product identity/source association only. Canonical CMS fields, formulas, clinical claims, publication and ingredient mappings are unchanged.';
  const note = `Duplicate review 2026-10-20: ${d.action === 'match' ? 'Identity resolved. ' : 'Still held. '}${d.reason} ${scope}${status === 'PARTIALLY RESOLVED' ? ' Other original review issues remain open.' : ''}`;
  const finalSource = { ...source, product_id: d.target_id ?? null };
  const finalReview = {
    ...withoutUpdated(review), status, resolution_note: note,
    fields: {
      ...review.fields,
      product_uuid: d.target_id ?? null,
      product_id: canonical[0]?.source_id ?? d.source_id,
      duplicate_identity_status: d.action === 'match' ? 'RESOLVED' : 'HELD',
      duplicate_identity_review: { reviewed_at: '2026-10-20', decision: d.action, reason: d.reason, scope, evidence: d.evidence },
      ...(status === 'RESOLVED' ? { blocking_for_app: 'NO' } : {}),
    },
  };
  const target = d.target_id ? products.get(d.target_id) : null;
  changes.push({ source, review: withoutUpdated(review), after_review: finalReview, target_id: d.target_id,
    target: target ? { id: target.id, name: target.name, brand_id: target.brand_id, updated_at: target.updated_at } : null });
  expected.sources.push(finalSource);
  expected.reviews.push(finalReview);
}
const summary = {
  reviewed: decisions.length,
  duplicateIdentitiesResolved: decisions.filter(d => d.action === 'match').length,
  remainingHeld: decisions.filter(d => d.action === 'hold').length,
  reviewsClosed: expected.reviews.filter(r => r.status === 'RESOLVED').length,
  reviewsPartiallyResolved: expected.reviews.filter(r => r.status === 'PARTIALLY RESOLVED').length,
  canonicalCmsRowsPreserved: true,
};
// Store before/after values once to keep the request bounded. All comparisons are
// full-row checks; only the declared source link and review fields may change.
sql += `create temporary table held_identity_decisions on commit drop as select value as doc from jsonb_array_elements(${json(changes)});
do $precondition$ begin
if exists(select 1 from held_identity_decisions d left join public.catalog_sources t on t.source_id=d.doc->'source'->>'source_id'
 where t.source_id is null or (to_jsonb(t)-'product_id') is distinct from ((d.doc->'source')-'product_id') or (t.product_id is not null and t.product_id is distinct from (d.doc->>'target_id')::uuid)) then raise exception 'Held source changed since review'; end if;
if exists(select 1 from held_identity_decisions d left join public.catalog_reviews t on t.id=d.doc->'review'->>'id'
 where t.id is null or ((to_jsonb(t)-'updated_at') is distinct from d.doc->'review' and (to_jsonb(t)-'updated_at') is distinct from d.doc->'after_review')) then raise exception 'Review changed since read'; end if;
if exists(select 1 from held_identity_decisions d left join public.products t on t.id=(d.doc->>'target_id')::uuid where d.doc->>'target_id' is not null and
 (t.id is null or t.name is distinct from d.doc->'target'->>'name' or t.brand_id is distinct from (d.doc->'target'->>'brand_id')::uuid or t.updated_at is distinct from (d.doc->'target'->>'updated_at')::timestamptz)) then raise exception 'Candidate changed since review'; end if;
end $precondition$;
update public.catalog_sources t set product_id=(d.doc->>'target_id')::uuid from held_identity_decisions d where t.source_id=d.doc->'source'->>'source_id' and t.product_id is null and d.doc->>'target_id' is not null;
update public.catalog_reviews t set fields=d.doc->'after_review'->'fields', status=d.doc->'after_review'->>'status', resolution_note=d.doc->'after_review'->>'resolution_note'
 from held_identity_decisions d where t.id=d.doc->'review'->>'id' and (to_jsonb(t)-'updated_at') is distinct from d.doc->'after_review';
do $check$ begin
if exists(select 1 from held_identity_decisions d left join public.catalog_sources t on t.source_id=d.doc->'source'->>'source_id' where to_jsonb(t) is distinct from ((d.doc->'source') || jsonb_build_object('product_id',d.doc->'target_id'))) then raise exception 'Unexpected source mutation'; end if;
if exists(select 1 from held_identity_decisions d left join public.catalog_reviews t on t.id=d.doc->'review'->>'id' where (to_jsonb(t)-'updated_at') is distinct from d.doc->'after_review') then raise exception 'Unexpected review mutation'; end if;
end $check$;
commit;
`;

sql = preserveExistingRows(sql, {
  excludeSourceIds: decisions.filter(d => d.action === 'match').map(d => d.source_id),
  excludeReviewIds: decisions.map(d => d.review_id),
});
sql = sql.replace(/commit;\n$/, `select ${json(summary)} as review_result;\ncommit;\n`);
const payloadBytes = Buffer.byteLength(JSON.stringify({ query: sql }));
if (payloadBytes > 950000) throw Error(`Review transaction exceeds safe request size: ${payloadBytes}`);
writeFileSync(`${directory}/apply.sql`, sql);
writeFileSync(`${directory}/dry-run.sql`, sql.replace(/commit;\n$/, 'rollback;\n'));
writeFileSync(`${directory}/expected.json`, JSON.stringify(expected, null, 2) + '\n');
writeFileSync(`${directory}/summary.json`, JSON.stringify(summary, null, 2) + '\n');
const lines = ['# Held product identity review — October 20, 2026', '',
  `${summary.reviewed} reviewed; ${summary.duplicateIdentitiesResolved} duplicate identities resolved; ${summary.remainingHeld} remain held. Canonical CMS data is unchanged.`,
  '', 'Resolution applies only to identity and source association. Other formula, price and publication reviews remain intact.', '',
  '| Brand / product | Decision | Evidence and remaining work |', '| --- | --- | --- |'];
for (const d of decisions) {
  const links = d.evidence.web_checks.map(url => `[Manufacturer evidence](${url})`).join(' ');
  const cell = v => String(v).replaceAll('|', '\\|').replaceAll('\n', ' ');
  lines.push(`| ${cell(d.brand + ' — ' + d.product_name)} | ${d.action === 'match' ? 'Matched existing' : 'Held'} | ${cell(d.reason)} ${links} |`);
}
writeFileSync(`${directory}/review-report.md`, lines.join('\n') + '\n');
console.log(JSON.stringify({ ...summary, payloadBytes }));
