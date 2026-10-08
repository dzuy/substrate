-- Fingerprint the reviewed formula, so routine-support review expires on edits.
create or replace function public.get_recommendation_catalog() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('version',coalesce(max(c.updated_at)::text,'empty'),'region','unspecified','verifiedAt',coalesce(max(c.updated_at)::text,''),'products',coalesce(jsonb_agg(jsonb_build_object(
 'id',c.id,'brand',c.brand,'name',c.name,'format',coalesce(c.variant_label,c.category),'category',c.category,'sourceUrl',c.source_url,
 'formulaHash',md5(r.fields->>'ingredient_list'),
 'expressions',c.expressions,'requiredEligibleIds',(select coalesce(jsonb_agg(e->>'ingredientId'),'[]') from jsonb_array_elements(c.expressions) e where (e->>'requiredEligible')::boolean), 'note','Reviewed catalog formula; ingredient eligibility is evaluated separately'
 )),'[]')) from public.recommendation_catalog c join public.catalog_records r on r.product_id=c.id;
$$;
revoke all on function public.get_recommendation_catalog() from public,anon;
grant execute on function public.get_recommendation_catalog() to authenticated;
