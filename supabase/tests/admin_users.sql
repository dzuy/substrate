begin;
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('a1111111-1111-4111-8111-111111111111','admin-fixture@example.invalid','{"roles":["admin","catalog_admin"]}','{}',now(),now()),
('a2222222-2222-4222-8222-222222222222','catalog-fixture@example.invalid','{"role":"catalog_admin"}','{}',now(),now()),
('a3333333-3333-4333-8333-333333333333','user-fixture@example.invalid','{}','{"role":"admin"}',now(),now());
select set_config('request.jwt.claims','{"sub":"a3333333-3333-4333-8333-333333333333","role":"authenticated","app_metadata":{"role":"admin"}}',true);
set local role authenticated;
do $$ begin
  begin perform public.list_admin_users(); raise exception 'User or forged role unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"a2222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$ begin
  begin perform public.list_admin_users(); raise exception 'Catalog admin unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$ declare data jsonb; row jsonb; begin
  data := public.list_admin_users(1,1,'fixture@example.invalid');
  if (data->>'total')::int <> 3 or jsonb_array_length(data->'users') <> 1 then raise exception 'Pagination failed'; end if;
  data := public.list_admin_users(1,25,'user-fixture@example.invalid');
  row := data->'users'->0;
  if row->'roles' <> '["user"]'::jsonb then raise exception 'Untrusted metadata became a role'; end if;
  if row ? 'raw_app_meta_data' or row ? 'raw_user_meta_data' or row ? 'encrypted_password' then raise exception 'Private metadata exposed'; end if;
  begin perform public.list_admin_users(1,101); raise exception 'Oversize page allowed';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.list_admin_users(); raise exception 'Anonymous user unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Admin users access, pagination, and privacy checks passed' as result;
