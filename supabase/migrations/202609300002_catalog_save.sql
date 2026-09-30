-- Preserve unchanged ingredient links and save reviewed engine mappings atomically.
create or replace function public.save_catalog_product(
  product_data jsonb, ingredient_data jsonb, evidence_data jsonb,
  expected_updated_at timestamptz, expected_evidence_updated_at timestamptz
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  target_id uuid := nullif(product_data->>'id', '')::uuid;
  current_product public.products;
  current_evidence public.catalog_records;
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
      recommendation_enabled = false, status = product_data->>'status', catalog_visible = (product_data->>'catalog_visible')::boolean
    where id = target_id;
  else
    insert into public.products(brand_id, name, slug, category, description, image_url, barcode, upc, aliases, status, catalog_visible)
    values ((product_data->>'brand_id')::uuid, btrim(product_data->>'name'), product_data->>'slug', product_data->>'category',
      nullif(product_data->>'description', ''), nullif(product_data->>'image_url', ''), nullif(product_data->>'barcode', ''),
      nullif(product_data->>'upc', ''), array(select jsonb_array_elements_text(product_data->'aliases')),
      product_data->>'status', coalesce((product_data->>'catalog_visible')::boolean, false)) returning id into target_id;
  end if;
  if evidence_data is not null then
    select * into current_evidence from public.catalog_records where product_id = target_id for update;
    if not found then raise exception 'Source record not found'; end if;
    if expected_evidence_updated_at is null or current_evidence.updated_at <> expected_evidence_updated_at then
      raise exception 'Source evidence changed. Reload before saving.' using errcode = '40001';
    end if;
    update public.catalog_records set fields = evidence_data where product_id = target_id;
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
  if product_data ? 'recommendation_enabled' then
    update public.products set recommendation_enabled=(product_data->>'recommendation_enabled')::boolean where id=target_id;
  end if;
  return target_id;
end;
$$;
