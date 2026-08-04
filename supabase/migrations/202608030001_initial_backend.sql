create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null default current_date,
  check_in jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'photo_added', 'check_in_added', 'analyzed', 'planned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  daily_entry_id uuid not null references public.daily_entries(id) on delete cascade,
  storage_bucket text not null default 'daily-photos',
  storage_path text not null,
  content_type text,
  size_bytes bigint,
  quality_checks jsonb not null default '{}'::jsonb,
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table public.analysis_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  daily_entry_id uuid not null references public.daily_entries(id) on delete cascade,
  photo_id uuid references public.photos(id) on delete set null,
  provider text,
  model text,
  signals jsonb not null default '{}'::jsonb,
  confidence jsonb not null default '{}'::jsonb,
  caveats text[] not null default '{}',
  raw_response jsonb,
  created_at timestamptz not null default now(),
  unique (daily_entry_id)
);

create table public.recommendation_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  daily_entry_id uuid not null references public.daily_entries(id) on delete cascade,
  provider text,
  model text,
  skin_story jsonb not null default '{}'::jsonb,
  daily_plan jsonb not null default '{}'::jsonb,
  safety_notes text[] not null default '{}',
  raw_response jsonb,
  created_at timestamptz not null default now(),
  unique (daily_entry_id)
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger daily_entries_set_updated_at
before update on public.daily_entries
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.daily_entries enable row level security;
alter table public.photos enable row level security;
alter table public.analysis_results enable row level security;
alter table public.recommendation_results enable row level security;

create policy "Users can read own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can read own daily entries"
on public.daily_entries for select
using (auth.uid() = user_id);

create policy "Users can insert own daily entries"
on public.daily_entries for insert
with check (auth.uid() = user_id);

create policy "Users can update own daily entries"
on public.daily_entries for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can read own photos"
on public.photos for select
using (auth.uid() = user_id);

create policy "Users can insert own photos"
on public.photos for insert
with check (auth.uid() = user_id);

create policy "Users can read own analysis"
on public.analysis_results for select
using (auth.uid() = user_id);

create policy "Users can read own recommendations"
on public.recommendation_results for select
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'daily-photos',
  'daily-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']
)
on conflict (id) do nothing;

create policy "Users can read own stored photos"
on storage.objects for select
using (
  bucket_id = 'daily-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can upload own stored photos"
on storage.objects for insert
with check (
  bucket_id = 'daily-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can update own stored photos"
on storage.objects for update
using (
  bucket_id = 'daily-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'daily-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
