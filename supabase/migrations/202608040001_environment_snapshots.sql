create table public.environment_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  daily_entry_id uuid not null references public.daily_entries(id) on delete cascade,
  provider text not null default 'open-meteo',
  latitude double precision,
  longitude double precision,
  location_label text,
  temperature_f numeric,
  humidity numeric,
  uv_index numeric,
  us_aqi numeric,
  pm2_5 numeric,
  pm10 numeric,
  ozone numeric,
  captured_at timestamptz not null default now(),
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (daily_entry_id)
);

create trigger environment_snapshots_set_updated_at
before update on public.environment_snapshots
for each row execute function public.set_updated_at();

alter table public.environment_snapshots enable row level security;

create policy "Users can read own environment snapshots"
on public.environment_snapshots for select
using (auth.uid() = user_id);

create policy "Users can insert own environment snapshots"
on public.environment_snapshots for insert
with check (auth.uid() = user_id);

create policy "Users can update own environment snapshots"
on public.environment_snapshots for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
