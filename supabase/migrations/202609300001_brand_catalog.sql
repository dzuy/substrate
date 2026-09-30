-- Brand workbook provenance is many-to-one; the existing canonical CMS record stays unique.
alter table public.products
  add column product_type text not null default 'unknown' check (product_type in ('unknown','topical','hair_scalp','cosmetic','device','supplement','accessory')),
  add column is_bundle boolean not null default false,
  add column variant_label text,
  add column market text,
  add column manufacturer_sku text,
  add column price_amount numeric check (price_amount > 0),
  add column currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  add column availability text,
  add column formula_status text not null default 'missing' check (formula_status in ('missing','partial','unresolved','full_unverified','full_verified','not_applicable')),
  add column recommendation_enabled boolean not null default false;

create table public.catalog_sources (
  source_id text primary key,
  product_id uuid references public.products(id) on delete restrict,
  import_id text not null references public.catalog_imports(id),
  source_file_id text not null,
  sheet_name text not null,
  source_row integer not null check (source_row > 0),
  fields jsonb not null,
  raw_fields jsonb not null,
  created_at timestamptz not null default now()
);
create index catalog_sources_product_idx on public.catalog_sources(product_id);
alter table public.catalog_sources enable row level security;
create policy "Admins read workbook provenance" on public.catalog_sources for select to authenticated using (public.is_catalog_admin());

-- Expressions are an explicit reviewed bridge to the condition-to-ingredient engine.
create table public.catalog_engine_expressions (
  product_id uuid not null references public.products(id) on delete restrict,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  engine_ingredient_id text not null check (engine_ingredient_id ~ '^I_[A-Z0-9_]+$'),
  role text not null check (role in ('primary','support')),
  required_eligible boolean not null default true,
  approved boolean not null default false,
  primary key(product_id,ingredient_id,engine_ingredient_id)
);
alter table public.catalog_engine_expressions enable row level security;
create policy "Admins manage engine expressions" on public.catalog_engine_expressions for all to authenticated using (public.is_catalog_admin()) with check (public.is_catalog_admin());
create trigger engine_expressions_audit after insert or update or delete on public.catalog_engine_expressions for each row execute function public.audit_catalog_change();

-- Metadata is edited in the existing source drawer and saved in the same transaction.
create function public.sync_catalog_metadata() returns trigger
language plpgsql security invoker set search_path='' as $$
declare f jsonb := new.fields; formula_changed boolean;
begin
  if new.product_id is null then return new; end if;
  formula_changed := TG_OP='UPDATE' and (old.fields->>'ingredient_list' is distinct from f->>'ingredient_list');
  if formula_changed then
    new.fields := jsonb_set(new.fields,'{formula_status}','"unresolved"');
    new.fields := jsonb_set(new.fields,'{formula_verification_status}','"Formula changed; reparse and verify ingredients"');
    f := new.fields;
    update public.catalog_engine_expressions set approved=false where product_id=new.product_id;
  end if;
  update public.products set
    product_type=coalesce(nullif(f->>'product_type',''),product_type),
    is_bundle=coalesce(nullif(f->>'is_bundle','')::boolean,is_bundle),
    variant_label=nullif(f->>'variant',''), market=nullif(f->>'primary_market',''),
    manufacturer_sku=nullif(f->>'manufacturer_sku',''),
    price_amount=nullif(f->>'price_amount','')::numeric,
    currency=nullif(f->>'currency',''),availability=nullif(f->>'availability',''),
    formula_status=coalesce(nullif(f->>'formula_status',''),formula_status),
    recommendation_enabled=case when formula_changed then false else recommendation_enabled end
  where id=new.product_id;
  return new;
end $$;
create trigger catalog_metadata_sync before insert or update on public.catalog_records for each row execute function public.sync_catalog_metadata();

create function public.guard_catalog_recommendations() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.recommendation_enabled and (
    not new.catalog_visible or new.archived_at is not null or new.status<>'verified'
    or new.formula_status<>'full_verified' or new.product_type<>'topical' or new.is_bundle
    or not exists(select 1 from public.catalog_engine_expressions e join public.product_ingredients pi on pi.product_id=e.product_id and pi.ingredient_id=e.ingredient_id where e.product_id=new.id and e.approved and e.role='primary')
    or exists(select 1 from public.catalog_engine_expressions e where e.product_id=new.id and not e.approved)
    or exists(select 1 from public.catalog_engine_expressions e where e.product_id=new.id and not exists(select 1 from public.product_ingredients pi where pi.product_id=e.product_id and pi.ingredient_id=e.ingredient_id))
    or not exists(select 1 from public.catalog_records r where r.product_id=new.id and r.fields->>'product_url' ~ '^https?://')
  ) then raise exception 'Recommendation eligibility requires a published verified topical product, verified full formula and approved ingredient mappings'; end if;
  return new;
end $$;
create trigger products_recommendation_guard before insert or update on public.products for each row execute function public.guard_catalog_recommendations();

create function public.invalidate_product_formula() returns trigger
language plpgsql security invoker set search_path='' as $$
declare target uuid := coalesce(new.product_id,old.product_id);
begin
 update public.products set recommendation_enabled=false,
 formula_status=case when TG_TABLE_NAME='product_ingredients' and formula_status='full_verified' then 'full_unverified' else formula_status end
 where id=target;
 return coalesce(new,old);
