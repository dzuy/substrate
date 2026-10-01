import type { User } from '@supabase/supabase-js';

export function isAppAdmin(user: User | null | undefined) {
  const metadata = user?.app_metadata;
  return metadata?.role === 'admin' || (Array.isArray(metadata?.roles) && metadata.roles.includes('admin'));
}

export function isCatalogAdmin(user: User | null | undefined) {
  const appMetadata = user?.app_metadata;
  const role = typeof appMetadata?.role === 'string' ? appMetadata.role : '';
  const roles = Array.isArray(appMetadata?.roles) ? appMetadata.roles : [];

  return role === 'admin' || role === 'catalog_admin' || roles.includes('admin') || roles.includes('catalog_admin');
}
