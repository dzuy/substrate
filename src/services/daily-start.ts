import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { localDate } from '../../shared/journey.mjs';
import { dailyEntryRoute } from '../../shared/daily-entry-route.mjs';
const skipKey = (userId:string) => `substrate:daily-skip:v1:${userId}`;
export async function skipDailyStart(userId:string) {
  // A skip only changes the entry screen on this device; it never submits observations.
  await AsyncStorage.setItem(skipKey(userId),localDate());
}
export async function getDailyStartRoute(userId:string) {
  const date=localDate();
  const [entry,skippedDate]=await Promise.all([
    supabase.from('daily_entries').select('entry_date,check_in').eq('user_id',userId).eq('entry_date',date).maybeSingle(),
    AsyncStorage.getItem(skipKey(userId)),
  ]);
  if(entry.error)throw entry.error;
  return dailyEntryRoute({date,entry:entry.data,skippedDate});
}
