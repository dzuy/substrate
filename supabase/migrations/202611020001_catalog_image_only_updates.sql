-- Approved and applied 2026-11-02. Preserve existing review/eligibility on image-only updates.
create or replace function public.guard_catalog_recommendations() returns trigger
language plpgsql security invoker set search_path='' as $$
declare issues text[];
begin
 -- Product photography is not a publication or formula-review decision.
 -- Compare the entire row so future columns default to the guarded path.
 if TG_OP = 'UPDATE' then
  if new.image_url is distinct from old.image_url
   and (to_jsonb(new) - 'image_url' - 'updated_at')
       is not distinct from (to_jsonb(old) - 'image_url' - 'updated_at') then
   return new;
  end if;
 end if;
 if new.archived_at is not null then new.catalog_visible:=false; end if;
 if new.catalog_visible then
  if TG_OP='INSERT' then raise exception 'Save a draft before publishing.'; end if;
  if not old.catalog_visible then
   issues:=public.catalog_publish_issues(new.id);
   if cardinality(issues)>0 then raise exception 'Cannot publish: %',array_to_string(issues,' '); end if;
  end if;
  new.status:='verified';
 else new.status:='draft'; end if;
 new.recommendation_enabled:=new.catalog_visible and new.archived_at is null and new.product_type='topical' and not new.is_bundle and new.formula_status='full_verified'
  and exists(select 1 from public.catalog_engine_expressions e join public.product_ingredients pi on pi.product_id=e.product_id and pi.ingredient_id=e.ingredient_id where e.product_id=new.id and e.approved and e.role='primary')
  and not exists(select 1 from public.catalog_engine_expressions e where e.product_id=new.id and (not e.approved or not exists(select 1 from public.product_ingredients pi where pi.product_id=e.product_id and pi.ingredient_id=e.ingredient_id)))
  and exists(select 1 from public.catalog_records r where r.product_id=new.id and r.fields->>'product_url' ~ '^https?://');
 return new;
end $$;
