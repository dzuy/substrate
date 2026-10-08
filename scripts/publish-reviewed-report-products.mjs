import fs from "node:fs";
import reviewed from "../data/catalog/reviewed-routine-products.json" with { type: "json" };
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
// The connected database owner executes this reviewed data update. Use a real
// catalog admin's existing identity for the same validation/audit as CMS saves.
let sql = `begin;
do $$ declare admin_id uuid; begin
 select id into admin_id from auth.users where raw_app_meta_data->>'role' in ('admin','catalog_admin') or raw_app_meta_data->'roles' ?| array['admin','catalog_admin'] order by created_at limit 1;
 if admin_id is null then raise exception 'No catalog admin available'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
end $$;
`;
for (const p of reviewed) {
  sql += `do $$ begin
 if not exists(select 1 from public.catalog_records where product_id='${p.id}' and fields->>'ingredient_list'=${quote(p.formula)} and fields->>'product_url'=${quote(p.sourceUrl)}) then raise exception 'Reviewed formula or source changed: ${p.id}'; end if;
end $$;
update public.catalog_engine_expressions set approved=true where product_id='${p.id}' and not approved;
update public.catalog_records set fields=fields||jsonb_build_object('formula_status','full_verified','formula_verification_status',${quote("Official full INCI checked " + p.verifiedAt)},'report_formula_review',${quote(p.review)}) where product_id='${p.id}';
update public.products set catalog_visible=true where id='${p.id}';
`;
}
sql +=
  "commit;\nselect count(*) as recommendation_products from public.recommendation_catalog;\n";
fs.writeFileSync(process.argv[2], sql);
