import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { ArrowUp } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { getOrCreateTodayRecommendation } from '@/services/recommendations';
import { Copy, Notice, ReportButton } from '@/report/ui';
import { fontFamily, useReportTheme } from '@/report/theme';
import { cleanDailyDraft, savedDailyActivities } from '../../shared/daily-draft.mjs';
import { localDate } from '../../shared/journey.mjs';
import type { Database } from '@/types/database';

type ChatMessage = { role: 'user' | 'assistant'; text: string; activities?: string[]; proposalId?: number };

type Entry = Database['public']['Tables']['daily_entries']['Row'];
export function DayEditChat({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const { theme: t } = useReportTheme();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [request, setRequest] = useState('');
  const [proposal, setProposal] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [routinePending, setRoutinePending] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeProposal, setActiveProposal] = useState<number | null>(null);
  const nextProposal = useRef(0);
  const conversation = useRef<ScrollView>(null);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    let alive = true;
    setEntry(null); setProposal(null); setActiveProposal(null); setMessages([]); setError('');
    if (!user) return;
    void supabase.from('daily_entries').select('*').eq('user_id', user.id).eq('entry_date', localDate()).maybeSingle().then(({ data, error }) => {
      if (!alive) return;
      if (error || !data) setError('Your saved day could not be loaded. Please try again.');
      else {
        setEntry(data);
        const activities = savedDailyActivities(data.check_in);
        setMessages([{ role: 'assistant', text: activities.length ? 'Here’s what you have planned. What would you like to change?' : 'What would you like to add to your day?', activities }]);
      }
    });
    return () => { alive = false; controller.current?.abort(); };
  }, [user, reload]);
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function propose() {
    if (!entry || !request.trim()) return;
    if (entry.entry_date !== localDate()) throw Error('The date changed. Reload your day before editing.');
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw Error('Sign in again to edit your day.');
    const endpoint = Platform.OS === 'web' ? (__DEV__ ? `http://${window.location.hostname}:4318/api/daily-draft` : '/api/daily-draft') : process.env.EXPO_PUBLIC_DAILY_DRAFT_API_URL;
    if (!endpoint) throw Error('Tate is unavailable. Please try again later.');
    const text = request.trim();
    setMessages(current => [...current, { role: 'user', text }]);
    setRequest(''); setActiveProposal(null);
    const abort = new AbortController(); controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 60000);
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ mode: 'edit-activities', note: text, currentActivities: proposal ?? savedDailyActivities(entry.check_in) }), signal: abort.signal });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Tate could not prepare the changes.');
      const activities = cleanDailyDraft(result.draft).dailyActivities;
      if (!activities) throw Error('No activity proposal was returned. Please try again.');
      setProposal(activities);
      const proposalId = ++nextProposal.current;
      setActiveProposal(proposalId);
      setMessages(current => [...current, { role: 'assistant', text: 'Here’s your updated plan. Does this look right? You can confirm it or tell me what else to change.', activities, proposalId }]);
    } catch (error) {
      setRequest(text);
      throw error;
    } finally { clearTimeout(timeout); }
  }
  async function updateRoutine(savedEntry: Entry) {
    if (!user) return;
    try {
      const result = await getOrCreateTodayRecommendation(user.id, savedEntry.id);
      if (result.error || !result.data) throw result.error || Error('Routine unavailable.');
    } catch {
      throw Error('Your day is saved, but your skincare routine could not be updated. Please retry.');
    }
    setRoutinePending(false);
    onSaved();
  }
  async function confirm() {
    if (!entry || proposal === null || activeProposal === null || !user) return;
    if (entry.entry_date !== localDate()) throw Error('The date changed. Reload your day before saving.');
    const result = await supabase.from('daily_entries').update({ check_in: { ...entry.check_in, dailyActivities: proposal, movementPlanNote: proposal.join('; '), movementPlan: [], confirmedAt: new Date().toISOString() } }).eq('id', entry.id).eq('user_id', user.id).eq('updated_at', entry.updated_at).select('*').single();
    if (result.error) throw Error('Your day could not be saved or changed elsewhere. Reload the latest day and try again.');
    setEntry(result.data); setProposal(null); setActiveProposal(null);
    setRoutinePending(true);
    await updateRoutine(result.data);
  }
  const canSend = !!entry && !!request.trim() && !busy && !routinePending;
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.paper }}>
    <ScrollView ref={conversation} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" onContentSizeChange={() => conversation.current?.scrollToEnd({ animated: true })} contentContainerStyle={{ padding: 24, gap: 20 }}>
      {!entry && !error ? <ActivityIndicator color={t.gold} /> : null}
      {messages.map((message, index) => <View key={index} style={{ gap: 12, padding: 16, borderRadius: t.radius, backgroundColor: message.role === 'user' ? t.surface : t.paper, borderWidth: message.role === 'user' ? 1 : 0, borderColor: t.line }}>
        <Copy kind="eyebrow" style={{ color: t.gold }}>{message.role === 'user' ? 'YOU' : 'TATE'}</Copy>
        <Copy>{message.text}</Copy>
        {message.activities?.map((activity, i) => <View key={i} style={{ flexDirection: 'row', gap: 10 }}><Copy style={{ color: t.gold }}>•</Copy><Copy style={{ flex: 1 }}>{activity}</Copy></View>)}
        {message.proposalId && !message.activities?.length ? <Copy>No activities planned. Confirming will clear your activity list.</Copy> : null}
        {message.proposalId === activeProposal ? <>
          <ReportButton copper label="Confirm Changes" busy={busy} disabled={!!request.trim()} onPress={() => void run(confirm)} />
          <Copy kind="small" style={{ color: t.muted }}>Changes are only saved when you confirm.</Copy>
        </> : null}
      </View>)}
      {busy ? <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><ActivityIndicator color={t.gold} /><Copy kind="small">{routinePending ? 'Tate is updating your skincare routine…' : 'Tate is updating your day…'}</Copy></View> : null}
    </ScrollView>
    <View style={{ padding: 20, gap: 12, borderTopWidth: 1, borderColor: t.line, backgroundColor: t.surface }}>
      {error ? <><Notice>{error}</Notice><ReportButton secondary label={routinePending ? "Retry routine update" : "Reload saved day"} disabled={busy} onPress={() => routinePending && entry ? void run(() => updateRoutine(entry)) : setReload(v => v + 1)} /></> : null}
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <TextInput accessibilityLabel="Tell Tate what to change" placeholder="Tell Tate what to change…" placeholderTextColor={t.muted} multiline
              returnKeyType="send"
              submitBehavior={Platform.OS === 'web' ? undefined : 'submit'}
              onKeyPress={event => {
                if (Platform.OS !== 'web') return;
                const key = event.nativeEvent as typeof event.nativeEvent & { shiftKey?: boolean; isComposing?: boolean; keyCode?: number };
                if (key.key === 'Enter' && !key.shiftKey && !key.isComposing && key.keyCode !== 229) {
                  event.preventDefault();
                  if (canSend) void run(propose);
                }
              }}
              onSubmitEditing={() => { if (canSend) void run(propose); }} maxLength={2000} editable={!!entry && !busy && !routinePending} value={request} onChangeText={setRequest} style={{ flex: 1, minWidth: 0, minHeight: 48, maxHeight: 120, borderWidth: 1, borderColor: t.line, borderRadius: t.radius, paddingHorizontal: 16, paddingVertical: 12, color: t.ink, backgroundColor: t.paper, fontFamily: fontFamily(t.bodyFont), fontSize: 16 * t.scale }} />
        <Pressable accessibilityRole="button" accessibilityLabel="Send change to Tate" accessibilityState={{ disabled: !canSend }} disabled={!canSend} onPress={() => void run(propose)} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, backgroundColor: t.ink, alignItems: 'center', justifyContent: 'center', opacity: !canSend ? 0.4 : pressed ? 0.75 : 1 })}><ArrowUp size={23} color={t.paper} /></Pressable>
      </View>
    </View>
  </KeyboardAvoidingView>;
}
