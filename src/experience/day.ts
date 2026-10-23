import { supabase } from '@/lib/supabase';
import { getProfile, toProfileContext, toProfileLocation } from '@/services/profile';
import { getLatestRecommendation, readPlanInputs, getOrCreateTodayRecommendation } from '@/services/recommendations';
import { getLatestDailyPhoto } from '@/services/photos';
import { getEnvironmentSnapshot, toEnvironmentSnapshot, captureEnvironmentSnapshot } from '@/services/environment';
import { getOrCreateDailyEntry } from '@/services/daily-entries';
import { localDate } from '../../shared/journey.mjs';

/** Loads the day and fetches weather for the saved location when today has no snapshot. */
export async function loadDay(userId:string) {
  const [profile, entry] = await Promise.all([getProfile(userId), supabase.from('daily_entries').select('*').eq('user_id',userId).eq('entry_date',localDate()).maybeSingle()]);
  if(profile.error || entry.error) throw profile.error || entry.error;
  const location = toProfileLocation(profile.data);
  if (!entry.data && location) {
    const created = await getOrCreateDailyEntry(userId, localDate());
    if (created.error) throw created.error;
    entry.data = created.data;
  }
  const base = { profile:toProfileContext(profile.data), location, entry:entry.data };
  if(!entry.data) return {...base,recommendation:null,photo:null,environment:undefined,stale:false};
  const [recommendation,photo,environment,inputs] = await Promise.all([getLatestRecommendation(userId,entry.data.id),getLatestDailyPhoto(entry.data.id),getEnvironmentSnapshot(userId,entry.data.id),readPlanInputs(userId,entry.data.id)]);
  if(recommendation.error || photo.error || environment.error || inputs.error) throw recommendation.error || photo.error || environment.error || inputs.error;
  let weather = environment.data;
  let weatherError = '';
  if (!weather && location) {
    try {
      const fetched = await captureEnvironmentSnapshot(userId, entry.data.id, { ...location, label: location.label ?? location.query });
      if (fetched.error) weatherError = 'Weather could not be refreshed. Tap Weather to try again.';
      else weather = fetched.data;
    } catch { weatherError = 'Weather could not be refreshed. Tap Weather to try again.'; }
  }
  let currentRecommendation = recommendation.data;
  let stale = !!currentRecommendation && (weather !== environment.data || currentRecommendation.dailyPlan.inputFingerprint !== inputs.data?.fingerprint);
  let analysisError = '';
  if (stale || (!currentRecommendation && (entry.data.check_in.confirmedAt || photo.data))) {
    try {
      const updated = await getOrCreateTodayRecommendation(userId, entry.data.id);
      if (updated.error || !updated.data) throw updated.error || Error('Analysis unavailable.');
      currentRecommendation = updated.data;
      stale = false;
    } catch {
      analysisError = 'Your skin update could not be loaded. Please try again.';
    }
  }
  return {...base,weatherError,analysisError,recommendation:currentRecommendation,photo:photo.data,environment:toEnvironmentSnapshot(weather),stale};
}
export type DayData = Awaited<ReturnType<typeof loadDay>>;
