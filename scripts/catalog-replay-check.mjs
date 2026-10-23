import { readFileSync, writeFileSync } from 'node:fs';

const directory = process.argv[2];
if (!directory) throw Error('Provide batch directory.');
const prepared = JSON.parse(readFileSync(`${directory}/prepared.json`));
const record = prepared.records[0];
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const batch = readFileSync(`${directory}/batches/products-000.sql`, 'utf8');
if (!batch.startsWith('begin;\n') || !batch.endsWith('commit;\n')) throw Error('Expected guarded transaction.');
const marker = 'Rollback-only CMS preservation probe';
// Changes and the replay both roll back. Guards capture the simulated CMS edits
// before retrying the real import SQL, proving ON CONFLICT does not reset them.
const sql = `begin;
update public.catalog_records
 set fields=fields || jsonb_build_object('notes',${quote(marker)},'variant',${quote(marker)},'price_amount','123.45')
 where source_id=${quote(record.source_id)};
update public.products set description=${quote(marker)}
 where id=${quote(record.product_id)};
${batch.slice('begin;\n'.length).replace(/commit;\n$/, '')}
do $replay$ begin
 if not exists(select 1 from public.products where id=${quote(record.product_id)} and description=${quote(marker)} and variant_label=${quote(marker)} and price_amount=123.45)
 then raise exception 'Replay overwrote simulated CMS edits'; end if;
 if not exists(select 1 from public.catalog_records where source_id=${quote(record.source_id)} and fields->>'notes'=${quote(marker)})
 then raise exception 'Replay overwrote simulated CMS evidence'; end if;
end $replay$;
select jsonb_build_object('replay_preserved_cms_edits',true,'rolled_back',true) as replay_check;
rollback;
`;
writeFileSync(`${directory}/replay-check.sql`, sql);
console.log('Generated rollback-only replay check for the first product batch.');
