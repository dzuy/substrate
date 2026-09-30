-- Sort all visible product columns across the full filtered catalog.
create or replace function public.search_catalog_products(filters jsonb, page_index integer default 1, page_size integer default 25) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not public.is_catalog_admin() then raise exception 'Catalog admin access required' using errcode='42501'; end if;
 if page_index<1 or page_size<1 or page_size>100 then raise exception 'Invalid catalog page'; end if;
 with matched as (
 select p.*,to_jsonb(b) as brand, b.name as brand_name from public.products p join public.brands b on b.id=p.brand_id
 where (case filters->>'availability' when 'archived' then p.archived_at is not null when 'published' then p.archived_at is null and p.catalog_visible when 'unpublished' then p.archived_at is null and not p.catalog_visible else p.archived_at is null end)
 and (coalesce(filters->>'brand','all')='all' or p.brand_id::text=filters->>'brand')
 and (coalesce(filters->>'category','all')='all' or p.category=filters->>'category')
 and (coalesce(filters->>'status','all')='all' or p.status=filters->>'status')
 and (coalesce(filters->>'product_type','all')='all' or p.product_type=filters->>'product_type')
 and (coalesce(filters->>'formula_status','all')='all' or (filters->>'formula_status'='complete' and p.formula_status in ('full_unverified','full_verified')) or p.formula_status=filters->>'formula_status')
 and (coalesce(filters->>'batch','all')='all' or exists(select 1 from public.catalog_sources s join public.catalog_imports si on si.id=s.import_id join public.catalog_imports requested on requested.id=filters->>'batch' where s.product_id=p.id and (s.import_id=requested.id or si.snapshot->>'sha256'=requested.snapshot->>'sha256')) or exists(select 1 from public.catalog_records r where r.product_id=p.id and r.import_id=filters->>'batch'))
 and (coalesce(filters->>'query','')='' or strpos(lower(p.name||' '||b.name||' '||array_to_string(p.aliases,' ')),lower(filters->>'query'))>0 or exists(select 1 from public.catalog_records r where r.product_id=p.id and strpos(lower(r.source_id),lower(filters->>'query'))>0))
 ), paged as (
 select * from matched order by
 case when coalesce((filters->>'descending')::boolean,false)=false then case filters->>'sort' when 'brand' then brand_name when 'category' then category when 'status' then status when 'ingredients' then case when formula_status in ('full_unverified','full_verified') then 'Complete' else 'Missing' end when 'availability' then case when archived_at is not null then 'Archived' when catalog_visible then 'Published' else 'Unpublished' end else name end end asc,
 case when coalesce((filters->>'descending')::boolean,false)=true then case filters->>'sort' when 'brand' then brand_name when 'category' then category when 'status' then status when 'ingredients' then case when formula_status in ('full_unverified','full_verified') then 'Complete' else 'Missing' end when 'availability' then case when archived_at is not null then 'Archived' when catalog_visible then 'Published' else 'Unpublished' end else name end end desc,
 name,id limit page_size offset (page_index-1)*page_size
 )
 select jsonb_build_object('products',coalesce((select jsonb_agg((to_jsonb(x)-'brand_name')||'{"ingredients":[]}'::jsonb) from paged x),'[]'), 'total',(select count(*) from matched),
 'counts',jsonb_build_object('active',(select count(*) from public.products where archived_at is null),'published',(select count(*) from public.products where archived_at is null and catalog_visible),'unpublished',(select count(*) from public.products where archived_at is null and not catalog_visible),'archived',(select count(*) from public.products where archived_at is not null))) into result;
 return result;
end $$;
revoke all on function public.search_catalog_products(jsonb,integer,integer) from public,anon;
grant execute on function public.search_catalog_products(jsonb,integer,integer) to authenticated;
