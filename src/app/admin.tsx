import { Link, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useAdminUsers } from '@/components/admin/use-admin-users';
import { AppShell, Card, ScreenHeader, SubstrateText } from '@/components/substrate-ui';

export default function AdminHome() {
  const state = useAdminUsers();
  return <AppShell><ScreenHeader eyebrow="Administration" title="Users" body="Substrate accounts and app roles." />
    <Link href={'/admin-products' as Href}>Product catalog</Link>
    {state.checkingAccess ? <ActivityIndicator /> : !state.allowed ? <SubstrateText>Administrator access required.</SubstrateText> : <Card>
      <TextInput accessibilityLabel="Search users" placeholder="Search users" value={state.query} onChangeText={state.search} maxLength={200} style={{ padding: 12 }} />
      <Pressable accessibilityRole="button" onPress={state.refresh}><SubstrateText>Refresh</SubstrateText></Pressable>
      {state.loading ? <ActivityIndicator /> : state.error ? <SubstrateText>{state.error}</SubstrateText> : <ScrollView horizontal><View style={{ minWidth: 600, gap: 16 }}><View style={{ flexDirection: 'row' }}><SubstrateText style={{ width: 380 }}>User</SubstrateText><SubstrateText>Roles</SubstrateText></View>{state.users.map(user => <View key={user.id} style={{ flexDirection: 'row' }}><View style={{ width: 380 }}><SubstrateText>{user.name || user.email || user.id}</SubstrateText>{user.name ? <SubstrateText variant="small">{user.email}</SubstrateText> : null}</View><SubstrateText>{user.roles.join(', ')}</SubstrateText></View>)}{!state.users.length ? <SubstrateText>No users found.</SubstrateText> : null}</View></ScrollView>}
      <View style={{ flexDirection: 'row', gap: 20, marginTop: 20 }}><Pressable disabled={state.loading || state.page === 1} onPress={() => state.setPage(state.page - 1)}><SubstrateText>Previous</SubstrateText></Pressable><SubstrateText>Page {state.page}</SubstrateText><Pressable disabled={state.loading || !!state.error || state.page * 25 >= state.total} onPress={() => state.setPage(state.page + 1)}><SubstrateText>Next</SubstrateText></Pressable></View>
    </Card>}
  </AppShell>;
}
