import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, useWindowDimensions, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Copy, Notice, ReportButton } from '@/report/ui';
import { useReportTheme } from '@/report/theme';
import { getOrCreateDailyEntry } from '@/services/daily-entries';
import { geocodeLocation, captureEnvironmentSnapshot } from '@/services/environment';
import { getOrCreateTodayRecommendation } from '@/services/recommendations';
import { saveResolvedProfileLocation } from '@/services/profile';
import { supabase } from '@/lib/supabase';
import type { DayData } from '@/experience/day';
import type { CheckInResponses } from '@/types/database';
import { dailyOptions } from '../../shared/daily-draft.mjs';
import { localDate } from '../../shared/journey.mjs';

export type DayMetric = 'Sleep' | 'HRV' | 'Cycle' | 'Weather';
export function DayMetricDrawer({ metric, data, userId, onClose, onSaved }: {
  metric: DayMetric; data: DayData; userId: string; onClose: () => void; onSaved: () => void;
}) {
  const { theme: t } = useReportTheme();
  const { height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [progress]);
  function dismiss(afterClose: () => void) {
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    Animated.timing(progress, { toValue: 0, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start(({ finished }) => {
      if (finished) afterClose();
    });
  }
  const date = useRef(localDate()).current;
  const checkIn = data.entry?.check_in;
  const [values, setValues] = useState<Record<string, string>>({
    sleepHours: String(checkIn?.sleepHours ?? ''), sleepQuality: checkIn?.sleepQuality ?? '',
    hrvMs: String(checkIn?.hrvMs ?? ''), cycleDay: String(checkIn?.cycleDay ?? ''), cyclePhase: checkIn?.cyclePhase ?? '',
    location: data.location?.query ?? data.location?.label ?? data.environment?.locationLabel ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [pendingRoutine, setPendingRoutine] = useState<string | null>(null);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const set = (key: string, value: string) => setValues(v => ({ ...v, [key]: value }));
  function number(key: string, label: string, min: number, max: number, integer = false) {
    if (!values[key].trim()) return undefined;
    const value = Number(values[key]);
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
      throw Error(`${label} must be ${integer ? 'a whole number ' : ''}between ${min} and ${max}.`);
    return value;
  }
  async function refreshRoutine(entryId: string) {
    try {
      const result = await getOrCreateTodayRecommendation(userId, entryId);
      if (result.error || !result.data) throw result.error || Error('Routine unavailable.');
    } catch {
      throw Error(`${metric} is saved, but your skincare routine could not be updated. Please retry.`);
    }
    dismiss(onSaved);
  }
  async function save() {
    if (lock.current || closing.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (date !== localDate()) throw Error('The date changed. Close this drawer and reopen it to enter today’s values.');
      if (pendingRoutine) { await refreshRoutine(pendingRoutine); return; }
      const patch: Partial<CheckInResponses> = metric === 'Sleep'
        ? { sleepHours: number('sleepHours', 'Sleep hours', 0, 24), sleepQuality: (values.sleepQuality || undefined) as CheckInResponses['sleepQuality'] }
        : metric === 'HRV' ? { hrvMs: number('hrvMs', 'HRV', 1, 500) }
        : metric === 'Cycle' ? { cycleDay: number('cycleDay', 'Cycle day', 1, 120, true), cyclePhase: (values.cyclePhase || undefined) as CheckInResponses['cyclePhase'] } : {};
      if (metric === 'Weather' && !values.location.trim()) throw Error('Enter a city or ZIP code.');
      const entry = await getOrCreateDailyEntry(userId, date);
      if (entry.error || !entry.data) throw Error('Could not load your day. Please try again.');
      if (metric === 'Weather') {
        const query = values.location.trim();
        const resolved = await geocodeLocation(query);
        if (resolved.error || !resolved.data) throw resolved.error || Error('Location not found.');
        const weather = await captureEnvironmentSnapshot(userId, entry.data.id, resolved.data);
        if (weather.error || !weather.data) throw weather.error || Error('Weather could not be loaded. Please try again.');
        const profile = await saveResolvedProfileLocation(userId, { query, ...resolved.data });
        if (profile.error) throw Error('Weather was fetched, but your profile location could not be saved. Please retry.');
      } else {
        const next = { ...entry.data.check_in, ...patch };
        const result = await supabase.from('daily_entries').update({ check_in: next }).eq('id', entry.data.id).eq('user_id', userId).eq('updated_at', entry.data.updated_at).select('id').single();
        if (result.error) throw Error('Your day changed or could not be saved. Please try again.');
      }
      setPendingRoutine(entry.data.id);
      await refreshRoutine(entry.data.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { lock.current = false; setBusy(false); }
  }
  function field(key: string, label: string, placeholder: string, numeric = true) {
    return <View style={{ gap: 8 }}><Copy style={{ color: t.ink }}>{label}</Copy><TextInput accessibilityLabel={label} value={values[key]} onChangeText={value => set(key, value)} editable={!busy && !pendingRoutine} placeholder={placeholder} placeholderTextColor={t.muted} inputMode={numeric ? 'decimal' : 'text'} maxLength={numeric ? 8 : 100} style={{ minHeight: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: t.line, borderRadius: 12, color: t.ink, backgroundColor: t.surface, fontSize: 16 }} /></View>;
  }
  function choices(key: string, label: string, options: readonly string[]) {
    return <View style={{ gap: 10 }}><Copy style={{ color: t.ink }}>{label}</Copy><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{options.map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: values[key] === value }} disabled={busy || !!pendingRoutine} onPress={() => set(key, values[key] === value ? '' : value)} style={{ minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 24, borderWidth: 1, borderColor: t.line, backgroundColor: values[key] === value ? t.ink : t.surface }}><Copy style={{ color: values[key] === value ? t.paper : t.ink }}>{value}</Copy></Pressable>)}</View></View>;
  }
  const close = () => { if (!lock.current) dismiss(pendingRoutine ? onSaved : onClose); };
  return <Modal transparent visible animationType="none" onRequestClose={close}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: '#000', opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.47] }) }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss metric drawer" onPress={close} style={{ position: 'absolute', inset: 0 }} />
      <Animated.View style={{ maxHeight: '85%', width: '100%', maxWidth: 620, alignSelf: 'center', transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }}>
      <SafeAreaView edges={['bottom']} style={{ flexShrink: 1, backgroundColor: t.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 24, gap: 16 }}>
        <View style={{ width: 36, height: 4, backgroundColor: t.line, borderRadius: 2, alignSelf: 'center' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Copy kind="heading" style={{ color: t.ink }}>{metric}</Copy><Pressable accessibilityRole="button" accessibilityLabel="Close metric drawer" disabled={busy} onPress={close} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><X color={t.ink} size={22} /></Pressable></View>
        <Copy kind="small" style={{ color: t.muted }}>{metric === 'Weather' ? 'Enter a city or ZIP code. We’ll fetch your weather and remember this location for future days.' : `Enter your ${metric.toLowerCase()} details for today.`}</Copy>
        <ScrollView style={{flexShrink:1,minHeight:0}} alwaysBounceVertical={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 20, paddingBottom: 8 }}>
          {metric === 'Sleep' ? <>{field('sleepHours', 'Hours slept', 'e.g. 7.5')}{choices('sleepQuality', 'How did you sleep?', dailyOptions.sleepQuality)}</> : null}
          {metric === 'HRV' ? field('hrvMs', 'Heart rate variability (ms)', 'e.g. 62') : null}
          {metric === 'Cycle' ? <>{field('cycleDay', 'Cycle day', 'e.g. 16')}{choices('cyclePhase', 'Cycle phase', dailyOptions.cyclePhase)}</> : null}
          {metric === 'Weather' ? field('location', 'City or ZIP code', 'e.g. Los Gatos or 95030', false) : null}
          {busy && pendingRoutine ? <Copy kind="small" style={{ color: t.muted }}>Updating your skincare routine…</Copy> : null}
          {error ? <Notice>{error}</Notice> : null}
        </ScrollView>
        <ReportButton copper label={pendingRoutine ? 'Retry routine update' : metric === 'Weather' ? 'Get Weather & Save Location' : 'Save'} busy={busy} onPress={() => void save()} />
      </SafeAreaView>
      </Animated.View>
    </KeyboardAvoidingView>
  </Modal>;
}
