-- Keep only deletion IDs to prevent an older device copy from restoring a report.
create table public.deleted_skin_reports (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade
);
alter table public.deleted_skin_reports enable row level security;
create policy "Read own report deletions" on public.deleted_skin_reports for select to authenticated using (user_id=auth.uid());
grant select on public.deleted_skin_reports to authenticated;
create function public.permanently_delete_skin_report(target_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target_id::text,0));
 if exists(select 1 from public.skin_reports where id=target_id and user_id<>auth.uid()) or exists(select 1 from public.deleted_skin_reports where id=target_id and user_id<>auth.uid()) then raise exception 'Report not found'; end if;
 insert into public.deleted_skin_reports(id,user_id) values(target_id,auth.uid()) on conflict do nothing;
 delete from public.skin_reports where id=target_id and user_id=auth.uid();
end $$;
revoke all on function public.permanently_delete_skin_report(uuid) from public,anon;
grant execute on function public.permanently_delete_skin_report(uuid) to authenticated;
create function public.prevent_deleted_report_restore() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.id::text,0));
 if exists(select 1 from public.deleted_skin_reports where id=new.id) then raise exception 'Report permanently deleted'; end if;
 return new;
end $$;
create trigger prevent_deleted_report_restore before insert or update on public.skin_reports for each row execute function public.prevent_deleted_report_restore();
