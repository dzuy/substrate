create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  inci_name text,
  aliases text[] not null default '{}',
  category text,
  functions text[] not null default '{}',
  description text,
  evidence_level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete restrict,
  name text not null,
  slug text,
  category text not null check (
    category in (
      'cleanser',
      'toner',
      'essence',
      'serum',
      'moisturizer',
      'oil',
      'mask',
      'spf',
      'exfoliant',
      'retinoid',
      'treatment',
      'device',
      'other'
    )
  ),
  description text,
  image_url text,
  barcode text,
  upc text,
  aliases text[] not null default '{}',
  status text not null default 'needs_review' check (status in ('draft', 'verified', 'needs_review')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, slug)
);

create table public.product_ingredients (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  ingredient_order integer,
  concentration numeric,
  concentration_unit text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, ingredient_id)
);

create table public.user_wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'finished', 'paused')),
  notes text,
  added_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index brands_name_idx on public.brands using gin (to_tsvector('simple', name));
create index ingredients_name_idx on public.ingredients using gin (to_tsvector('simple', name));
create index products_name_idx on public.products using gin (to_tsvector('simple', name));
create index products_brand_id_idx on public.products (brand_id);
create index products_category_idx on public.products (category);
create index products_status_idx on public.products (status);
create index product_ingredients_product_id_idx on public.product_ingredients (product_id);
create index user_wardrobe_items_user_id_idx on public.user_wardrobe_items (user_id);

create or replace function public.is_catalog_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' -> 'roles' ? 'catalog_admin', false)
    or coalesce(auth.jwt() -> 'app_metadata' -> 'roles' ? 'admin', false)
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('admin', 'catalog_admin');
$$;

create trigger brands_set_updated_at
before update on public.brands
for each row execute function public.set_updated_at();

create trigger ingredients_set_updated_at
before update on public.ingredients
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger product_ingredients_set_updated_at
before update on public.product_ingredients
for each row execute function public.set_updated_at();

create trigger user_wardrobe_items_set_updated_at
before update on public.user_wardrobe_items
for each row execute function public.set_updated_at();

alter table public.brands enable row level security;
alter table public.ingredients enable row level security;
alter table public.products enable row level security;
alter table public.product_ingredients enable row level security;
alter table public.user_wardrobe_items enable row level security;

create policy "Authenticated users can read brands"
on public.brands for select
to authenticated
using (true);

create policy "Catalog admins can insert brands"
on public.brands for insert
to authenticated
with check (public.is_catalog_admin());

create policy "Catalog admins can update brands"
on public.brands for update
to authenticated
using (public.is_catalog_admin())
with check (public.is_catalog_admin());

create policy "Catalog admins can delete brands"
on public.brands for delete
to authenticated
using (public.is_catalog_admin());

create policy "Authenticated users can read ingredients"
on public.ingredients for select
to authenticated
using (true);

create policy "Catalog admins can insert ingredients"
on public.ingredients for insert
to authenticated
with check (public.is_catalog_admin());

create policy "Catalog admins can update ingredients"
on public.ingredients for update
to authenticated
using (public.is_catalog_admin())
with check (public.is_catalog_admin());

create policy "Catalog admins can delete ingredients"
on public.ingredients for delete
to authenticated
using (public.is_catalog_admin());

create policy "Authenticated users can read active products"
on public.products for select
to authenticated
using (archived_at is null);

create policy "Catalog admins can insert products"
on public.products for insert
to authenticated
with check (public.is_catalog_admin());

create policy "Catalog admins can update products"
on public.products for update
to authenticated
using (public.is_catalog_admin())
with check (public.is_catalog_admin());

create policy "Catalog admins can delete products"
on public.products for delete
to authenticated
using (public.is_catalog_admin());

create policy "Authenticated users can read product ingredients"
on public.product_ingredients for select
to authenticated
using (true);

create policy "Catalog admins can insert product ingredients"
on public.product_ingredients for insert
to authenticated
with check (public.is_catalog_admin());

create policy "Catalog admins can update product ingredients"
on public.product_ingredients for update
to authenticated
using (public.is_catalog_admin())
with check (public.is_catalog_admin());

create policy "Catalog admins can delete product ingredients"
on public.product_ingredients for delete
to authenticated
using (public.is_catalog_admin());

