-- Publishing is the catalog approval. Internal legacy flags are derived, not separate decisions.
create or replace function public.catalog_publish_issues(target_id uuid) returns text[]
language plpgsql stable security invoker set search_path='' as $$
declare p public.products; f jsonb; issues text[] := '{}';
begin
 if not public.is_catalog_admin() then raise exception 'Catalog admin access required' using errcode='42501'; end if;
 select * into p from public.products where id=target_id;
 select fields into f from public.catalog_records where product_id=target_id;
 if p.archived_at is not null then issues:=array_append(issues,'Restore the product before publishing.'); end if;
 if p.product_type='unknown' then issues:=array_append(issues,'Choose a product type.'); end if;
 if p.product_type in ('topical','hair_scalp','cosmetic','supplement') and not p.is_bundle then
  if p.formula_status not in ('full_unverified','full_verified') or nullif(btrim(f->>'ingredient_list'),'') is null then issues:=array_append(issues,'Add the complete ingredient list.'); end if;
  if not exists(select 1 from public.product_ingredients where product_id=target_id) then issues:=array_append(issues,'Link the formula ingredients.'); end if;
 end if;
 if p.product_type='topical' and not p.is_bundle then
  if not exists(select 1 from public.catalog_engine_expressions e join public.product_ingredients pi on pi.product_id=e.product_id and pi.ingredient_id=e.ingredient_id where e.product_id=target_id and e.role='primary') then issues:=array_append(issues,'Map at least one primary ingredient for product matching.'); end if;
  if coalesce(f->>'product_url','') !~ '^https?://' then issues:=array_append(issues,'Add the official product URL.'); end if;
 end if;
 if exists(select 1 from public.catalog_engine_expressions e where e.product_id=target_id and not exists(select 1 from public.product_ingredients pi where pi.product_id=e.product_id and pi.ingredient_id=e.ingredient_id)) then issues:=array_append(issues,'Remove mappings for ingredients outside this formula.'); end if;
 return issues;
end $$;
revoke all on function public.catalog_publish_issues(uuid) from public,anon;
grant execute on function public.catalog_publish_issues(uuid) to authenticated;

-- Unpublishing also removes approval. Direct publication must meet the same requirements.
create or replace function public.guard_catalog_recommendations() returns trigger
language plpgsql security invoker set search_path='' as $$
declare issues text[];
begin
 if new.archived_at is not null then new.catalog_visible:=false; end if;
 if new.catalog_visible then
  if TG_OP='INSERT' then raise exception 'Save a draft before publishing.'; end if;
  if not old.catalog_visible then
   issues:=public.catalog_publish_issues(new.id);
   if cardinality(issues)>0 then raise exception 'Cannot publish: %',array_to_string(issues,' '); end if;
  end if;
  new.status:='verified';
 else new.status:='draft'; end if;
 new.recommendation_enabled:=new.catalog_visible and new.archived_at is null and new.product_type='topical' and not new.is_bundle and new.formula_status='full_verified'
  and exists(select 1 from public.catalog_engine_expressions e join public.product_ingredients pi on pi.product_id=e.product_id and pi.ingredient_id=e.ingredient_id where e.product_id=new.id and e.approved and e.role='primary')
  and not exists(select 1 from public.catalog_engine_expressions e where e.product_id=new.id and (not e.approved or not exists(select 1 from public.product_ingredients pi where pi.product_id=e.product_id and pi.ingredient_id=e.ingredient_id)))
  and exists(select 1 from public.catalog_records r where r.product_id=new.id and r.fields->>'product_url' ~ '^https?://');
 return new;
end $$;

-- Changes outside the atomic CMS save return a product to draft for a new publication decision.
create or replace function public.invalidate_product_formula() returns trigger
language plpgsql security invoker set search_path='' as $$
declare target uuid := coalesce(new.product_id,old.product_id);
begin
 update public.products set catalog_visible=false,recommendation_enabled=false,
 formula_status=case when TG_TABLE_NAME='product_ingredients' and formula_status='full_verified' then 'full_unverified' else formula_status end where id=target;
 return coalesce(new,old);
end $$;

create or replace function public.sync_catalog_metadata() returns trigger
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
    catalog_visible=case when formula_changed or (TG_OP='UPDATE' and (old.fields->>'formula_status' is distinct from f->>'formula_status' or old.fields->>'product_type' is distinct from f->>'product_type' or old.fields->>'is_bundle' is distinct from f->>'is_bundle')) then false else catalog_visible end,
    recommendation_enabled=case when formula_changed then false else recommendation_enabled end
  where id=new.product_id;
  return new;
end $$;

-- Existing catalog admins may create only provenance for their own CMS-authored products.
-- Imported records and snapshots retain their existing write restrictions.
create policy "Admins create manual product evidence" on public.catalog_records
for insert to authenticated with check (public.is_catalog_admin() and import_id='cms-manual' and source_id='CMS-'||product_id::text);

-- An empty provenance container for products authored directly in the CMS.
insert into public.catalog_imports(id,source_url,source_modified_at,fetched_at,snapshot)
values('cms-manual','local:admin-products',now(),now(),'{"source":{"title":"Created in CMS"}}') on conflict(id) do nothing;

