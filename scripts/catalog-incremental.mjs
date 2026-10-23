import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { identity, variantIdentity, prepareBrandImport, buildBrandBatches } from './catalog-brand-import.mjs';
import { preserveExistingRows } from './catalog-import-guards.mjs';

const slug = value => identity(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const normalizedName = value => identity(String(value ?? '').replace(/[®™©]/g, '')).replace(/[^\p{L}\p{N}%]+/gu, ' ').trim();
const label = (brand, name) => normalizedName(name).startsWith(normalizedName(brand) + ' ')
  ? normalizedName(name).slice(normalizedName(brand).length + 1) : normalizedName(name);
const urlKey = value => {
  try {
    const url = new URL(value);
    if (!/\/products?\/[^/]+|\/[^/]+\.html$/i.test(url.pathname)) return '';
    // Keep variant query parameters: they can identify a different sellable item.
    url.hash = '';
    return url.href.replace(/\/$/, '');
  } catch { return ''; }
};

// Match against both current CMS identities and immutable historical source names.
// Only new records enter the canonical importer. Existing products receive evidence only.
export function reconcileRows(rows, backup) {
  const brands = new Map(backup.brands.map(b => [b.id, b]));
  const entries = [];
  const productMap = new Map(backup.products.map(p => [p.id, p]));
  const evidence = [...(backup.catalog_records ?? []), ...(backup.catalog_sources ?? [])];
  for (const p of backup.products) {
    const brand = brands.get(p.brand_id);
    if (!brand) throw Error('Missing brand for existing product ' + p.id);
    for (const name of [p.name, ...(p.aliases ?? [])]) {
      entries.push({ id: p.id, brand, name: label(brand.name, name), variant: variantIdentity(p.variant_label), url: '', sku: p.manufacturer_sku || '' });
    }
  }
  for (const record of evidence) {
    const p = productMap.get(record.product_id);
    if (!p) continue;
    const f = record.fields ?? {};
    const brand = brands.get(p.brand_id);
    if (f.product_name) entries.push({
      id: p.id, brand, name: label(f.brand || brand.name, f.product_name),
      variant: variantIdentity(f.variant || f.size || f.price_size),
      url: urlKey(f.product_url), sku: f.manufacturer_sku || '',
    });
  }
  const novel = [], matched = [], held = [];
  const entriesByBrand = new Map();
  for (const entry of entries) {
    for (const k of new Set([identity(entry.brand.name), entry.brand.slug])) {
      if (!entriesByBrand.has(k)) entriesByBrand.set(k, []);
      entriesByBrand.get(k).push(entry);
    }
  }
  const incomingUrlNames = new Map();
  for (const row of rows) {
    const f = row.fields, url = urlKey(f.product_url);
    if (!url) continue;
    const k = slug(f.brand) + '|' + url;
    if (!incomingUrlNames.has(k)) incomingUrlNames.set(k, new Set());
    incomingUrlNames.get(k).add(label(f.brand, f.product_name));
  }
  for (const row of rows) {
    const f = row.fields;
    const name = label(f.brand, f.product_name);
    const variant = variantIdentity(f.variant);
    const sourceUrl = urlKey(f.product_url);
    const uniqueIncomingUrl = sourceUrl && incomingUrlNames.get(slug(f.brand) + '|' + sourceUrl)?.size === 1;
    const brandEntries = [...new Set([...(entriesByBrand.get(identity(f.brand)) ?? []), ...(entriesByBrand.get(slug(f.brand)) ?? [])])];
    const possible = brandEntries.filter(e =>
      (e.name === name || (uniqueIncomingUrl && e.url === sourceUrl)));
    if (!possible.length) { novel.push(row); continue; }
    const exact = [...new Set(possible.filter(e => e.name === name && e.variant === variant).map(e => e.id))];
    if (exact.length === 1) { matched.push({ ...row, product_id: exact[0] }); continue; }
    // A different explicit size is new only when all candidates have explicit sizes.
    if (!exact.length && variant && possible.every(e => e.name === name && e.variant && e.variant !== variant)) {
      novel.push(row);
      continue;
    }
    held.push({ ...row, product_id: null, candidates: [...new Set(possible.map(e => e.id))] });
  }
  return { novel, matched, held };
}

export function prepareIncremental(rows, backup, snapshots, brandAliases = []) {
  const aliases = new Map();
  for (const alias of brandAliases) {
    if (!alias.evidence || backup.brands.filter(b => b.name === alias.existing).length !== 1) throw Error('Unverified or ambiguous brand alias: ' + alias.incoming);
    aliases.set(identity(alias.incoming), alias.existing);
  }
  rows = rows.map(row => aliases.has(identity(row.fields.brand))
    ? { ...row, fields: { ...row.fields, source_brand: row.fields.brand, brand: aliases.get(identity(row.fields.brand)) } } : row);
  const reconciled = reconcileRows(rows, backup);
  const prepared = prepareBrandImport(reconciled.novel, { ...backup, products: [], catalog_records: [] }, snapshots);
  const linkedIngredientIds = new Set(prepared.ingredientLinks.map(link => link.ingredient_id));
  prepared.newIngredients = prepared.newIngredients.filter(i => linkedIngredientIds.has(i.id));
  prepared.sources.push(...reconciled.matched, ...reconciled.held);
  for (const row of [...reconciled.matched, ...reconciled.held]) {
    prepared.reviews.push({
      id: 'brand-review-' + row.source_id, source_row: row.row, status: 'OPEN',
      fields: {
        review_id: 'brand-review-' + row.source_id, product_name: row.fields.product_name,
        product_uuid: row.product_id, product_id: (row.product_id ? backup.catalog_records.find(r => r.product_id === row.product_id)?.source_id : null) ?? row.source_id, issue_type: 'catalog_import',
        issue: row.product_id ? 'Additional source evidence; existing CMS record preserved.'
          : 'Ambiguous existing product or variant; canonical insertion withheld to prevent a duplicate.',
        candidate_product_ids: row.candidates ?? [],
        recommended_action: 'Compare original source and current CMS identity before merging or publishing.',
        blocking_for_app: 'YES',
      },
    });
  }
  prepared.report = {
    ...prepared.report, sourceRows: rows.length,
    newIngredients: prepared.newIngredients.length,
    brandAliasesApplied: brandAliases,
    existingMatches: reconciled.matched.length,
    existingSourceMatches: reconciled.matched.length,
    existingProductsMatched: new Set(reconciled.matched.map(r => r.product_id)).size,
    heldAmbiguousRows: reconciled.held.length,
    reviews: prepared.reviews.length,
  };
  return prepared;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directory = process.argv[2];
  if (!directory) throw Error('Provide a separate batch directory.');
  const read = name => JSON.parse(readFileSync(`${directory}/${name}`));
  const backup = read('live-before.json').rows[0].backup;
  Object.assign(backup, read('evidence-before.json').rows[0].backup);
  const snapshots = read('snapshots.json');
  const aliases = existsSync(`${directory}/brand-aliases.json`) ? read('brand-aliases.json') : [];
  const prepared = prepareIncremental(read('brand-staging.json'), backup, snapshots, aliases);
  writeFileSync(`${directory}/prepared.json`, JSON.stringify(prepared, null, 2) + '\n');
  writeFileSync(`${directory}/report.json`, JSON.stringify(prepared.report, null, 2) + '\n');
  const batches = buildBrandBatches(prepared, snapshots, { snapshotBatchSize: 25, productBatchSize: 500, maxRequestBytes: 700_000 });
  // The original batch builder groups source rows by product ID. Keep held evidence separately.
  const heldSources = prepared.sources.filter(s => !s.product_id);
  if (heldSources.length) {
    const { buildBrandSql } = await import('./catalog-brand-import.mjs');
    batches.push({ name: 'held-evidence', sql: buildBrandSql({
      brands: [], products: [], records: [], sources: heldSources,
      reviews: prepared.reviews.filter(r => !r.fields.product_uuid),
      newIngredients: [], ingredientLinks: [],
    }, []) });
  }
  const existingIds = [...new Set(prepared.sources.filter(s => s.product_id && !prepared.products.some(p => p.id === s.product_id)).map(s => s.product_id))];
  if (existingIds.length) {
    const { buildBrandSql } = await import('./catalog-brand-import.mjs');
    batches.push({ name: 'existing-evidence', sql: buildBrandSql({
      brands: [], products: [], records: [],
      sources: prepared.sources.filter(s => existingIds.includes(s.product_id)),
      reviews: prepared.reviews.filter(r => existingIds.includes(r.fields.product_uuid)),
      newIngredients: [], ingredientLinks: [],
    }, []) });
  }
  mkdirSync(`${directory}/batches`, { recursive: true });
  for (const batch of batches) {
    if (!batch.name.startsWith('snapshot-')) batch.sql = preserveExistingRows(batch.sql);
    if (Buffer.byteLength(JSON.stringify({ query: batch.sql })) > 950_000) throw Error('Batch exceeds safe request size: ' + batch.name);
    const completedPath = `${directory}/batches/completed.json`;
    const completed = existsSync(completedPath) ? read('batches/completed.json') : [];
    const prior = completed.find(b => b.name === batch.name);
    if (prior && prior.sha256 !== createHash('sha256').update(batch.sql).digest('hex')) throw Error('Refusing to change completed batch: ' + batch.name);
    writeFileSync(`${directory}/batches/${batch.name}.sql`, batch.sql);
  }
  writeFileSync(`${directory}/batches/manifest.json`, JSON.stringify(batches.map(b => ({
    name: b.name, sha256: createHash('sha256').update(b.sql).digest('hex'),
  })), null, 2) + '\n');
  console.log(JSON.stringify({ ...prepared.report, conflicts: prepared.report.conflicts.length, batches: batches.length }));
}
