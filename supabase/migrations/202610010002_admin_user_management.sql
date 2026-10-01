-- Only current administrators may manage accounts. Serialize management operations
-- so an administrator cannot race another administrator's revocation.
create or replace function public.set_admin_user_roles(target_user_id uuid, assigned_roles text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(610010002);
  if not exists (select 1 from auth.users where id = auth.uid() and
    (raw_app_meta_data->>'role' = 'admin' or raw_app_meta_data->'roles' @> '["admin"]'::jsonb)) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if assigned_roles is null or cardinality(assigned_roles) < 1 or cardinality(assigned_roles) > 3 or array_ndims(assigned_roles) <> 1 or exists (select 1 from unnest(assigned_roles) r where r is null or r not in ('admin','catalog_admin','user')) then
    raise exception 'Invalid role' using errcode = '22023';
  end if;
  if target_user_id = auth.uid() and not ('admin' = any(assigned_roles)) then
    raise exception 'You cannot remove your own administrator access' using errcode = '22023';
  end if;
  update auth.users set raw_app_meta_data =
    (coalesce(raw_app_meta_data,'{}'::jsonb) - 'role' - 'roles') ||
    jsonb_build_object('roles', (select jsonb_agg(distinct r order by r) from unnest(assigned_roles) r)), updated_at = now()
    where id = target_user_id;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;
end $$;

create or replace function public.delete_admin_user(target_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(610010002);
  if not exists (select 1 from auth.users where id = auth.uid() and
    (raw_app_meta_data->>'role' = 'admin' or raw_app_meta_data->'roles' @> '["admin"]'::jsonb)) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'You cannot delete your own account' using errcode = '22023';
  end if;
  -- Existing account foreign keys cascade to profile and personal app data.
  delete from auth.users where id = target_user_id;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.set_admin_user_roles(uuid,text[]) from public, anon;
revoke all on function public.delete_admin_user(uuid) from public, anon;
grant execute on function public.set_admin_user_roles(uuid,text[]) to authenticated;
grant execute on function public.delete_admin_user(uuid) to authenticated;

-- Catalog policies must also use current roles, rather than a stale access token.
create or replace function public.is_catalog_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users where id = auth.uid() and
    (raw_app_meta_data->>'role' in ('admin','catalog_admin') or
     raw_app_meta_data->'roles' ?| array['admin','catalog_admin']));
$$;
