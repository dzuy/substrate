alter table public.profiles
add column if not exists display_name text,
add column if not exists age_range text,
add column if not exists skin_type text,
add column if not exists sensitivity_level text,
add column if not exists skin_goals text[] not null default '{}',
add column if not exists known_triggers text[] not null default '{}';
