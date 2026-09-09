-- Imported evidence stays private to catalog operations until explicitly published.
alter table public.products add column catalog_visible boolean not null default true;

create table public.catalog_imports (
  id text primary key,
  source_url text not null,
  source_modified_at timestamptz not null,
  fetched_at timestamptz not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table public.catalog_records (
  source_id text primary key,
  product_id uuid unique references public.products(id) on delete restrict,
  import_id text not null references public.catalog_imports(id),
  entity_type text not null,
  fields jsonb not null check (jsonb_typeof(fields) = 'object'),
  updated_at timestamptz not null default now()
);

create table public.catalog_master_links (
  id text primary key,
  source_id text not null references public.catalog_records(source_id),
  fields jsonb not null
);

create table public.catalog_reviews (
  id text primary key,
  source_row integer not null,
  fields jsonb not null,
  status text not null check (status in ('OPEN', 'RESOLVED', 'PARTIALLY RESOLVED')),
  resolution_note text not null default '',
  updated_at timestamptz not null default now()
);

create table public.catalog_changes (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text not null,
  actor_id uuid,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

alter table public.catalog_imports enable row level security;
alter table public.catalog_records enable row level security;
alter table public.catalog_master_links enable row level security;
alter table public.catalog_reviews enable row level security;
alter table public.catalog_changes enable row level security;

create policy "Admins read import snapshots" on public.catalog_imports for select to authenticated using (public.is_catalog_admin());
create policy "Admins read catalog evidence" on public.catalog_records for select to authenticated using (public.is_catalog_admin());
create policy "Admins update catalog evidence" on public.catalog_records for update to authenticated using (public.is_catalog_admin()) with check (public.is_catalog_admin());
create policy "Admins read master links" on public.catalog_master_links for select to authenticated using (public.is_catalog_admin());
create policy "Admins read catalog reviews" on public.catalog_reviews for select to authenticated using (public.is_catalog_admin());
create policy "Admins update catalog reviews" on public.catalog_reviews for update to authenticated using (public.is_catalog_admin()) with check (public.is_catalog_admin());
create policy "Admins read catalog history" on public.catalog_changes for select to authenticated using (public.is_catalog_admin());

create trigger catalog_records_updated before update on public.catalog_records for each row execute function public.set_updated_at();
create trigger catalog_reviews_updated before update on public.catalog_reviews for each row execute function public.set_updated_at();

create function public.audit_catalog_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare old_data jsonb; new_data jsonb;
begin
  if TG_OP <> 'INSERT' then old_data := to_jsonb(old); end if;
  if TG_OP <> 'DELETE' then new_data := to_jsonb(new); end if;
  insert into public.catalog_changes(table_name, record_id, actor_id, before_value, after_value)
  values (TG_TABLE_NAME, coalesce(new_data->>'source_id', new_data->>'product_id', new_data->>'id', old_data->>'source_id', old_data->>'product_id', old_data->>'id'), auth.uid(), old_data, new_data);
  return coalesce(new, old);
end;
$$;
revoke all on function public.audit_catalog_change() from public, anon, authenticated;
create trigger products_audit after insert or update or delete on public.products for each row execute function public.audit_catalog_change();
create trigger product_ingredients_audit after insert or update or delete on public.product_ingredients for each row execute function public.audit_catalog_change();
create trigger catalog_records_audit after insert or update or delete on public.catalog_records for each row execute function public.audit_catalog_change();
create trigger catalog_reviews_audit after insert or update or delete on public.catalog_reviews for each row execute function public.audit_catalog_change();

drop policy "Authenticated users can read active products" on public.products;
create policy "Users read published products or their wardrobe references"
on public.products for select to authenticated using (
  public.is_catalog_admin()
  or (archived_at is null and catalog_visible)
  or exists (select 1 from public.user_wardrobe_items w where w.product_id = products.id and w.user_id = auth.uid())
);

-- One transaction saves the product, its ingredient links, and its source evidence.
create function public.save_catalog_product(
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
      status = product_data->>'status', catalog_visible = (product_data->>'catalog_visible')::boolean
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
  delete from public.product_ingredients where product_id = target_id;
  insert into public.product_ingredients(product_id, ingredient_id, ingredient_order, concentration, concentration_unit, notes)
  select target_id, x.ingredient_id, x.ingredient_order, x.concentration, x.concentration_unit, x.notes
  from jsonb_to_recordset(ingredient_data) as x(ingredient_id uuid, ingredient_order integer, concentration numeric, concentration_unit text, notes text);
  return target_id;
end;
$$;
revoke all on function public.save_catalog_product(jsonb,jsonb,jsonb,timestamptz,timestamptz) from public, anon;
grant execute on function public.save_catalog_product(jsonb,jsonb,jsonb,timestamptz,timestamptz) to authenticated;
