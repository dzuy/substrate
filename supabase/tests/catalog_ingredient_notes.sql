-- Read-only invariants and rollback-only function checks after the ingredient-note migration.
begin;
do $$
declare original text:='KEY INGREDIENTS — PARTIAL, NOT FULL INCI'; cleaned jsonb;
begin
 cleaned:=public.normalize_catalog_ingredient_fields(jsonb_build_object('ingredient_list',original,'formula_status','partial','ingredient_source_notes','Earlier source note'));
 if cleaned->>'ingredient_list'<>'' or cleaned->>'formula_status'<>'missing' or cleaned->>'ingredient_source_notes'<>E'Earlier source note\n'||original then raise exception 'Source note was not separated and preserved'; end if;
 if public.normalize_catalog_ingredient_fields(cleaned)<>cleaned then raise exception 'Normalization is not idempotent'; end if;
 if public.normalize_catalog_ingredient_fields('{"ingredient_list":"Water, Glycerin","formula_status":"partial"}')<>'{"ingredient_list":"Water, Glycerin","formula_status":"partial"}'::jsonb then raise exception 'Real ingredients changed'; end if;
 if public.normalize_catalog_ingredient_fields('{"ingredient_list":"PARTIAL — Water, Glycerin","formula_status":"partial"}')<>'{"ingredient_list":"PARTIAL — Water, Glycerin","formula_status":"partial"}'::jsonb then raise exception 'Mixed ingredients changed'; end if;
 if public.normalize_catalog_ingredient_fields('{"ingredient_list":"N/A — DEVICE","product_type":"device","formula_status":"not_applicable"}')->>'formula_status'<>'not_applicable' then raise exception 'Device classification changed'; end if;
 if exists(select 1 from public.catalog_records where product_id is not null and public.catalog_ingredient_note_only(fields->>'ingredient_list')) then raise exception 'Note-only product formulas remain'; end if;
 if exists(select 1 from public.catalog_records r join public.products p on p.id=r.product_id where r.fields ? 'ingredient_source_notes' and nullif(btrim(r.fields->>'ingredient_list'),'') is null and (r.fields->>'formula_status' not in ('missing','not_applicable') or p.formula_status<>r.fields->>'formula_status')) then raise exception 'Canonical/product status mismatch'; end if;
end $$;
select 'PASS: note separation, preserved prose, missing status, actual/mixed ingredients, devices and idempotence' as tests;
rollback;
