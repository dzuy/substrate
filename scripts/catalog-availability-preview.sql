-- Read-only aggregate preview. Verify project identity before running.
begin read only;
select count(*) as total_products,
 count(*) filter (where archived_at is null) as available_after,
 count(*) filter (where archived_at is null and catalog_visible) as available_before,
 count(*) filter (where archived_at is null and not catalog_visible) as newly_available,
 count(*) filter (where archived_at is not null) as archived_excluded,
 count(*) filter (where recommendation_enabled) as recommendation_enabled_unchanged,
 count(*) filter (where formula_status='full_verified') as verified_formulas_unchanged
from public.products;
select status, formula_status, catalog_visible, recommendation_enabled, count(*)
from public.products where archived_at is null
 group by status, formula_status, catalog_visible, recommendation_enabled;
select tablename, policyname, roles, cmd, qual
from pg_policies where schemaname='public' and tablename in
 ('products','catalog_records','catalog_imports','catalog_reviews','catalog_changes','catalog_engine_expressions');
rollback;
