import { extractRoutineEvents } from '@/services/routine-events';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { getOrCreateDailyEntry } from '@/services/daily-entries';
import { getOrCreateTodayRecommendation } from '@/services/recommendations';
import { localDate } from '../../shared/journey.mjs';

/** The explicit Create/Update action saves exact user context, then builds the routine. */
export async function createDayRoutine(userId: string, note: string, date = localDate()) {
  if (date !== localDate()) throw Error('The date changed. Reload Your Day to continue.');
  const text = note.trim();
  const draftKey = `substrate:daily-draft:v1:${userId}:${date}`;
  if (text) {
    const raw = await AsyncStorage.getItem(draftKey);
    const draft = raw ? JSON.parse(raw) : {};
    await AsyncStorage.setItem(draftKey, JSON.stringify({ ...draft, note }));
  }
  const events = text ? await extractRoutineEvents(text) : null;
  // Read fresh data so the note never overwrites a metric saved since this screen loaded.
  const entry = await getOrCreateDailyEntry(userId, date);
  if (entry.error || !entry.data) throw Error('Could not load your saved day. Please try again.');
  if (text) {
    const saved = await supabase.from('daily_entries').update({
      check_in: { ...entry.data.check_in, routineNote: text, routineEvents: events?.activities || [], routineEventsSource: events?.source },
    }).eq('id', entry.data.id).eq('user_id', userId).eq('updated_at', entry.data.updated_at).select('id').single();
    if (saved.error || !saved.data) throw Error('Your day changed or your note could not be saved. Please try again.');
  }
  if (date !== localDate()) throw Error('The date changed. Reload Your Day to continue. Your note is saved.');
  const result = await getOrCreateTodayRecommendation(userId, entry.data.id);
  if (result.error || !result.data) {
    const detail = result.error instanceof Error ? result.error.message
      : result.error && 'code' in result.error && /^[A-Z0-9_-]{1,24}$/i.test(String(result.error.code)) ? `Service error ${result.error.code}.` : 'The routine service is unavailable.';
    throw Error(`Your inputs are saved. ${detail} Please try again.`);
  }
  await AsyncStorage.removeItem(draftKey).catch(() => {});
  return result.data;
}
