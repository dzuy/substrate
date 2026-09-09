-- Run against an imported catalog. Every test mutation is rolled back.
begin;
do $$
begin
  if (select count(*) from public.catalog_records) <> 285 then raise exception 'Canonical count mismatch'; end if;
  if (select count(*) from public.catalog_records where product_id is not null) <> 192 then raise exception 'Retail count mismatch'; end if;
  if (select count(*) from public.catalog_reviews) <> 411 then raise exception 'Review count mismatch'; end if;
  if exists (select 1 from public.catalog_records where product_id is not null and entity_type not in ('Finished Product','Multi-step System / Kit')) then raise exception 'Non-retail entity entered products'; end if;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{"roles":["catalog_admin"]}}', true);
set local role authenticated;
do $$
declare p public.products; r public.catalog_records; product_json jsonb; original_count integer;
begin
  select * into r from public.catalog_records where source_id = 'SKP-0081';
  select * into p from public.products where id = r.product_id;
  if p.id <> '00000000-0000-4000-8000-000000000301' then raise exception 'Existing C E Ferulic ID changed'; end if;
  product_json := to_jsonb(p) || jsonb_build_object('name', 'Transaction test');
  select count(*) into original_count from public.product_ingredients where product_id = p.id;
  begin
    perform public.save_catalog_product(product_json,
      '[{"ingredient_id":"ffffffff-ffff-4fff-8fff-ffffffffffff"}]'::jsonb,
      r.fields, p.updated_at, r.updated_at);
    raise exception 'Invalid ingredient was accepted';
  exception when foreign_key_violation then null;
  end;
  if (select name from public.products where id = p.id) <> p.name then raise exception 'Failed save changed product'; end if;
  if (select count(*) from public.product_ingredients where product_id = p.id) <> original_count then raise exception 'Failed save removed ingredients'; end if;
  begin
    perform public.save_catalog_product(product_json, '[]', r.fields, p.updated_at - interval '1 second', r.updated_at);
    raise exception 'Stale product edit was accepted';
  exception when serialization_failure then null;
  end;
  begin
    perform public.save_catalog_product(product_json, '[]', r.fields, p.updated_at, r.updated_at - interval '1 second');
    raise exception 'Stale evidence edit was accepted';
  exception when serialization_failure then null;
  end;
  perform public.save_catalog_product(product_json, '[]', r.fields || '{"notes":"CMS transaction test"}'::jsonb, p.updated_at, r.updated_at);
  if (select name from public.products where id = p.id) <> 'Transaction test' then raise exception 'Admin save did not persist'; end if;
  if (select fields->>'notes' from public.catalog_records where source_id = r.source_id) <> 'CMS transaction test' then raise exception 'Evidence not saved'; end if;
  if not exists(select 1 from public.catalog_changes where record_id=p.id::text and actor_id=auth.uid()) then raise exception 'No actor audit'; end if;
end;
$$;
reset role;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","app_metadata":{}}', true);
set local role authenticated;
do $$
begin
  if exists(select 1 from public.catalog_records) then raise exception 'Evidence leaked to member'; end if;
  if exists(select 1 from public.catalog_reviews) then raise exception 'Review queue leaked to member'; end if;
  if exists(select 1 from public.catalog_changes) then raise exception 'History leaked to member'; end if;
  if exists(select 1 from public.products where not catalog_visible) then raise exception 'Unpublished product leaked to member'; end if;
  begin
    perform public.save_catalog_product('{"name":"Unauthorized"}', '[]', null, null, null);
    raise exception 'Non-admin save accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
select 'PASS: counts, identity preservation, atomic save, stale edits, audit, and member access' as tests;
rollback;
