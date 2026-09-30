-- Rollback-only checks. Run after applying the brand catalog schema.
begin;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{"roles":["catalog_admin"]}}',true);
do $$
declare p uuid; b uuid; i uuid; page jsonb;
begin
 select id into b from public.brands limit 1;
 insert into public.products(brand_id,name,slug,category,catalog_visible,product_type,formula_status)
 values(b,'Brand import fixture','brand-test-'||gen_random_uuid(),'serum',false,'topical','full_unverified') returning id into p;
 insert into public.catalog_imports(id,source_url,source_modified_at,fetched_at,snapshot)
 values('brand-fixture-'||p,'https://example.com',now(),now(),'{}');
 insert into public.catalog_records(source_id,product_id,import_id,entity_type,fields)
 values('DRV-fixture-'||p,p,'brand-fixture-'||p,'Finished Product','{"product_type":"topical","is_bundle":"false","price_amount":"25","currency":"USD","variant":"30 mL","product_url":"https://example.com/serum","formula_status":"full_unverified","ingredient_list":"Water, Glycerin"}');
 if (select price_amount from public.products where id=p)<>25 then raise exception 'Metadata sync failed'; end if;
 update public.products set recommendation_enabled=true where id=p;
 if (select recommendation_enabled from public.products where id=p) then raise exception 'Draft entered recommendations'; end if;
 update public.catalog_records set fields=jsonb_set(fields,'{ingredient_list}','"Water, Retinol"') where product_id=p;
 if (select formula_status from public.products where id=p)<>'unresolved' then raise exception 'Formula edit did not invalidate readiness'; end if;
 page:=public.search_catalog_products('{"query":"Brand import fixture"}',1,25);
 if (page->>'total')::integer<>1 or jsonb_array_length(page->'products')<>1 then raise exception 'Search/count mismatch'; end if;
 if exists(select 1 from jsonb_array_elements(public.get_recommendation_catalog()->'products') x where x->>'id'=p::text) then raise exception 'Unapproved recommendation exposed'; end if;
 select id into i from public.ingredients limit 1;
 insert into public.product_ingredients(product_id,ingredient_id,ingredient_order) values(p,i,1);
 insert into public.catalog_engine_expressions(product_id,ingredient_id,engine_ingredient_id,role,approved) values(p,i,'I_HA','primary',true);
 update public.catalog_records set fields=jsonb_set(fields,'{formula_status}','"full_verified"') where product_id=p;
 update public.products set status='verified',catalog_visible=true,recommendation_enabled=true where id=p;
 if not exists(select 1 from jsonb_array_elements(public.get_recommendation_catalog()->'products') x where x->>'id'=p::text) then raise exception 'Reviewed product absent from catalog'; end if;
 perform public.save_catalog_product(
  (select to_jsonb(x)||'{"recommendation_enabled":true}'::jsonb from public.products x where id=p),
  (select jsonb_agg(to_jsonb(x)) from public.product_ingredients x where product_id=p),
  (select fields from public.catalog_records where product_id=p),
  (select updated_at from public.products where id=p),(select updated_at from public.catalog_records where product_id=p));
 if not (select recommendation_enabled from public.products where id=p) then raise exception 'Unchanged save invalidated reviewed formula'; end if;
 update public.product_ingredients set concentration=2,concentration_unit='%' where product_id=p;
 if (select recommendation_enabled or catalog_visible from public.products where id=p) then raise exception 'Ingredient edit left publication enabled'; end if;
end $$;
set local role authenticated;
do $$ begin
 if public.search_catalog_products('{}',1,25) is null then raise exception 'Admin search failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","app_metadata":{}}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.catalog_sources) then raise exception 'Provenance leaked'; end if;
 begin
  perform public.search_catalog_products('{}',1,25);
  raise exception 'Member used admin search';
 exception when insufficient_privilege then null;
 end;
 if public.get_recommendation_catalog() is null then raise exception 'Approved catalog API unavailable'; end if;
end $$;
reset role;
select 'PASS: metadata, formula invalidation, eligibility, pagination, admin/member access' as tests;
rollback;
