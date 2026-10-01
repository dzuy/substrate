import { supabase } from '@/lib/supabase';

export type AdminUser = {
  id: string;
  email: string | null;
  name: string | null;
  roles: string[];
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
};

export async function listAdminUsers(page: number, query: string) {
  const { data, error } = await supabase.rpc('list_admin_users', { page_index: page, page_size: 25, search_query: query.trim() });
  if (error) {
    if (error.code === '42501') throw new Error('Administrator access required.');
    if (error.code === 'PGRST202') throw new Error('User administration is not configured yet. Apply the admin users database migration.');
    throw new Error('Unable to load users. Please try again.');
  }
  return data as unknown as { users: AdminUser[]; total: number };
}

export const appRoles = ['admin', 'catalog_admin', 'user'] as const;
export type AppRole = typeof appRoles[number];
export const roleLabel = (role: string) => role === 'admin' ? 'Admin' : role === 'catalog_admin' ? 'Catalog Admin' : role === 'user' ? 'User' : role;


function managementError(error: { code?: string; message: string }) {
  if (error.code === 'PGRST202') return new Error('User management is not configured yet. Apply the user management database migration.');
  if (error.code === '42501') return new Error('Administrator access required.');
  if (error.code === '22023' || error.code === 'P0002') return new Error(error.message);
  if (error.code === '23503') return new Error('This account has linked records or uploaded files that must be removed before deletion.');
  return new Error('Unable to update this account. Please try again.');
}
export async function setAdminUserRoles(id: string, roles: AppRole[]) {
  const { error } = await supabase.rpc('set_admin_user_roles', { target_user_id: id, assigned_roles: roles });
  if (error) throw managementError(error);
}
export async function deleteAdminUser(id: string) {
  const { error } = await supabase.rpc('delete_admin_user', { target_user_id: id });
  if (error) throw managementError(error);
}
