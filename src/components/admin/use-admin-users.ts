import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { isAppAdmin } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { listAdminUsers, setAdminUserRoles, deleteAdminUser, type AppRole, type AdminUser } from '@/services/admin-users';

export function useAdminUsers() {
  const { user } = useAuth();
  const metadataAllowsAdmin = isAppAdmin(user);
  const [allowed, setAllowed] = useState(isAppAdmin(user));
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const actionInProgress = useRef(false);
  async function manage(action: () => Promise<void>, message: string) {
    if (actionInProgress.current) return false;
    actionInProgress.current = true;
    setSaving(true); setActionError(''); setNotice('');
    try {
      await action();
      setNotice(message); setPage(1); setRevision(value => value + 1);
      return true;
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : 'Unable to update this account.');
      return false;
    } finally { actionInProgress.current = false; setSaving(false); }
  }
  useEffect(() => {
    let active = true;
    setCheckingAccess(true);
    void supabase.auth.getUser().then(({ data, error }) => {
      if (active) { setAllowed(!error && isAppAdmin(data.user)); setCheckingAccess(false); }
    }).catch(() => { if (active) { setAllowed(false); setCheckingAccess(false); } });
    return () => { active = false; };
  }, [user?.id, metadataAllowsAdmin]);
  useEffect(() => {
    let active = true;
    setUsers([]);
    setTotal(0);
    setError('');
    setLoading(allowed);
    if (!allowed) return;
    const timer = setTimeout(() => {
      void listAdminUsers(page, query).then(result => {
        if (!active) return;
        setUsers(result.users);
        setTotal(result.total);
      }).catch((failure: Error) => {
        if (active) setError(failure.message);
      }).finally(() => {
        if (active) setLoading(false);
      });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [allowed, user?.id, query, page, revision]);
  return { currentUserId: user?.id, saving, actionError, notice,
    assignRoles: (id: string, roles: AppRole[]) => manage(() => setAdminUserRoles(id, roles), 'Roles updated.'),
    deleteUser: (id: string) => manage(() => deleteAdminUser(id), 'User deleted.'),
    clearActionError: () => setActionError(''), allowed, checkingAccess, users, total, loading, error, query, page,
    search: (value: string) => { setQuery(value); setPage(1); },
    setPage, refresh: () => setRevision(value => value + 1),
  };
}
