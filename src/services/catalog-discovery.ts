import { supabase } from '@/lib/supabase';
import type { CatalogProduct } from './catalog';

/** Identity fields only. Formula/description details are fetched for matched products. */
export type CatalogDiscoveryProduct = Pick<CatalogProduct,
  'id' | 'name' | 'category' | 'image_url' | 'aliases' | 'status'> & {
  brand: { name: string } | null;
};

const fields = 'id,name,category,image_url,aliases,status,brand:brands(name)';
const ttl = 5 * 60 * 1000;
let cache: { userId: string; expiresAt: number; data: CatalogDiscoveryProduct[] } | undefined;

export function invalidateCatalogDiscovery() {
  cache = undefined;
}

export async function listCatalogDiscoveryProducts(userId: string, signal: AbortSignal) {
  if (signal.aborted) throw new Error('Catalog loading canceled.');
  if (cache?.userId === userId && cache.expiresAt > Date.now()) {
    return { data: cache.data, error: null };
  }
  // Never reuse another member's RLS-filtered result.
  cache = undefined;
  const rows: CatalogDiscoveryProduct[] = [];
  const size = 500;
  // Bounded parallel pages reduce round trips without increasing provider row limits.
  for (let from = 0; ; from += size * 4) {
    const pages = await Promise.all(Array.from({ length: 4 }, (_, index) => {
      const start = from + index * size;
      return supabase.from('products').select(fields).is('archived_at', null)
        .order('name').order('id').range(start, start + size - 1).abortSignal(signal);
    }));
    if (signal.aborted) throw new Error('Catalog loading canceled.');
    const failed = pages.find(page => page.error);
    if (failed) return { data: null, error: failed.error };
    for (const page of pages) {
      rows.push(...(page.data ?? []));
      if ((page.data?.length ?? 0) < size) {
        cache = { userId, expiresAt: Date.now() + ttl, data: rows };
        return { data: rows, error: null };
      }
    }
  }
}
