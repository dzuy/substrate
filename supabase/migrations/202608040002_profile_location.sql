alter table public.profiles
add column if not exists location_query text,
add column if not exists location_label text,
add column if not exists latitude double precision,
add column if not exists longitude double precision;
