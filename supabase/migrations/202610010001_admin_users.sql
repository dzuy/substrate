-- Auth data is exposed only through this narrow, read-only administrator function.
create or replace function public.list_admin_users(page_index integer default 1, page_size integer default 25, search_query text default '')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  -- Read current trusted metadata so revoking admin takes effect immediately.
  if not exists (
    select 1 from auth.users actor where actor.id = auth.uid()
    and (actor.raw_app_meta_data->>'role' = 'admin' or actor.raw_app_meta_data->'roles' @> '["admin"]'::jsonb)
  ) then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if page_index is null or page_index < 1 or page_index > 100000 or page_size is null or page_size < 1 or page_size > 100
    or search_query is null or length(search_query) > 200 then
    raise exception 'Invalid user page' using errcode = '22023';
  end if;
  with matched as (
    select u.id, u.email,
      coalesce(nullif(u.raw_user_meta_data->>'display_name',''), nullif(u.raw_user_meta_data->>'full_name',''), nullif(u.raw_user_meta_data->>'name','')) as name,
      coalesce((select jsonb_agg(distinct r.value order by r.value)
        from jsonb_array_elements_text(
          (case when jsonb_typeof(u.raw_app_meta_data->'roles') = 'array' then u.raw_app_meta_data->'roles' else '[]'::jsonb end)
          || (case when nullif(u.raw_app_meta_data->>'role','') is not null then jsonb_build_array(u.raw_app_meta_data->>'role') else '[]'::jsonb end)
        ) r where r.value <> ''), '["user"]'::jsonb) as roles,
      u.created_at, u.last_sign_in_at, u.email_confirmed_at is not null as email_confirmed
    from auth.users u
    where coalesce(search_query,'') = '' or strpos(lower(coalesce(u.email,'') || ' ' || coalesce(u.raw_user_meta_data->>'display_name','') || ' ' || coalesce(u.raw_user_meta_data->>'full_name','') || ' ' || coalesce(u.raw_user_meta_data->>'name','') || ' ' || u.id::text), lower(trim(search_query))) > 0
  ), paged as (
    select * from matched order by created_at desc, id limit page_size offset (page_index-1)*page_size
  )
  select jsonb_build_object('users', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc, p.id) from paged p),'[]'::jsonb), 'total',(select count(*) from matched)) into result;
  return result;
end $$;
revoke all on function public.list_admin_users(integer,integer,text) from public, anon;
grant execute on function public.list_admin_users(integer,integer,text) to authenticated;
