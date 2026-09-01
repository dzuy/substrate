alter table public.user_wardrobe_items
add column if not exists routine_timing text not null default 'either'
  check (routine_timing in ('am', 'pm', 'either')),
add column if not exists frequency text not null default 'daily'
  check (frequency in ('daily', 'weekly', 'as_needed')),
add column if not exists routine_role text not null default 'other'
  check (routine_role in ('cleanser', 'serum', 'moisturizer', 'spf', 'treatment', 'device', 'other')),
add column if not exists avoid_when_irritated boolean not null default false;

create index if not exists user_wardrobe_items_routine_timing_idx
on public.user_wardrobe_items (routine_timing);

create index if not exists user_wardrobe_items_frequency_idx
on public.user_wardrobe_items (frequency);

create index if not exists user_wardrobe_items_routine_role_idx
on public.user_wardrobe_items (routine_role);
