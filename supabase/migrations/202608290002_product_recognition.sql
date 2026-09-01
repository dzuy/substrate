create table public.product_detections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_image_uri text not null,
  detected_brand text,
  detected_product_name text,
  matched_product_id uuid references public.products(id) on delete set null,
  confidence numeric,
  status text not null default 'needs_confirmation' check (status in ('matched', 'needs_confirmation', 'unknown', 'rejected', 'confirmed')),
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  detection_id uuid references public.product_detections(id) on delete set null,
  detected_brand text,
  detected_product_name text,
  source_image_uri text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'merged')),
  matched_product_id uuid references public.products(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_detections_user_id_idx on public.product_detections (user_id);
create index product_detections_matched_product_id_idx on public.product_detections (matched_product_id);
create index product_detections_status_idx on public.product_detections (status);
create index product_submissions_user_id_idx on public.product_submissions (user_id);
create index product_submissions_status_idx on public.product_submissions (status);

create trigger product_detections_set_updated_at
before update on public.product_detections
for each row execute function public.set_updated_at();

create trigger product_submissions_set_updated_at
before update on public.product_submissions
for each row execute function public.set_updated_at();

alter table public.product_detections enable row level security;
alter table public.product_submissions enable row level security;

create policy "Users can read own product detections"
on public.product_detections for select
using (auth.uid() = user_id);

create policy "Users can insert own product detections"
on public.product_detections for insert
with check (auth.uid() = user_id);

create policy "Users can update own product detections"
on public.product_detections for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can read own product submissions"
on public.product_submissions for select
using (auth.uid() = user_id);

create policy "Catalog admins can read product submissions"
on public.product_submissions for select
to authenticated
using (public.is_catalog_admin());

create policy "Users can insert own product submissions"
on public.product_submissions for insert
with check (auth.uid() = user_id);

create policy "Catalog admins can update product submissions"
on public.product_submissions for update
to authenticated
using (public.is_catalog_admin())
with check (public.is_catalog_admin());
