import { Link } from 'expo-router';
import { UserRolePicker } from '@/components/admin/user-role-picker.web';
import { useState } from 'react';
import { roleLabel, type AdminUser, type AppRole } from '@/services/admin-users';
import { Box, ChevronLeft, ChevronRight, Layers, RefreshCw, Search, Trash2, Users } from 'lucide-react-native';
import { useAdminUsers } from '@/components/admin/use-admin-users';
import { AuthScreen } from '@/components/auth-screen';
import '@/components/admin/catalog-workspace.css';
import '@/components/admin/admin-home.css';



export default function AdminHome() {
  const state = useAdminUsers();
  const [pending, setPending] = useState<{ user: AdminUser; roles?: AppRole[] } | null>(null);
  async function confirm() {
    if (!pending) return;
    const success = pending.roles ? await state.assignRoles(pending.user.id, pending.roles) : await state.deleteUser(pending.user.id);
    if (success) setPending(null);
  }
  if (state.checkingAccess) return <div className="cms cms-access" role="status">Checking administrator access…</div>;
  if (!state.allowed) return <AuthScreen admin />;
  const pages = Math.max(1, Math.ceil(state.total / 25));
  const start = (state.page - 1) * 25 + 1;
  return <div className="cms admin-home">
    <header className="cms-topbar" inert={!!pending}><a href="/admin" className="cms-wordmark"><div className="cms-mark"><Layers size={19} color="#fff" /></div><strong>substrate<span>/</span></strong><span className="cms-admin-label">ADMIN</span></a><a className="cms-button" href="/profile">My account</a></header>
    <div className="cms-body">
      <aside inert={!!pending} className="cms-sidebar" aria-label="Administration"><div className="cms-rail-heading">WORKSPACE</div><nav className="cms-nav"><a href="/admin" className="cms-nav-item active" aria-current="page"><Users size={17} /><span>Users</span></a><Link href="/admin-products" asChild><a className="cms-nav-item"><Box size={17} /><span>Product catalog</span></a></Link></nav></aside>
      <main className="admin-content">
        <div inert={!!pending} className="admin-heading"><div><p className="admin-eyebrow">ADMINISTRATION</p><h1>Users</h1><p>People with a Substrate account and their app roles.</p></div><button className="cms-button" disabled={state.loading || state.saving || !!pending} onClick={state.refresh}><RefreshCw size={15} />Refresh</button></div>
        {state.notice ? <p role="status" className="admin-feedback">{state.notice}</p> : null}
        {state.actionError && !pending ? <p role="alert" className="admin-feedback">{state.actionError}</p> : null}
        <section inert={!!pending} className="admin-user-panel" aria-label="User directory" aria-busy={state.loading}>
          <div className="admin-toolbar"><div><strong>User directory</strong><span>{state.loading ? 'Loading…' : `${state.total} ${state.total === 1 ? 'user' : 'users'}${state.query ? ' matching your search' : ''}`}</span></div><label className="admin-search"><Search size={16} color="#8d7e87" /><input aria-label="Search users" value={state.query} onChange={event => state.search(event.target.value)} maxLength={200} placeholder="Search by name or email" /></label></div>
          {state.error ? <div className="admin-message" role="alert"><strong>Users couldn’t be loaded</strong><p>{state.error}</p><button className="cms-button" onClick={state.refresh}>Try again</button></div> : <div className="admin-table-scroll"><table className="cms-table admin-users-table"><thead><tr><th>User</th><th>Roles</th><th>Actions</th></tr></thead><tbody>
            {state.users.map(user => <tr key={user.id}><td><strong>{user.name || user.email || 'Unnamed user'}</strong>{user.name && user.email ? <span>{user.email}</span> : null}</td><td><UserRolePicker key={user.roles.join(',')} user={user} self={user.id === state.currentUserId} disabled={state.saving || !!pending} onSave={roles => { state.clearActionError(); setPending({ user, roles }); }} />{user.id === state.currentUserId ? <small className="admin-self">Your account</small> : null}</td><td><button className="cms-button admin-delete" aria-label={`Delete ${user.email || user.name || 'Unnamed user'}`} disabled={state.saving || !!pending || user.id === state.currentUserId} onClick={() => { state.clearActionError(); setPending({ user }); }}><Trash2 size={16} /></button></td></tr>)}
            {!state.users.length ? <tr><td colSpan={3}><div className="admin-message" role="status">{state.loading ? 'Loading users…' : state.query ? 'No users match your search.' : 'No users yet.'}</div></td></tr> : null}
          </tbody></table></div>}
          <div className="cms-table-footer"><span>{!state.error && !state.loading && state.total ? `${start}–${Math.min(state.page * 25, state.total)} of ${state.total}` : 'User directory'}</span><div className="cms-pagination"><button aria-label="Previous users page" disabled={state.loading || state.page === 1} onClick={() => state.setPage(state.page - 1)}><ChevronLeft size={14} /></button><span>Page {state.page} of {pages}</span><button aria-label="Next users page" disabled={state.loading || !!state.error || state.page >= pages} onClick={() => state.setPage(state.page + 1)}><ChevronRight size={14} /></button></div></div>
        </section>
        {pending ? <div className="admin-modal-backdrop"><div className="admin-confirm" role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title" onKeyDown={event => { if (event.key === 'Escape' && !state.saving) setPending(null); }}>
          <h2 id="admin-confirm-title">{pending.roles ? 'Change roles?' : 'Delete user permanently?'}</h2>
          <p><strong>{pending.user.email || pending.user.name || 'Unnamed user'}</strong></p>
          <p>{pending.roles ? `Assign ${pending.roles.map(roleLabel).join(', ')} access to this account?` : 'This permanently deletes the account and its linked profile and personal app data. This cannot be undone.'}</p>

          {state.actionError ? <p role="alert">{state.actionError}</p> : null}
          <div className="admin-confirm-actions"><button autoFocus className="cms-button" disabled={state.saving} onClick={() => setPending(null)}>Cancel</button><button className={`cms-button ${pending.roles ? '' : 'admin-delete'}`} disabled={state.saving} onClick={() => void confirm()}>{state.saving ? 'Saving…' : pending.roles ? 'Save roles' : 'Delete permanently'}</button></div>
        </div></div> : null}
      </main>
    </div>
  </div>;
}
