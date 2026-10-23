// Each transaction checks that every row present before it remains unchanged.
// This includes CMS fields, publication state, ingredient links, and reviewed mappings.
const tables = [
  ['products', ['id']],
  ['brands', ['id']],
  ['ingredients', ['id']],
  ['catalog_records', ['source_id']],
  ['catalog_sources', ['source_id']],
  ['catalog_reviews', ['id']],
  ['product_ingredients', ['product_id', 'ingredient_id']],
  ['catalog_engine_expressions', ['product_id', 'ingredient_id', 'engine_ingredient_id']],
];

export function preserveExistingRows(sql, { excludeProductIds = [], excludeSourceIds = [], excludeReviewIds = [] } = {}) {
  if (!sql.startsWith('begin;\n') || !sql.endsWith('commit;\n')) throw Error('Expected a transactional import.');
  const quoted = ids => ids.map(id => "'" + String(id).replaceAll("'", "''") + "'").join(',');
  const scope = table => {
    if (table === 'products' && excludeProductIds.length) return ` where id not in (${quoted(excludeProductIds)})`;
    if (table === 'product_ingredients' && excludeProductIds.length) return ` where product_id not in (${quoted(excludeProductIds)})`;
    if (['catalog_records','catalog_sources'].includes(table) && excludeSourceIds.length) return ` where source_id not in (${quoted(excludeSourceIds)})`;
    if (table === 'catalog_reviews' && excludeReviewIds.length) return ` where id not in (${quoted(excludeReviewIds)})`;
    return '';
  };
  const capture = tables.map(([table, keys]) =>
    `create temporary table preserve_${table} on commit drop as select ${keys.join(',')}, to_jsonb(t) as original from public.${table} t${scope(table)};`
  ).join('\n');
  const checks = tables.map(([table, keys]) =>
    `if exists(select 1 from preserve_${table} b left join public.${table} t on ${keys.map(k => `t.${k}=b.${k}`).join(' and ')} where b.original is distinct from to_jsonb(t)) then raise exception 'Import changed existing ${table} rows'; end if;`
  ).join('\n');
  const lock = `lock table ${tables.map(([t]) => 'public.' + t).join(',')} in share row exclusive mode;\n`;
  return sql.replace('begin;\n', 'begin;\n' + lock + capture + '\n')
    .replace(/commit;\n$/, `do $preserve$ begin\n${checks}\nend $preserve$;\ncommit;\n`);
}