-- Preserve unchanged ingredient links and save reviewed engine mappings atomically.
create or replace function public.save_catalog_product(
  product_data jsonb, ingredient_data jsonb, evidence_data jsonb,
  expected_updated_at timestamptz, expected_evidence_updated_at timestamptz
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  target_id uuid := nullif(product_data->>'id', '')::uuid;
  current_product public.products;
  current_evidence public.catalog_records;
  publish_requested boolean := coalesce((product_data->>'catalog_visible')::boolean,false);
  issues text[];
begin
  if not public.is_catalog_admin() then raise exception 'Catalog admin access required' using errcode = '42501'; end if;
  if nullif(btrim(product_data->>'name'), '') is null then raise exception 'Product name is required'; end if;
  if target_id is not null then
    select * into current_product from public.products where id = target_id for update;
    if not found then raise exception 'Product not found'; end if;
    if expected_updated_at is null or current_product.updated_at <> expected_updated_at then
      raise exception 'This product changed. Reload before saving.' using errcode = '40001';
    end if;
    update public.products set
      brand_id = (product_data->>'brand_id')::uuid, name = btrim(product_data->>'name'),
      slug = product_data->>'slug', category = product_data->>'category',
      description = nullif(product_data->>'description', ''), image_url = nullif(product_data->>'image_url', ''),
      barcode = nullif(product_data->>'barcode', ''), upc = nullif(product_data->>'upc', ''),
      aliases = array(select jsonb_array_elements_text(product_data->'aliases')),
      recommendation_enabled = false, status = 'draft', catalog_visible = false
    where id = target_id;
  else
    insert into public.products(brand_id, name, slug, category, description, image_url, barcode, upc, aliases, status, catalog_visible)
    values ((product_data->>'brand_id')::uuid, btrim(product_data->>'name'), product_data->>'slug', product_data->>'category',
      nullif(product_data->>'description', ''), nullif(product_data->>'image_url', ''), nullif(product_data->>'barcode', ''),
      nullif(product_data->>'upc', ''), array(select jsonb_array_elements_text(product_data->'aliases')),
      'draft', false) returning id into target_id;
  end if;
  if evidence_data is not null then
    select * into current_evidence from public.catalog_records where product_id = target_id for update;
    if not found then
      insert into public.catalog_records(source_id,product_id,import_id,entity_type,fields)
      values('CMS-'||target_id,target_id,'cms-manual','Finished Product',evidence_data);
    else
    if expected_evidence_updated_at is null or current_evidence.updated_at <> expected_evidence_updated_at then
      raise exception 'Source evidence changed. Reload before saving.' using errcode = '40001';
    end if;
    update public.catalog_records set fields = evidence_data where product_id = target_id;
    end if;
  end if;
  delete from public.product_ingredients pi where product_id = target_id and not exists (
    select 1 from jsonb_array_elements(ingredient_data) x where (x->>'ingredient_id')::uuid=pi.ingredient_id);
  insert into public.product_ingredients(product_id, ingredient_id, ingredient_order, concentration, concentration_unit, notes)
  select target_id, x.ingredient_id, x.ingredient_order, x.concentration, x.concentration_unit, x.notes
  from jsonb_to_recordset(ingredient_data) as x(ingredient_id uuid, ingredient_order integer, concentration numeric, concentration_unit text, notes text)
  on conflict(product_id,ingredient_id) do update set ingredient_order=excluded.ingredient_order, concentration=excluded.concentration,
  concentration_unit=excluded.concentration_unit,notes=excluded.notes
  where (product_ingredients.ingredient_order,product_ingredients.concentration,product_ingredients.concentration_unit,product_ingredients.notes)
    is distinct from (excluded.ingredient_order,excluded.concentration,excluded.concentration_unit,excluded.notes);
  if product_data ? 'engine_expressions' then
    delete from public.catalog_engine_expressions e where product_id=target_id and not exists (
      select 1 from jsonb_array_elements(product_data->'engine_expressions') x
      where (x->>'ingredient_id')::uuid=e.ingredient_id and x->>'engine_ingredient_id'=e.engine_ingredient_id);
    insert into public.catalog_engine_expressions(product_id,ingredient_id,engine_ingredient_id,role,required_eligible,approved)
    select target_id,x.ingredient_id,x.engine_ingredient_id,x.role,x.required_eligible,x.approved
    from jsonb_to_recordset(product_data->'engine_expressions') as x(ingredient_id uuid,engine_ingredient_id text,role text,required_eligible boolean,approved boolean)
    on conflict(product_id,ingredient_id,engine_ingredient_id) do update set role=excluded.role,required_eligible=excluded.required_eligible,approved=excluded.approved
    where (catalog_engine_expressions.role,catalog_engine_expressions.required_eligible,catalog_engine_expressions.approved)
      is distinct from (excluded.role,excluded.required_eligible,excluded.approved);
  end if;
  if publish_requested then
    -- The editor supplies completeness and mappings; publication is their approval.
    update public.catalog_records set fields=jsonb_set(fields,'{formula_status}','"full_unverified"')
      where product_id=target_id and evidence_data->>'formula_status' in ('full_unverified','full_verified');
    issues:=public.catalog_publish_issues(target_id);
    if cardinality(issues)>0 then raise exception 'Cannot publish: %',array_to_string(issues,' '); end if;
    update public.catalog_engine_expressions set approved=true where product_id=target_id and not approved;
    update public.catalog_records set fields=jsonb_set(fields,'{formula_status}','"full_verified"')
      where product_id=target_id and fields->>'formula_status' in ('full_unverified','full_verified');
    update public.products set catalog_visible=true where id=target_id;
  end if;
  return target_id;
end;
$$;

-- Identical upload copies and the original pilot resolve to their retained products.
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
