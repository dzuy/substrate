import { supabase } from '@/lib/supabase';
import { getCatalogProduct, type CatalogProduct, type ProductInput } from '@/services/catalog';
import { collectCatalogRows } from './catalog-pagination';

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
  const [retail, research] = await Promise.all([
    collectCatalogRows((from, to) => supabase.from('catalog_records').select('source_id,product_id,import_id,entity_type,updated_at,product_name:fields->>product_name').not('product_id','is',null).order('source_id').range(from,to)),
    collectCatalogRows<CatalogRecord>((from,to) => supabase.from('catalog_records').select('*').is('product_id',null).order('source_id').range(from,to)),
  ]);
  if(retail.error||research.error)return {data:null,error:retail.error||research.error};
  return {data:[...(retail.data??[]).map(r=>({...r,fields:{product_name:r.product_name??''}})),...(research.data??[])] as CatalogRecord[],error:null};
}

export async function listCatalogImports() {
  return collectCatalogRows((from,to) => supabase.from('catalog_imports').select('id,title:snapshot->source->>title').order('id').range(from,to));
}

export async function getCatalogRecord(productId: string) {
  return supabase.from('catalog_records').select('*').eq('product_id', productId).maybeSingle();
}

export type EngineExpression = { ingredient_id: string; engine_ingredient_id: string; role: 'primary' | 'support'; required_eligible: boolean; approved: boolean };
export async function getCatalogExpressions(productId: string) {
  return supabase.from('catalog_engine_expressions').select('*').eq('product_id', productId).order('engine_ingredient_id');
}
export async function getCatalogSources(productId: string) {
  return collectCatalogRows((from, to) => supabase.from('catalog_sources').select('*').eq('product_id', productId).order('source_id').range(from, to));
}

export async function listCmsProductPage(filters: Record<string, string | boolean>, page: number) {
  const result = await supabase.rpc('search_catalog_products', { filters, page_index: page, page_size: 25 });
  return { data: result.data as { products: CatalogProduct[]; total: number; counts: Record<string, number> } | null, error: result.error };
}

export async function listCatalogReviews() {
  return collectCatalogRows<CatalogReview>((from, to) => supabase.from('catalog_reviews').select('*').order('source_row').order('id').range(from, to));
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
  engineExpressions?: EngineExpression[];
  recommendationEnabled?: boolean;
}) {
  const result = await supabase.rpc('save_catalog_product', {
    product_data: {
      id: input.id ?? null, brand_id: input.brandId, name: input.name.trim(),
      slug: input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      category: input.category, description: input.description ?? null,
      image_url: input.imageUrl ?? null, barcode: input.barcode ?? null, upc: input.upc ?? null,
      aliases: input.aliases ?? [], status: input.status, catalog_visible: input.catalogVisible,
      ...(input.engineExpressions ? { engine_expressions: input.engineExpressions } : {}),
      ...(input.recommendationEnabled !== undefined ? { recommendation_enabled: input.recommendationEnabled } : {}),
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
  return getCatalogProduct(result.data);
}

export async function restoreProduct(productId: string) {
  return supabase.from('products').update({ archived_at: null, catalog_visible: false, recommendation_enabled:false, status: 'needs_review' })
    .eq('id', productId).select('*').single();
}

export async function listCatalogHistory(productId: string, sourceId?: string) {
  return supabase.from('catalog_changes').select('*').in('record_id', [productId, ...(sourceId ? [sourceId] : [])])
    .order('created_at', { ascending: false }).limit(20);
}
