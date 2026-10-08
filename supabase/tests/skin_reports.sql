begin;
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('b1111111-1111-4111-8111-111111111111','report-owner@example.invalid','{}','{}',now(),now()),
('b2222222-2222-4222-8222-222222222222','report-other@example.invalid','{}','{}',now(),now());
select set_config('request.jwt.claims','{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
set local role authenticated;
insert into public.skin_reports(id,user_id,payload) values
('b3333333-3333-4333-8333-333333333333','b1111111-1111-4111-8111-111111111111','{"name":"Storage test"}');
update public.skin_reports set simulated_unlocked=true where id='b3333333-3333-4333-8333-333333333333';
do $$ begin
 if not exists(select 1 from public.skin_reports where id='b3333333-3333-4333-8333-333333333333' and simulated_unlocked) then raise exception 'Owner retrieval/unlock failed'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.skin_reports where id='b3333333-3333-4333-8333-333333333333') then raise exception 'Report exposed to another account'; end if;
 update public.skin_reports set simulated_unlocked=false where id='b3333333-3333-4333-8333-333333333333';
 if found then raise exception 'Another account updated the report'; end if;
 begin
 insert into public.skin_reports(id,user_id,payload) values ('b4444444-4444-4444-8444-444444444444','b1111111-1111-4111-8111-111111111111','{}');
 raise exception 'Forged ownership accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Report cloud persistence, unlock, and account isolation checks passed' as result;
