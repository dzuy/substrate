-- Personal label entries are unverified, private, and excluded from the shared catalog.
alter table public.products add column owner_user_id uuid references auth.users(id) on delete cascade;
alter table public.brands add column owner_user_id uuid references auth.users(id) on delete cascade;

alter policy "Authenticated users can read brands" on public.brands
using (owner_user_id is null or owner_user_id = auth.uid() or public.is_catalog_admin());
alter policy "Users read published products or their wardrobe references" on public.products
using (public.is_catalog_admin() or owner_user_id = auth.uid() or (owner_user_id is null and
  (archived_at is null or exists(select 1 from public.user_wardrobe_items w where w.product_id = products.id and w.user_id = auth.uid()))));

create function public.can_add_wardrobe_product(target uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.products where id = target and (owner_user_id is null or owner_user_id = auth.uid()));
$$;
revoke all on function public.can_add_wardrobe_product(uuid) from public;
grant execute on function public.can_add_wardrobe_product(uuid) to authenticated;
alter policy "Users can insert own wardrobe" on public.user_wardrobe_items
with check (auth.uid() = user_id and public.can_add_wardrobe_product(product_id));
alter policy "Users can update own wardrobe" on public.user_wardrobe_items
with check (auth.uid() = user_id and public.can_add_wardrobe_product(product_id));

create function public.save_personal_wardrobe_product(brand text, product_name text, description text default '', ingredients text[] default '{}') returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); bid uuid; pid uuid;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if length(trim(brand)) not between 1 and 200 or length(trim(product_name)) not between 1 and 300 or length(coalesce(description,'')) > 4000 or cardinality(ingredients) > 100 then raise exception 'Check product details'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || lower(trim(brand)) || ':' || lower(trim(product_name)),0));
  select p.id into pid from public.products p join public.brands b on b.id=p.brand_id
  where p.owner_user_id=uid and lower(p.name)=lower(trim(product_name)) and lower(b.name)=lower(trim(brand)) limit 1;
  if pid is null then
    insert into public.brands(name,owner_user_id) values(trim(brand),uid) returning id into bid;
    insert into public.products(brand_id,name,category,description,status,archived_at,owner_user_id)
    values(bid,trim(product_name),'other',nullif(trim(description),''),'needs_review',now(),uid) returning id into pid;
  end if;
  insert into public.user_wardrobe_items(user_id,product_id,notes)
  values(uid,pid,case when cardinality(ingredients)>0 then 'User-entered label ingredients (unverified): ' || array_to_string(ingredients,', ') end)
  on conflict(user_id,product_id) do nothing;
  return pid;
end;
$$;
revoke all on function public.save_personal_wardrobe_product(text,text,text,text[]) from public;
grant execute on function public.save_personal_wardrobe_product(text,text,text,text[]) to authenticated;
