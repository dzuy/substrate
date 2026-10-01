import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { isAppAdmin } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { listAdminUsers, type AdminUser } from '@/services/admin-users';

export function useAdminUsers() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState(isAppAdmin(user));
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setCheckingAccess(true);
    void supabase.auth.getUser().then(({ data, error }) => {
      if (active) { setAllowed(!error && isAppAdmin(data.user)); setCheckingAccess(false); }
    }).catch(() => { if (active) { setAllowed(false); setCheckingAccess(false); } });
    return () => { active = false; };
  }, [user?.id]);
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
  return { allowed, checkingAccess, users, total, loading, error, query, page,
    search: (value: string) => { setQuery(value); setPage(1); },
    setPage, refresh: () => setRevision(value => value + 1),
  };
}
