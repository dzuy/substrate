-- Report unlock is explicitly a simulation, not a payment entitlement.
create table if not exists public.skin_reports (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  simulated_unlocked boolean not null default false
);
alter table public.skin_reports enable row level security;
create policy "Read own skin reports" on public.skin_reports for select to authenticated using (user_id = auth.uid());
create policy "Save own skin reports" on public.skin_reports for insert to authenticated with check (user_id = auth.uid());
create policy "Update own simulated reports" on public.skin_reports for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Delete own skin reports" on public.skin_reports for delete to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on public.skin_reports to authenticated;
create index skin_reports_user_created on public.skin_reports(user_id, created_at desc);
