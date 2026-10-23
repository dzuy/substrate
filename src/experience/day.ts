import { supabase } from '@/lib/supabase';
import { getProfile, toProfileContext } from '@/services/profile';
import { getLatestRecommendation, readPlanInputs } from '@/services/recommendations';
import { getLatestDailyPhoto } from '@/services/photos';
import { getEnvironmentSnapshot, toEnvironmentSnapshot } from '@/services/environment';
import { localDate } from '../../shared/journey.mjs';

/** Reads saved context only; opening the dashboard never starts a paid analysis. */
export async function loadDay(userId:string) {
  const [profile, entry] = await Promise.all([getProfile(userId), supabase.from('daily_entries').select('*').eq('user_id',userId).eq('entry_date',localDate()).maybeSingle()]);
  if(profile.error || entry.error) throw profile.error || entry.error;
  const base = { profile:toProfileContext(profile.data), entry:entry.data };
  if(!entry.data) return {...base,recommendation:null,photo:null,environment:undefined,stale:false};
  const [recommendation,photo,environment,inputs] = await Promise.all([getLatestRecommendation(userId,entry.data.id),getLatestDailyPhoto(entry.data.id),getEnvironmentSnapshot(userId,entry.data.id),readPlanInputs(userId,entry.data.id)]);
  if(recommendation.error || photo.error || environment.error || inputs.error) throw recommendation.error || photo.error || environment.error || inputs.error;
  return {...base,recommendation:recommendation.data,photo:photo.data,environment:toEnvironmentSnapshot(environment.data),stale:!!recommendation.data && recommendation.data.dailyPlan.inputFingerprint!==inputs.data?.fingerprint};
}
export type DayData = Awaited<ReturnType<typeof loadDay>>;
