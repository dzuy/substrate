-- Rollback-only checks for publication as the single approval action.
begin;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{"roles":["catalog_admin"]}}',true);
set local role authenticated;
do $$
declare b uuid; i uuid; p uuid; d uuid; data jsonb; fields jsonb; links jsonb; stamp timestamptz; evidence_stamp timestamptz;
begin
 select id into b from public.brands limit 1;
 select id into i from public.ingredients limit 1;
 fields:='{"product_type":"topical","is_bundle":"false","formula_status":"full_unverified","ingredient_list":"Fixture ingredient","product_url":"https://example.com/fixture"}';
 links:=jsonb_build_array(jsonb_build_object('ingredient_id',i,'ingredient_order',1));
 data:=jsonb_build_object('brand_id',b,'name','Publishing fixture','slug','publishing-fixture-'||gen_random_uuid(),'category','serum','aliases','[]'::jsonb,'catalog_visible',false,'engine_expressions',jsonb_build_array(jsonb_build_object('ingredient_id',i,'engine_ingredient_id','I_HA','role','primary','required_eligible',true,'approved',false)));
 p:=public.save_catalog_product(data,links,fields,null,null);
 if (select catalog_visible or recommendation_enabled or status<>'draft' from public.products where id=p) then raise exception 'Draft was approved'; end if;
 if not exists(select 1 from public.catalog_records where product_id=p and source_id='CMS-'||p) then raise exception 'Manual product evidence not created'; end if;
 select updated_at into stamp from public.products where id=p;
 select updated_at into evidence_stamp from public.catalog_records where product_id=p;
 data:=data||jsonb_build_object('id',p,'catalog_visible',true);
 perform public.save_catalog_product(data,links,fields,stamp,evidence_stamp);
 if not (select catalog_visible and recommendation_enabled and status='verified' and formula_status='full_verified' from public.products where id=p) then raise exception 'Publication did not approve all states'; end if;
 if exists(select 1 from public.catalog_engine_expressions where product_id=p and not approved) then raise exception 'Publication did not approve mappings'; end if;
 if not exists(select 1 from jsonb_array_elements(public.get_recommendation_catalog()->'products') x where x->>'id'=p::text) then raise exception 'Published product missing from matching'; end if;
 -- A bad published save must roll back its draft state and all details.
 select updated_at into stamp from public.products where id=p;
 select updated_at into evidence_stamp from public.catalog_records where product_id=p;
 begin
  perform public.save_catalog_product(data||'{"name":"Invalid changed name"}',links,fields||'{"formula_status":"partial"}',stamp,evidence_stamp);
  raise exception 'Partial formula published';
 exception when raise_exception then
  if sqlerrm='Partial formula published' then raise; end if;
  if sqlerrm not like 'Cannot publish:%' then raise; end if;
 end;
 if (select name<>'Publishing fixture' or not catalog_visible or not recommendation_enabled from public.products where id=p) then raise exception 'Failed publishing save was not atomic'; end if;
 begin
  perform public.save_catalog_product(data,links,fields,stamp-interval '1 second',evidence_stamp);
  raise exception 'Stale edit accepted';
 exception when serialization_failure then null;
 end;
 perform public.save_catalog_product(data||'{"catalog_visible":false}',links,fields,stamp,evidence_stamp);
 if (select catalog_visible or recommendation_enabled or status<>'draft' from public.products where id=p) then raise exception 'Unpublishing left eligibility active'; end if;
 select updated_at into stamp from public.products where id=p;
 select updated_at into evidence_stamp from public.catalog_records where product_id=p;
 perform public.save_catalog_product(data,links,fields,stamp,evidence_stamp);
 update public.product_ingredients set notes='Changed outside CMS transaction' where product_id=p;
 if (select catalog_visible or recommendation_enabled from public.products where id=p) then raise exception 'Changed ingredients retained approval'; end if;
 -- Formula-less devices publish but never enter the topical matcher.
 data:=jsonb_build_object('brand_id',b,'name','Device fixture','slug','device-fixture-'||gen_random_uuid(),'category','device','aliases','[]'::jsonb,'catalog_visible',true);
 d:=public.save_catalog_product(data,'[]','{"product_type":"device","formula_status":"not_applicable"}',null,null);
 if not (select catalog_visible and status='verified' and not recommendation_enabled from public.products where id=d) then raise exception 'Device publishing failed'; end if;
 if exists(select 1 from jsonb_array_elements(public.get_recommendation_catalog()->'products') x where x->>'id'=d::text) then raise exception 'Device entered topical matcher'; end if;
 -- Unknown type and missing primary mappings cannot publish.
 begin
  perform public.save_catalog_product(data||jsonb_build_object('slug','unknown-fixture-'||gen_random_uuid()),'[]','{"product_type":"unknown"}',null,null);
  raise exception 'Unknown type published';
 exception when raise_exception then if sqlerrm='Unknown type published' or sqlerrm not like 'Cannot publish:%' then raise; end if; end;
 select updated_at into stamp from public.products where id=p;
 select updated_at into evidence_stamp from public.catalog_records where product_id=p;
 begin
  perform public.save_catalog_product(jsonb_build_object('id',p,'brand_id',b,'name','Publishing fixture','slug','publishing-fixture','category','serum','aliases','[]'::jsonb,'catalog_visible',true,'engine_expressions','[]'::jsonb),links,fields,stamp,evidence_stamp);
  raise exception 'Missing mappings accepted';
 exception when raise_exception then if sqlerrm='Missing mappings accepted' or sqlerrm not like 'Cannot publish:%' then raise; end if; end;
 if not exists(select 1 from public.catalog_changes where record_id=p::text and actor_id=auth.uid()) then raise exception 'No publishing audit'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","app_metadata":{}}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.catalog_records) then raise exception 'Evidence exposed to member'; end if;
 begin perform public.save_catalog_product('{"name":"Unauthorized"}','[]',null,null,null); raise exception 'Member saved catalog'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: single approval, automatic eligibility, atomic failure, stale edits, ingredient invalidation, devices, drafts, provenance and access' as tests;
rollback;
