import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { getOrCreateDailyEntry } from '@/services/daily-entries';
import { getOrCreateTodayRecommendation } from '@/services/recommendations';
import { cleanDailyDraft, savedDailyActivities } from '../../shared/daily-draft.mjs';
import { localDate } from '../../shared/journey.mjs';

export async function saveDayWithTate(note: string, editing: boolean, signal: AbortSignal) {
  const date = localDate();
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw Error('Sign in again to plan your day.');
  const userId = data.session.user.id;
  const entry = await getOrCreateDailyEntry(userId, date);
  if (entry.error || !entry.data) throw Error('Your day could not be loaded. Please try again.');
  const endpoint = process.env.EXPO_PUBLIC_DAILY_DRAFT_API_URL || (Platform.OS === 'web'
    ? (__DEV__ ? `http://${window.location.hostname}:4318/api/daily-draft` : '/api/daily-draft') : '');
  if (!endpoint) throw Error('Tate is unavailable. Please try again later.');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify({ note, mode: 'plan-day-chat', editing, currentActivities: savedDailyActivities(entry.data.check_in) }),
    signal,
  }).catch(() => { throw Error('Tate couldn’t connect. Your note is still here—please try again.'); });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Tate could not prepare your day.');
  if (result.shouldUpdateDay === false) return null;
  const draft = cleanDailyDraft(result.draft);
  if (signal.aborted) throw Error('The request was cancelled.');
  if (date !== localDate()) throw Error('The date changed. Please send your plans again for today.');
  const checkIn = editing
    ? { ...entry.data.check_in, dailyActivities: draft.dailyActivities || [], movementPlanNote: (draft.dailyActivities || []).join('; '), movementPlan: [] }
    : { ...entry.data.check_in, ...draft };
  const saved = await supabase.from('daily_entries').update({
    check_in: { ...checkIn, journeyVersion: 1, confirmedAt: new Date().toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    status: 'check_in_added',
  }).eq('id', entry.data.id).eq('user_id', userId).eq('updated_at', entry.data.updated_at).select('id').single();
  if (saved.error) throw Error('Your day changed elsewhere or could not be saved. Please try again.');
  await AsyncStorage.removeItem(`substrate:daily-draft:v1:${userId}:${date}`).catch(() => {});
  const routine = await getOrCreateTodayRecommendation(userId, entry.data.id).catch(() => null);
  return { activities: savedDailyActivities(checkIn), routineReady: !!routine?.data && !routine.error };
}
