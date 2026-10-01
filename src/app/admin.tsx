import { Trash2 } from 'lucide-react-native';
import { Link, type Href } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useAdminUsers } from '@/components/admin/use-admin-users';
import { appRoles, roleLabel, type AdminUser, type AppRole } from '@/services/admin-users';
import { AuthScreen } from '@/components/auth-screen';
import { AppShell, Card, ScreenHeader, SubstrateText } from '@/components/substrate-ui';

export default function AdminHome() {
  const state = useAdminUsers();
  function confirmRoles(user: AdminUser, roles: AppRole[]) {
    Alert.alert('Change roles?', `Assign ${roles.map(roleLabel).join(', ')} to ${user.email || user.name || 'Unnamed user'}?`, [
      { text: 'Cancel', style: 'cancel' }, { text: 'Save roles', onPress: () => { void state.assignRoles(user.id, roles); } },
    ]);
  }
  function confirmDelete(user: AdminUser) {
    Alert.alert('Delete user permanently?', `Delete ${user.email || user.name || 'Unnamed user'}? This permanently deletes the account and its linked profile and personal app data. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' }, { text: 'Delete permanently', style: 'destructive', onPress: () => { void state.deleteUser(user.id); } },
    ]);
  }
  if (state.checkingAccess) return <ActivityIndicator />;
  if (!state.allowed) return <AuthScreen admin />;
  return <AppShell><ScreenHeader eyebrow="Administration" title="Users" body="Substrate accounts and app roles." />
    <Link href={'/admin-products' as Href}>Product catalog</Link>
    <Card>
      <TextInput accessibilityLabel="Search users" placeholder="Search users" value={state.query} onChangeText={state.search} maxLength={200} style={{ padding: 12 }} />
      <Pressable accessibilityRole="button" onPress={state.refresh}><SubstrateText>Refresh</SubstrateText></Pressable>
      {state.actionError ? <SubstrateText>{state.actionError}</SubstrateText> : null}
      {state.notice ? <SubstrateText>{state.notice}</SubstrateText> : null}
      {state.loading ? <ActivityIndicator /> : state.error ? <SubstrateText>{state.error}</SubstrateText> : <ScrollView horizontal><View style={{ minWidth: 600, gap: 16 }}><View style={{ flexDirection: 'row' }}><SubstrateText style={{ width: 380 }}>User</SubstrateText><SubstrateText>Roles</SubstrateText></View>{state.users.map(user => <View key={user.id} style={{ flexDirection: 'row' }}><View style={{ width: 380 }}><SubstrateText>{user.name || user.email || 'Unnamed user'}</SubstrateText>{user.name ? <SubstrateText variant="small">{user.email}</SubstrateText> : null}</View><View style={{ gap: 8 }}>{appRoles.map(role => <Pressable key={role} accessibilityRole="checkbox" accessibilityState={{ checked: user.roles.includes(role) }} disabled={state.saving || (user.id === state.currentUserId && role === 'admin') || (user.roles.includes(role) && user.roles.length === 1)} onPress={() => confirmRoles(user, user.roles.includes(role) ? appRoles.filter(value => user.roles.includes(value) && value !== role) : [...appRoles.filter(value => user.roles.includes(value)), role])}><SubstrateText>{user.roles.includes(role) ? '✓ ' : ''}{roleLabel(role)}</SubstrateText></Pressable>)}<Pressable accessibilityRole="button" accessibilityLabel={`Delete ${user.email || user.name || 'Unnamed user'}`} disabled={state.saving || user.id === state.currentUserId} onPress={() => confirmDelete(user)}><Trash2 size={18} color="#a33442" /></Pressable>{user.id === state.currentUserId ? <SubstrateText variant="small">Your account — protected</SubstrateText> : null}</View></View>)}{!state.users.length ? <SubstrateText>No users found.</SubstrateText> : null}</View></ScrollView>}
      <View style={{ flexDirection: 'row', gap: 20, marginTop: 20 }}><Pressable disabled={state.loading || state.page === 1} onPress={() => state.setPage(state.page - 1)}><SubstrateText>Previous</SubstrateText></Pressable><SubstrateText>Page {state.page}</SubstrateText><Pressable disabled={state.loading || !!state.error || state.page * 25 >= state.total} onPress={() => state.setPage(state.page + 1)}><SubstrateText>Next</SubstrateText></Pressable></View>
    </Card>
  </AppShell>;
}
