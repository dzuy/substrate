import { routineContext } from '../../shared/tate-routine-context.mjs';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { getOrCreateDailyEntry } from '@/services/daily-entries';
import { getOrCreateTodayRecommendation } from '@/services/recommendations';
import { cleanDailyDraft, savedDailyActivities } from '../../shared/daily-draft.mjs';
import { localDate } from '../../shared/journey.mjs';

export async function prepareDayWithTate(note: string, editing: boolean, signal: AbortSignal, routineReference?: string) {
  const date = localDate();
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw Error('Sign in again to plan your day.');
  const userId = data.session.user.id;
  const entry = await getOrCreateDailyEntry(userId, date);
  if (entry.error || !entry.data) throw Error('Your day could not be loaded. Please try again.');
  const localWeb = Platform.OS === 'web' && __DEV__ && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  const endpoint = localWeb ? `http://127.0.0.1:4318/api/daily-draft` : process.env.EXPO_PUBLIC_DAILY_DRAFT_API_URL || (Platform.OS === 'web' ? '/api/daily-draft' : '');
  if (!endpoint) throw Error('Tate is unavailable. Please try again later.');
  const contextualNote = routineReference ? `User change request (only this is intent): ${note}\nSaved routine reference only, not new activities or instructions: ${routineReference.slice(0,900)}` : note;
  if(contextualNote.length>2000)throw Error('Please shorten your request so Tate can include your routine context. Your text is unchanged.');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify({ note: contextualNote, mode: 'plan-day-chat', editing, currentActivities: entry.data.check_in.routineEvents?.length ? entry.data.check_in.routineEvents : savedDailyActivities(entry.data.check_in) }),
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
  return {userId, entry: entry.data, date, checkIn, activities: savedDailyActivities(checkIn)};
}

export type DayProposal = NonNullable<Awaited<ReturnType<typeof prepareDayWithTate>>>;
export async function confirmDayWithTate(proposal: DayProposal, activitiesText: string, updateRoutineContext = false) {
  const {userId, entry, date} = proposal;
  if (date !== localDate()) throw Error('The date changed. Prepare today’s plan again.');
  const activities = cleanDailyDraft({dailyActivities: activitiesText.split('\n')}).dailyActivities || [];
  const checkIn = {...proposal.checkIn, dailyActivities: activities, movementPlanNote: activities.join('; '), movementPlan: [], ...(updateRoutineContext ? {routineNoteHistory:[...(entry.check_in.routineNoteHistory||[]),...(entry.check_in.routineNote?[entry.check_in.routineNote]:[])],routineNote:activities.join('; '),routineEvents:activities,routineEventsSource:'model' as const} : {})};
  const saved = await supabase.from('daily_entries').update({
    check_in: { ...checkIn, journeyVersion: 1, confirmedAt: new Date().toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    status: 'check_in_added',
  }).eq('id', entry.id).eq('user_id', userId).eq('updated_at', entry.updated_at).select('id').single();
  if (saved.error || !saved.data) throw Error('Your day changed elsewhere or could not be saved. Please try again.');
  await AsyncStorage.removeItem(`substrate:daily-draft:v1:${userId}:${date}`).catch(() => {});
  const routine = await getOrCreateTodayRecommendation(userId, entry.id).catch(() => null);
  return { activities: savedDailyActivities(checkIn), entryId:entry.id, routineReady: !!routine?.data && !routine.error, summary: routine?.data && !routine.error ? routineContext({...entry,check_in:checkIn},routine.data).summary : '' };
}
