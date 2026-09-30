begin;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{"roles":["catalog_admin"]}}',true);
set local role authenticated;
do $test$
declare col text; backwards boolean; page_num integer; actual jsonb; expected jsonb;
begin
 foreach col in array array['name','brand','category','ingredients','availability'] loop
 foreach backwards in array array[false,true] loop
 for page_num in 1..2 loop
 select jsonb_agg(e->>'id' order by ord) into actual
 from jsonb_array_elements(public.search_catalog_products(jsonb_build_object('sort',col,'descending',backwards),page_num,25)->'products') with ordinality a(e,ord);
 with products as (
 select p.id,p.name,case col when 'name' then p.name when 'brand' then b.name when 'category' then p.category
 when 'ingredients' then case when p.formula_status in ('full_unverified','full_verified') then 'Complete' else 'Missing' end
 when 'availability' then case when p.archived_at is not null then 'Archived' when p.catalog_visible then 'Published' else 'Unpublished' end end as sort_value
 from public.products p join public.brands b on b.id=p.brand_id where p.archived_at is null
 ), ordered as (
 select id from products order by case when not backwards then sort_value end asc, case when backwards then sort_value end desc,name,id limit 25 offset (page_num-1)*25
 )
 select jsonb_agg(id::text) into expected from ordered;
 if actual is distinct from expected then raise exception 'Sort mismatch: %, descending %, page %',col,backwards,page_num; end if;
 end loop;
 end loop;
 end loop;
 if exists(select 1 from jsonb_array_elements(public.search_catalog_products('{"sort":"ingredients","formula_status":"complete"}',1,100)->'products') e where e->>'formula_status' not in ('full_unverified','full_verified')) then raise exception 'Completeness filter regression'; end if;
end $test$;
reset role;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","app_metadata":{}}',true);
set local role authenticated;
do $test$ begin
 begin perform public.search_catalog_products('{"sort":"ingredients"}',1,25); raise exception 'Non-admin access unexpectedly allowed';
 exception when insufficient_privilege then null; end;
end $test$;
reset role;
rollback;