end $$;
create trigger product_ingredient_readiness after insert or update or delete on public.product_ingredients for each row execute function public.invalidate_product_formula();
create trigger product_expression_readiness after insert or update or delete on public.catalog_engine_expressions for each row execute function public.invalidate_product_formula();

create function public.set_catalog_recommendation_enabled(target_id uuid, enabled boolean, expected_updated_at timestamptz) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not public.is_catalog_admin() then raise exception 'Catalog admin access required' using errcode='42501'; end if;
 update public.products set recommendation_enabled=enabled where id=target_id and updated_at=expected_updated_at;
 if not found then raise exception 'Product changed; reload before changing eligibility' using errcode='40001'; end if;
end $$;
revoke all on function public.set_catalog_recommendation_enabled(uuid,boolean,timestamptz) from public,anon;
grant execute on function public.set_catalog_recommendation_enabled(uuid,boolean,timestamptz) to authenticated;

create index products_catalog_filter_idx on public.products(archived_at,catalog_visible,brand_id,category);
create index products_formula_status_idx on public.products(formula_status);
create index products_type_idx on public.products(product_type);

-- Public catalog facts only; source evidence and import snapshots remain admin-only.
create view public.recommendation_catalog with (security_invoker=true) as
select p.id,p.name,p.category,p.variant_label,p.market,p.updated_at,b.name as brand,
 r.fields->>'product_url' as source_url,
 (select jsonb_agg(jsonb_build_object('ingredientId',e.engine_ingredient_id,'label',i.name,'role',e.role,'concentration',case when pi.concentration_unit='%' then pi.concentration else null end,'requiredEligible',e.required_eligible))
 from public.catalog_engine_expressions e join public.ingredients i on i.id=e.ingredient_id
 join public.product_ingredients pi on pi.product_id=e.product_id and pi.ingredient_id=e.ingredient_id
 where e.product_id=p.id and e.approved) as expressions
from public.products p join public.brands b on b.id=p.brand_id
left join public.catalog_records r on r.product_id=p.id
where p.recommendation_enabled and p.catalog_visible and p.archived_at is null and p.status='verified' and p.formula_status='full_verified' and p.product_type='topical' and not p.is_bundle;
-- This view is consumed by a trusted server adapter; evidence RLS stays intact.
revoke all on public.recommendation_catalog from anon,authenticated;

create function public.get_recommendation_catalog() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('version',coalesce(max(c.updated_at)::text,'empty'),'region','unspecified','verifiedAt',coalesce(max(c.updated_at)::text,''),'products',coalesce(jsonb_agg(jsonb_build_object(
 'id',c.id,'brand',c.brand,'name',c.name,'format',coalesce(c.variant_label,c.category),'category',c.category,'sourceUrl',c.source_url,
 'expressions',c.expressions,'requiredEligibleIds',(select coalesce(jsonb_agg(e->>'ingredientId'),'[]') from jsonb_array_elements(c.expressions) e where (e->>'requiredEligible')::boolean), 'note','Reviewed catalog formula; ingredient eligibility is evaluated separately'
 )),'[]')) from public.recommendation_catalog c;
$$;
revoke all on function public.get_recommendation_catalog() from public,anon;
grant execute on function public.get_recommendation_catalog() to authenticated;

create function public.search_catalog_products(filters jsonb, page_index integer default 1, page_size integer default 25) returns jsonb
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
 and (coalesce(filters->>'formula_status','all')='all' or p.formula_status=filters->>'formula_status')
 and (coalesce(filters->>'batch','all')='all' or exists(select 1 from public.catalog_sources s where s.product_id=p.id and s.import_id=filters->>'batch'))
 and (coalesce(filters->>'query','')='' or strpos(lower(p.name||' '||b.name||' '||array_to_string(p.aliases,' ')),lower(filters->>'query'))>0 or exists(select 1 from public.catalog_records r where r.product_id=p.id and strpos(lower(r.source_id),lower(filters->>'query'))>0))
 ), paged as (
 select * from matched order by
 case when coalesce((filters->>'descending')::boolean,false)=false then case filters->>'sort' when 'brand' then brand_name when 'category' then category when 'status' then status else name end end asc,
 case when coalesce((filters->>'descending')::boolean,false)=true then case filters->>'sort' when 'brand' then brand_name when 'category' then category when 'status' then status else name end end desc,
 name,id limit page_size offset (page_index-1)*page_size
 )
 select jsonb_build_object('products',coalesce((select jsonb_agg((to_jsonb(x)-'brand_name')||'{"ingredients":[]}'::jsonb) from paged x),'[]'), 'total',(select count(*) from matched),
 'counts',jsonb_build_object('active',(select count(*) from public.products where archived_at is null),'published',(select count(*) from public.products where archived_at is null and catalog_visible),'unpublished',(select count(*) from public.products where archived_at is null and not catalog_visible),'archived',(select count(*) from public.products where archived_at is not null))) into result;
 return result;
end $$;
revoke all on function public.search_catalog_products(jsonb,integer,integer) from public,anon;
grant execute on function public.search_catalog_products(jsonb,integer,integer) to authenticated;
