import { supabase } from '@/lib/supabase';
import { geocodeLocation } from '@/services/environment';
import type { Database, ProfileLocation } from '@/types/database';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export async function getProfile(userId: string) {
  return supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
}

export async function saveProfileLocation(userId: string, query: string) {
  const geocoded = await geocodeLocation(query);

  if (geocoded.error || !geocoded.data) {
    return { data: null, error: geocoded.error ?? new Error('Location lookup failed.') };
  }

  return supabase
    .from('profiles')
    .update({
      location_query: query.trim(),
      location_label: geocoded.data.label,
      latitude: geocoded.data.latitude,
      longitude: geocoded.data.longitude,
    })
    .eq('id', userId)
    .select('*')
    .single();
}

export function toProfileLocation(profile: ProfileRow | null | undefined): ProfileLocation | null {
  if (!profile || typeof profile.latitude !== 'number' || typeof profile.longitude !== 'number') {
    return null;
  }

  return {
    query: profile.location_query ?? undefined,
    label: profile.location_label ?? undefined,
    latitude: profile.latitude,
    longitude: profile.longitude,
  };
}
