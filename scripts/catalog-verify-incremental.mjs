import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

const directory = process.argv[2];
if (!directory) throw Error('Provide batch directory.');
const read = name => JSON.parse(readFileSync(`${directory}/${name}`));
const before = read('live-before.json').rows[0].backup;
const evidence = read('evidence-before.json').rows[0].backup;
const prepared = read(existsSync(`${directory}/settled-prepared.json`) ? 'settled-prepared.json' : 'prepared.json');
const snapshots = read('snapshots.json');
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const ids = (rows, key = 'id') => rows.map(row => quote(row[key])).join(',');

if (process.argv.includes('--generate')) {
  const productIds = ids(before.products);
  writeFileSync(`${directory}/verify-core.sql`, `select jsonb_build_object(
 'products',(select jsonb_agg(t) from public.products t where id in (${productIds})),
 'brands',(select jsonb_agg(t) from public.brands t where id in (${ids(before.brands)})),
 'ingredients',(select jsonb_agg(t) from public.ingredients t where id in (${ids(before.ingredients)})),
 'catalog_records',(select jsonb_agg(t) from public.catalog_records t where source_id in (${ids(before.catalog_records, 'source_id')}))
) as backup;`);
  for (const table of ['products', 'brands', 'ingredients', 'catalog_records']) {
    const key = table === 'catalog_records' ? 'source_id' : 'id';
    writeFileSync(`${directory}/verify-core-${table}.sql`,
      `select jsonb_agg(t) as records from public.${table} t where ${key} in (${ids(before[table], key)});`);
  }
  writeFileSync(`${directory}/verify-evidence.sql`, `select jsonb_build_object(
 'catalog_sources',(select jsonb_agg(t) from public.catalog_sources t where source_id in (${ids(evidence.catalog_sources, 'source_id')})),
 'catalog_imports',(select jsonb_agg(jsonb_build_object('id',t.id,'sha256',t.snapshot->>'sha256','source_modified_at',t.source_modified_at)) from public.catalog_imports t where id in (${ids(evidence.catalog_imports)})),
 'product_ingredients',(select jsonb_agg(t) from public.product_ingredients t where product_id in (${productIds})),
 'catalog_engine_expressions',(select jsonb_agg(t) from public.catalog_engine_expressions t where product_id in (${productIds}))
) as backup;`);
  const snapshotMap = JSON.stringify(snapshots.map(s => ({ id: 'drive-' + s.source.id, sha256: s.sha256 })));
  const newProductIds = ids(prepared.products);
  const expected = {
    products: before.products.length + prepared.products.length,
    brands: before.brands.length + prepared.brands.length,
    ingredients: before.ingredients.length + prepared.newIngredients.length,
    catalog_records: before.catalog_records.length + prepared.records.length,
    catalog_sources: evidence.catalog_sources.length + prepared.sources.length,
    catalog_imports: evidence.catalog_imports.length + snapshots.length,
    product_ingredients: evidence.product_ingredients.length + prepared.ingredientLinks.length,
  };
  const countChecks = Object.entries(expected).map(([table, count]) =>
    `if (select count(*) from public.${table}) <> ${count} then raise exception 'Unexpected ${table} count'; end if;`
  ).join('\n');
  const checks = [
    `if exists(select 1 from public.products where id in (${newProductIds}) and (catalog_visible or recommendation_enabled or status <> 'draft')) then raise exception 'New product is not an unpublished draft'; end if;`,
    `if (select count(*) from public.products where id in (${newProductIds})) <> ${prepared.products.length} then raise exception 'Missing imported products'; end if;`,
    `if exists(select 1 from jsonb_to_recordset(${quote(snapshotMap)}::jsonb) as e(id text, sha256 text) left join public.catalog_imports s using(id) where s.id is null or s.snapshot->>'sha256' is distinct from e.sha256) then raise exception 'Snapshot hash mismatch'; end if;`,
    `if (select count(*) from public.catalog_reviews where id in (${ids(prepared.reviews)})) <> ${prepared.reviews.length} then raise exception 'Missing import reviews'; end if;`,
  ];
  for (let i = 0; i < prepared.sources.length; i += 2000) {
    const mapping = JSON.stringify(prepared.sources.slice(i, i + 2000).map(s => ({ source_id: s.source_id, product_id: s.product_id })));
    checks.push(`if exists(select 1 from jsonb_to_recordset(${quote(mapping)}::jsonb) as e(source_id text, product_id uuid) left join public.catalog_sources s using(source_id) where s.source_id is null or s.product_id is distinct from e.product_id) then raise exception 'Source mapping mismatch'; end if;`);
  }
  checks.forEach((check, i) => writeFileSync(`${directory}/verify-detail-${i}.sql`, `do $verify$ begin
${check}
end $verify$;
select true as verified;`));
  writeFileSync(`${directory}/verify-counts.sql`, `do $verify$ begin
${countChecks}
end $verify$;
select ${quote(JSON.stringify({ ...expected, newProducts: prepared.products.length, existingProductsMatched: prepared.report.existingProductsMatched, heldRows: prepared.report.heldAmbiguousRows, newProductsUnpublished: true, sourceMappingsVerified: true, snapshotHashesVerified: true }))}::jsonb as verification;`);
  console.log(JSON.stringify(expected));
} else {
  const after = read('core-after.json').rows[0].backup;
  const afterEvidence = read('evidence-after.json').rows[0].backup;
  const keys = {
    products: ['id'], brands: ['id'], ingredients: ['id'], catalog_records: ['source_id'],
    catalog_sources: ['source_id'], catalog_imports: ['id'],
    product_ingredients: ['product_id', 'ingredient_id'],
    catalog_engine_expressions: ['product_id', 'ingredient_id', 'engine_ingredient_id'],
  };
  const preserved = {};
  for (const [table, columns] of Object.entries(keys)) {
    const priorRows = before[table] ?? evidence[table];
    const afterRows = after[table] ?? afterEvidence[table] ?? [];
    const key = row => columns.map(c => row[c]).join('|');
    const actual = new Map(afterRows.map(row => [key(row), row]));
    if (actual.size !== priorRows.length) throw Error(`Existing ${table} count changed`);
    for (const row of priorRows) {
      if (!isDeepStrictEqual(row, actual.get(key(row)))) throw Error(`Existing ${table} row changed: ${key(row)}`);
    }
    preserved[table] = priorRows.length;
  }
  for (let i = 0; i < 4 + Math.ceil(prepared.sources.length / 2000); i++) {
    if (read(`detail-${i}-after.json`).rows[0].verified !== true) throw Error('Detail verification failed');
  }
  const counts = read('counts-after.json').rows[0].verification;
  const result = { checkedAt: new Date().toISOString(), preserved, ...counts };
  writeFileSync(`${directory}/verification.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
