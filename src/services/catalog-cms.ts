import { supabase } from '@/lib/supabase';
import { listCatalogProducts, type ProductInput } from '@/services/catalog';

export type CatalogRecord = {
  source_id: string;
  product_id: string | null;
  import_id: string;
  entity_type: string;
  fields: Record<string, string>;
  updated_at: string;
};

export type CatalogReview = {
  id: string;
  source_row: number;
  fields: Record<string, string>;
  status: 'OPEN' | 'RESOLVED' | 'PARTIALLY RESOLVED';
  resolution_note: string;
  updated_at: string;
};

export async function listCatalogRecords() {
  return supabase.from('catalog_records').select('*').order('source_id');
}

export async function listCatalogReviews() {
  return supabase.from('catalog_reviews').select('*').order('source_row');
}

export async function saveCatalogReview(review: CatalogReview, status: CatalogReview['status'], note: string) {
  const result = await supabase.from('catalog_reviews')
    .update({ status, resolution_note: note.trim() }).eq('id', review.id)
    .eq('updated_at', review.updated_at).select('*').maybeSingle();
  if (!result.error && !result.data) return { data: null, error: { message: 'This review changed. Reload before saving.' } };
  return result;
}

export async function saveCmsProduct(input: ProductInput & {
  catalogVisible: boolean;
  expectedUpdatedAt?: string;
  record?: CatalogRecord | null;
}) {
  const result = await supabase.rpc('save_catalog_product', {
    product_data: {
      id: input.id ?? null, brand_id: input.brandId, name: input.name.trim(),
      slug: input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      category: input.category, description: input.description ?? null,
      image_url: input.imageUrl ?? null, barcode: input.barcode ?? null, upc: input.upc ?? null,
      aliases: input.aliases ?? [], status: input.status, catalog_visible: input.catalogVisible,
    },
    ingredient_data: input.ingredients.map((i) => ({
      ingredient_id: i.ingredientId, ingredient_order: i.ingredientOrder ?? null,
      concentration: i.concentration ?? null, concentration_unit: i.concentrationUnit ?? null, notes: i.notes ?? null,
    })),
    evidence_data: input.record?.fields ?? null,
    expected_updated_at: input.expectedUpdatedAt ?? null,
    expected_evidence_updated_at: input.record?.updated_at ?? null,
  });
  if (result.error) return { data: null, error: result.error };
  const products = await listCatalogProducts({ includeArchived: true, includeUnpublished: true });
  return { data: products.data?.find((p) => p.id === result.data) ?? null, error: products.error };
}

export async function restoreProduct(productId: string) {
  return supabase.from('products').update({ archived_at: null, catalog_visible: false, status: 'needs_review' })
    .eq('id', productId).select('*').single();
}

export async function listCatalogHistory(productId: string, sourceId?: string) {
  return supabase.from('catalog_changes').select('*').in('record_id', [productId, ...(sourceId ? [sourceId] : [])])
    .order('created_at', { ascending: false }).limit(20);
}
