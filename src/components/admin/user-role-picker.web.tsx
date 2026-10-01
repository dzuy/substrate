import { useState } from 'react';
import { appRoles, roleLabel, type AdminUser, type AppRole } from '@/services/admin-users';

export function UserRolePicker({ user, self, disabled, onSave }: { user: AdminUser; self: boolean; disabled: boolean; onSave: (roles: AppRole[]) => void }) {
  const [selected, setSelected] = useState<AppRole[]>(appRoles.filter(role => user.roles.includes(role)));
  const dirty = appRoles.some(role => selected.includes(role) !== user.roles.includes(role));
  return <details className="admin-role-picker"><summary>{user.roles.map(roleLabel).join(', ') || 'Select roles'}</summary><div className="admin-role-options" role="group" aria-label={`Roles for ${user.email || user.name || 'Unnamed user'}`}>
    {appRoles.map(role => <label key={role}><input type="checkbox" checked={selected.includes(role)} disabled={disabled || (self && role === 'admin')} onChange={event => setSelected(previous => event.target.checked ? [...previous, role] : previous.filter(value => value !== role))} />{roleLabel(role)}</label>)}
    <button className="cms-button" disabled={disabled || !dirty || !selected.length} onClick={() => onSave(selected)}>Save roles</button>
    {self ? <small>You cannot remove your own Admin role.</small> : null}
  </div></details>;
}