create policy "Users can read own wardrobe"
on public.user_wardrobe_items for select
using (auth.uid() = user_id);

create policy "Users can insert own wardrobe"
on public.user_wardrobe_items for insert
with check (auth.uid() = user_id);

create policy "Users can update own wardrobe"
on public.user_wardrobe_items for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own wardrobe"
on public.user_wardrobe_items for delete
using (auth.uid() = user_id);

insert into public.brands (id, name, slug, website_url)
values
  ('00000000-0000-4000-8000-000000000101', 'SkinCeuticals', 'skinceuticals', 'https://www.skinceuticals.com'),
  ('00000000-0000-4000-8000-000000000102', 'Epicutis', 'epicutis', 'https://epicutis.com'),
  ('00000000-0000-4000-8000-000000000103', 'EltaMD', 'eltamd', 'https://eltamd.com')
on conflict (id) do nothing;

insert into public.ingredients (id, name, inci_name, aliases, category, functions, description, evidence_level)
values
  ('00000000-0000-4000-8000-000000000201', 'L-ascorbic acid', 'Ascorbic Acid', array['Vitamin C'], 'antioxidant', array['antioxidant', 'brightening'], 'A common topical antioxidant used in vitamin C serums.', 'established'),
  ('00000000-0000-4000-8000-000000000202', 'Ferulic acid', 'Ferulic Acid', array[]::text[], 'antioxidant', array['antioxidant'], 'An antioxidant often paired with vitamin C and vitamin E.', 'established'),
  ('00000000-0000-4000-8000-000000000203', 'Tocopherol', 'Tocopherol', array['Vitamin E'], 'antioxidant', array['antioxidant', 'conditioning'], 'A vitamin E form used for antioxidant and skin-conditioning support.', 'established'),
  ('00000000-0000-4000-8000-000000000204', 'TSC', 'Tetramethylhexadecenyl Succinoyl Cysteine', array[]::text[], 'barrier support', array['barrier support'], 'A signature Epicutis ingredient used in barrier-focused formulas.', 'brand supplied'),
  ('00000000-0000-4000-8000-000000000205', 'Zinc oxide', 'Zinc Oxide', array[]::text[], 'mineral sunscreen', array['uv filter'], 'A mineral sunscreen filter.', 'established'),
  ('00000000-0000-4000-8000-000000000206', 'Hyaluronic acid', 'Sodium Hyaluronate', array['Sodium hyaluronate'], 'humectant', array['hydration'], 'A humectant used to support surface hydration.', 'established')
on conflict (id) do nothing;

insert into public.products (id, brand_id, name, slug, category, description, image_url, barcode, upc, aliases, status)
values
  (
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000101',
    'C E Ferulic',
    'c-e-ferulic',
    'serum',
    'A daytime antioxidant serum built around vitamin C, vitamin E, and ferulic acid.',
    null,
    null,
    null,
    array['CE Ferulic', 'C E Ferulic with 15% L-ascorbic acid'],
    'verified'
  ),
  (
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000102',
    'Lipid Serum',
    'lipid-serum',
    'serum',
    'A barrier-support serum used as a simple, supportive routine step.',
    null,
    null,
    null,
    array['Epicutis Lipid Serum'],
    'needs_review'
  ),
  (
    '00000000-0000-4000-8000-000000000303',
    '00000000-0000-4000-8000-000000000103',
    'UV Skin Recovery SPF 50',
    'uv-skin-recovery-spf-50',
    'spf',
    'A mineral sunscreen product intended for daily UV protection.',
    null,
    null,
    null,
    array['EltaMD UV Skin Recovery', 'UV Skin Recovery'],
    'needs_review'
  )
on conflict (id) do nothing;

insert into public.product_ingredients (id, product_id, ingredient_id, ingredient_order, notes)
values
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000201', 1, 'Known hero antioxidant.'),
  ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000203', 2, 'Vitamin E pairing.'),
  ('00000000-0000-4000-8000-000000000403', '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000202', 3, 'Antioxidant pairing.'),
  ('00000000-0000-4000-8000-000000000404', '00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000204', 1, 'Signature barrier-support ingredient.'),
  ('00000000-0000-4000-8000-000000000405', '00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000206', 2, 'Hydration-support ingredient.'),
  ('00000000-0000-4000-8000-000000000406', '00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000205', 1, 'Mineral UV filter.')
on conflict (id) do nothing;
