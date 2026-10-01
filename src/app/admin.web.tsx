import { Box, ChevronLeft, ChevronRight, Layers, RefreshCw, Search, Users } from 'lucide-react-native';
import { useAdminUsers } from '@/components/admin/use-admin-users';
import '@/components/admin/catalog-workspace.css';
import '@/components/admin/admin-home.css';

const date = (value: string | null) => value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Never';
const roleLabel = (role: string) => role === 'admin' ? 'Administrator' : role === 'catalog_admin' ? 'Catalog admin' : role === 'user' ? 'User' : role;

export default function AdminHome() {
  const state = useAdminUsers();
  if (state.checkingAccess) return <div className="cms cms-access" role="status">Checking administrator access…</div>;
  if (!state.allowed) return <div className="cms cms-access"><Users size={30} color="#795365" /><h1>Administrator access required</h1><p>User management is available to app administrators.</p><a href="/profile">Return to your account</a></div>;
  const pages = Math.max(1, Math.ceil(state.total / 25));
  const start = (state.page - 1) * 25 + 1;
  return <div className="cms admin-home">
    <header className="cms-topbar"><a href="/admin" className="cms-wordmark"><div className="cms-mark"><Layers size={19} color="#fff" /></div><strong>substrate<span>/</span></strong><span className="cms-admin-label">ADMIN</span></a><a className="cms-button" href="/profile">My account</a></header>
    <div className="cms-body">
      <aside className="cms-sidebar" aria-label="Administration"><div className="cms-rail-heading">WORKSPACE</div><nav className="cms-nav"><a href="/admin" className="cms-nav-item active" aria-current="page"><Users size={17} /><span>Users</span></a><a href="/admin-products" className="cms-nav-item"><Box size={17} /><span>Product catalog</span></a></nav></aside>
      <main className="admin-content">
        <div className="admin-heading"><div><p className="admin-eyebrow">ADMINISTRATION</p><h1>Users</h1><p>People with a Substrate account and their app roles.</p></div><button className="cms-button" disabled={state.loading} onClick={state.refresh}><RefreshCw size={15} />Refresh</button></div>
        <section className="admin-user-panel" aria-label="User directory" aria-busy={state.loading}>
          <div className="admin-toolbar"><div><strong>User directory</strong><span>{state.loading ? 'Loading…' : `${state.total} ${state.total === 1 ? 'user' : 'users'}${state.query ? ' matching your search' : ''}`}</span></div><label className="admin-search"><Search size={16} color="#8d7e87" /><input aria-label="Search users" value={state.query} onChange={event => state.search(event.target.value)} maxLength={200} placeholder="Search by name, email, or ID" /></label></div>
          {state.error ? <div className="admin-message" role="alert"><strong>Users couldn’t be loaded</strong><p>{state.error}</p><button className="cms-button" onClick={state.refresh}>Try again</button></div> : <div className="admin-table-scroll"><table className="cms-table admin-users-table"><thead><tr><th>User</th><th>Roles</th><th>Email status</th><th>Joined</th><th>Last sign-in</th></tr></thead><tbody>
            {state.users.map(user => <tr key={user.id}><td><strong>{user.name || user.email || 'Unnamed user'}</strong>{user.name && user.email ? <span>{user.email}</span> : null}<small title={user.id}>{user.id}</small></td><td><div className="admin-roles">{user.roles.map(role => <span key={role} className={`cms-badge ${role === 'admin' ? 'green' : 'neutral'}`}>{roleLabel(role)}</span>)}</div></td><td><span className={`cms-badge ${user.email_confirmed ? 'green' : 'amber'}`}>{user.email_confirmed ? 'Verified' : 'Unverified'}</span></td><td>{date(user.created_at)}</td><td>{date(user.last_sign_in_at)}</td></tr>)}
            {!state.users.length ? <tr><td colSpan={5}><div className="admin-message" role="status">{state.loading ? 'Loading users…' : state.query ? 'No users match your search.' : 'No users yet.'}</div></td></tr> : null}
          </tbody></table></div>}
          <div className="cms-table-footer"><span>{!state.error && !state.loading && state.total ? `${start}–${Math.min(state.page * 25, state.total)} of ${state.total}` : 'User directory'}</span><div className="cms-pagination"><button aria-label="Previous users page" disabled={state.loading || state.page === 1} onClick={() => state.setPage(state.page - 1)}><ChevronLeft size={14} /></button><span>Page {state.page} of {pages}</span><button aria-label="Next users page" disabled={state.loading || !!state.error || state.page >= pages} onClick={() => state.setPage(state.page + 1)}><ChevronRight size={14} /></button></div></div>
        </section>
      </main>
    </div>
  </div>;
}
