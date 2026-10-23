import { supabase } from '@/lib/supabase';
import type { ProductCategory } from '@/types/database';

export type RoutineCatalogProduct = {
  id: string;
  name: string;
  category: ProductCategory;
  description: string | null;
  image_url: string | null;
  brand: { name: string } | null;
};

// Small, stable catalog selection for the visual routine, not personalized recommendations.
export async function getRoutineCatalogProducts() {
  const categories: ProductCategory[] = ['cleanser', 'serum', 'treatment', 'moisturizer', 'spf'];
  const results = await Promise.all(categories.map(async category => {
    const result = await supabase.from('products')
      .select('id,name,category,description,image_url,brand:brands(name)')
      .eq('catalog_visible', true).is('archived_at', null).eq('category', category)
      .order('image_url', { ascending: true, nullsFirst: false })
      .order('name').order('id').limit(4);
    if (result.error) throw result.error;
    return result.data as unknown as RoutineCatalogProduct[];
  }));
  return results.flat();
}
