-- Keep status prose separate from actual formula text; original snapshots remain immutable.
create function public.catalog_ingredient_note_only(value text) returns boolean
language sql immutable set search_path='' as $function$
 select coalesce(regexp_replace(btrim(value),'\s+',' ','g') ~* $note_regex$^(?:KEY INGREDIENTS\s*[—–-]\s*PARTIAL,?\s*NOT FULL INCI|INCI NOT PUBLISHED\s*[—–-]\s*DO NOT INFER|FULL INCI\s*[—–-]\s*verified in Evereden official centralized INCI library|NEEDS_MANUFACTURER_VERIFICATION|DRUG FACTS ACTIVES VERIFIED\s*[—–-]\s*FULL INACTIVE INCI REQUIRES BACKFILL|NOT VERIFIED\s*[—–-]\s*(?:record newly created, INCI not yet sourced|(?:full INCI not retrieved this pass|full INCI not published by any source located|no ingredient list located this pass)\.?)(?:\s*Third-party count:\s*\d+ ingredients\.?)?|PARTIAL\s*[—–-]\s*\d+ ingredients confirmed by count; full INCI not retrieved this pass\.?|Full ingredient list not published on the accessible current official page\.?|(?:Complete|Full)(?: current)?(?: official)?(?: current)?(?: ordered)? INCI (?:was )?not (?:completely )?captured in accessible (?:current )?(?:official )?(?:collection |product/search |page |search )?text(?: during this pass)?\.?|Official manufacturer full INCI not captured in accessible source\.?|Official current (?:page|pages|product page) (?:exposes?|provides?) key ingredients(?: and claims| and marketing functions| and their marketing functions)?(?: but |, but | and use but )(?:(?:a )?complete(?: ordered)? INCI|complete ordered INCI) (?:was )?not captured in accessible (?:current )?(?:page )?text\.?|Official (?:current )?page (?:publishes named key ingredients and their marketing functions, but does not expose|exposes key ingredients and marketing functions but not) a complete ordered INCI in accessible current text\.?|Official site confirms principal formula components, but complete current INCI was not captured in accessible text during this pass\.?|Official product identity and aromatic profile verified; complete current official INCI not captured in accessible text during this pass\.?|N/A(?:\s*/\s*treatment-specific|\s*[—–-]\s*(?:DEVICE(?:\s*/\s*TOOL)?|TOOL|TEXTILE ACCESSORY))|NOT APPLICABLE\s*[—–-]\s*(?:generic family reference|generic category(?:, not a specific SKU)?|Rx (?:reference|molecule reference); vehicle varies by manufacturer|in-clinic procedure, not a retail product|hydrocolloid dressing; no formulated INCI|extraction artifact|Rx product; vehicle and labelling are prescriber- and manufacturer-specific|brand reference, not a SKU))$$note_regex$,false);
$function$;
create function public.normalize_catalog_ingredient_fields(value jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare original text:=value->>'ingredient_list';
begin
 if public.catalog_ingredient_note_only(original) then
  value:=jsonb_set(value,'{ingredient_source_notes}',to_jsonb(concat_ws(E'\n',nullif(value->>'ingredient_source_notes',''),original)));
  value:=jsonb_set(value,'{ingredient_list}','""');
 end if;
 if nullif(btrim(value->>'ingredient_list'),'') is null then
  value:=jsonb_set(value,'{formula_status}',to_jsonb(case when value->>'formula_status'='not_applicable' or value->>'product_type' in ('device','accessory') then 'not_applicable' else 'missing' end));
 end if;
 return value;
end $$;
create function public.normalize_catalog_ingredient_record() returns trigger
language plpgsql security invoker set search_path='' as $$
begin new.fields:=public.normalize_catalog_ingredient_fields(new.fields); return new; end $$;
create trigger catalog_ingredient_normalize before insert or update on public.catalog_records
for each row execute function public.normalize_catalog_ingredient_record();

create or replace function public.sync_catalog_metadata() returns trigger
language plpgsql security invoker set search_path='' as $$
declare f jsonb := new.fields; formula_changed boolean;
begin
  if new.product_id is null then return new; end if;
  formula_changed := TG_OP='UPDATE' and (old.fields->>'ingredient_list' is distinct from f->>'ingredient_list');
  if formula_changed then
    new.fields := jsonb_set(new.fields,'{formula_status}',to_jsonb(case when nullif(btrim(f->>'ingredient_list'),'') is null then case when f->>'formula_status'='not_applicable' or f->>'product_type' in ('device','accessory') then 'not_applicable' else 'missing' end else 'unresolved' end));
    new.fields := jsonb_set(new.fields,'{formula_verification_status}','"Formula changed; reparse and verify ingredients"');
    f := new.fields;
    update public.catalog_engine_expressions set approved=false where product_id=new.product_id;
  end if;
  update public.products set
    product_type=coalesce(nullif(f->>'product_type',''),product_type),
    is_bundle=coalesce(nullif(f->>'is_bundle','')::boolean,is_bundle),
    variant_label=nullif(f->>'variant',''), market=nullif(f->>'primary_market',''),
    manufacturer_sku=nullif(f->>'manufacturer_sku',''),
    price_amount=nullif(f->>'price_amount','')::numeric,
    currency=nullif(f->>'currency',''),availability=nullif(f->>'availability',''),
    formula_status=coalesce(nullif(f->>'formula_status',''),formula_status),
    catalog_visible=case when formula_changed or (TG_OP='UPDATE' and (old.fields->>'formula_status' is distinct from f->>'formula_status' or old.fields->>'product_type' is distinct from f->>'product_type' or old.fields->>'is_bundle' is distinct from f->>'is_bundle')) then false else catalog_visible end,
    recommendation_enabled=case when formula_changed then false else recommendation_enabled end
  where id=new.product_id;
  return new;
end $$;


-- Skip research-only entities; clean only formula fields belonging to actual products.
-- Never remove actual ingredient associations or rewrite immutable source rows.
do $$ begin
 if exists(select 1 from public.catalog_records r where r.product_id is not null and public.catalog_ingredient_note_only(r.fields->>'ingredient_list') and exists(select 1 from public.product_ingredients pi where pi.product_id=r.product_id)) then raise exception 'Note-only formula has ingredient links; inspect before cleanup'; end if;
 if exists(select 1 from public.catalog_records r join public.products p on p.id=r.product_id where public.catalog_ingredient_note_only(r.fields->>'ingredient_list') and p.catalog_visible) then raise exception 'A note-only product is published; inspect before cleanup'; end if;
end $$;
update public.catalog_records set fields=public.normalize_catalog_ingredient_fields(fields)
where product_id is not null and public.catalog_ingredient_note_only(fields->>'ingredient_list');
