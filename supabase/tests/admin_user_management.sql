begin;
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('b1111111-1111-4111-8111-111111111111','management-admin@example.invalid','{"roles":["admin"]}','{}',now(),now()),
('b2222222-2222-4222-8222-222222222222','management-catalog@example.invalid','{"role":"catalog_admin"}','{}',now(),now()),
('b3333333-3333-4333-8333-333333333333','management-user@example.invalid','{"provider":"email","roles":["user"]}','{"role":"admin"}',now(),now());
select set_config('request.jwt.claims','{"sub":"b3333333-3333-4333-8333-333333333333","role":"authenticated","app_metadata":{"role":"admin"}}',true);
set local role authenticated;
do $$ begin
  begin perform public.set_admin_user_roles('b3333333-3333-4333-8333-333333333333',array['admin']); raise exception 'User promoted themselves'; exception when insufficient_privilege then null; end;
  begin perform public.delete_admin_user('b2222222-2222-4222-8222-222222222222'); raise exception 'User deleted account'; exception when insufficient_privilege then null; end;
  if public.is_catalog_admin() then raise exception 'Forged claims granted catalog access'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$ begin
  begin perform public.set_admin_user_roles('b3333333-3333-4333-8333-333333333333',array['admin']); raise exception 'Catalog admin promoted user'; exception when insufficient_privilege then null; end;
  begin perform public.delete_admin_user('b3333333-3333-4333-8333-333333333333'); raise exception 'Catalog admin deleted user'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$ begin
  begin perform public.set_admin_user_roles('b1111111-1111-4111-8111-111111111111',array['user']); raise exception 'Self demotion allowed'; exception when invalid_parameter_value then null; end;
  begin perform public.delete_admin_user('b1111111-1111-4111-8111-111111111111'); raise exception 'Self deletion allowed'; exception when invalid_parameter_value then null; end;
  begin perform public.set_admin_user_roles('b3333333-3333-4333-8333-333333333333',array['owner']); raise exception 'Invalid role allowed'; exception when invalid_parameter_value then null; end;
  begin perform public.delete_admin_user('b9999999-9999-4999-8999-999999999999'); raise exception 'Missing account accepted'; exception when no_data_found then null; end;
end $$;
select public.set_admin_user_roles('b3333333-3333-4333-8333-333333333333',array['admin']);
select public.set_admin_user_roles('b3333333-3333-4333-8333-333333333333',array['admin','catalog_admin','user']);
reset role;
do $$ begin
  if (select raw_app_meta_data->'roles' from auth.users where id='b3333333-3333-4333-8333-333333333333') <> '["admin","catalog_admin","user"]'::jsonb then raise exception 'Multiple roles failed'; end if;
end $$;
set local role authenticated;
select public.set_admin_user_roles('b3333333-3333-4333-8333-333333333333',array['user']);
reset role;
do $$ declare metadata jsonb; begin
  select raw_app_meta_data into metadata from auth.users where id='b3333333-3333-4333-8333-333333333333';
  if metadata->>'provider' <> 'email' or metadata ? 'role' or metadata->'roles' <> '["user"]'::jsonb then raise exception 'Role replacement or metadata preservation failed'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"b3333333-3333-4333-8333-333333333333","role":"authenticated","app_metadata":{"roles":["admin","catalog_admin"]}}',true);
set local role authenticated;
do $$ begin if public.is_catalog_admin() then raise exception 'Revoked role retained access'; end if; end $$;
select set_config('request.jwt.claims','{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select public.delete_admin_user('b3333333-3333-4333-8333-333333333333');
reset role;
do $$ begin
  if exists(select 1 from auth.users where id='b3333333-3333-4333-8333-333333333333') then raise exception 'Deletion failed'; end if;
  if exists(select 1 from public.profiles where id='b3333333-3333-4333-8333-333333333333') then raise exception 'Profile cascade failed'; end if;
end $$;
set local role anon;
do $$ begin
  begin perform public.set_admin_user_roles('b2222222-2222-4222-8222-222222222222',array['admin']); raise exception 'Anonymous role change allowed'; exception when insufficient_privilege then null; end;
  begin perform public.delete_admin_user('b2222222-2222-4222-8222-222222222222'); raise exception 'Anonymous deletion allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Role assignment, deletion, authorization, and self-protection checks passed' as result;
