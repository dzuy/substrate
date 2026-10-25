-- Approved production rollout: 2026-10-25. Availability does not confer review approval.
-- Every canonical products row is available in development unless deliberately archived.
-- Held/unresolved research rows without a product_id remain private evidence.
-- No product updates/backfill: publication, formula verification and recommendation
-- approval remain exactly as stored, including for future draft imports.
alter policy "Users read published products or their wardrobe references"
on public.products using (
  public.is_catalog_admin()
  or archived_at is null
  or exists (
    select 1 from public.user_wardrobe_items w
    where w.product_id = products.id and w.user_id = auth.uid()
  )
);
