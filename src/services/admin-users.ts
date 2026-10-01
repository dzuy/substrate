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
