-- Rollback-only integration checks. Run against a disposable local Supabase DB
-- after all migrations. Never execute this fixture against production.
begin;
insert into auth.users(id) values ('22222222-2222-4222-8222-222222222222') on conflict do nothing;
create temp table availability_before as select id,status,catalog_visible,formula_status,recommendation_enabled from public.products;
create temp table mappings_before as select * from public.catalog_engine_expressions;
insert into public.products(id,brand_id,name,slug,category,catalog_visible,status,formula_status)
select 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',id,'Availability incomplete fixture','availability-incomplete-fixture','other',false,'draft','unresolved' from public.brands limit 1;
insert into public.products(id,brand_id,name,slug,category,catalog_visible,status,archived_at)
select 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',id,'Availability archived fixture','availability-archived-fixture','other',false,'draft',now() from public.brands limit 1;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","app_metadata":{}}',true);
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.products where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1' and not catalog_visible and not recommendation_enabled and formula_status='unresolved') then raise exception 'Incomplete draft unavailable'; end if;
 if exists(select 1 from public.products where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2') then raise exception 'Archive exposed'; end if;
 if exists(select 1 from public.catalog_records) or exists(select 1 from public.catalog_imports) or exists(select 1 from public.catalog_reviews) or exists(select 1 from public.catalog_changes) then raise exception 'Private evidence exposed'; end if;
 if exists(select 1 from jsonb_array_elements(public.get_recommendation_catalog()->'products') x where x->>'id'='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1') then raise exception 'Draft entered recommendations'; end if;
end $$;
insert into public.user_wardrobe_items(user_id,product_id)
values(auth.uid(),'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1')
on conflict(user_id,product_id) do update set status='active';
do $$ begin
 if not exists(select 1 from public.user_wardrobe_items w join public.products p on p.id=w.product_id where w.user_id=auth.uid() and p.id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1') then raise exception 'Wardrobe add/read failed'; end if;
end $$;
reset role;
do $$ begin
 if exists(select * from availability_before except select id,status,catalog_visible,formula_status,recommendation_enabled from public.products) then raise exception 'Review state changed'; end if;
 if exists(select * from mappings_before except select * from public.catalog_engine_expressions) then raise exception 'Mappings changed'; end if;
end $$;
select 'PASS: incomplete drafts, archive exclusion, member add/read, private evidence, unchanged approval' as tests;
rollback;
