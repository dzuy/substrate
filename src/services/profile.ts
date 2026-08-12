import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { geocodeLocation } from '@/services/environment';
import type { Database, ProfileContext, ProfileLocation } from '@/types/database';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ResolvedProfileLocation = ProfileLocation & { query: string };

export async function getProfile(userId: string) {
  return supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
}

export async function saveProfileLocation(userId: string, query: string) {
  const geocoded = await geocodeLocation(query);

  if (geocoded.error || !geocoded.data) {
    return { data: null, error: geocoded.error ?? new Error('Location lookup failed.') };
  }

  return saveResolvedProfileLocation(userId, {
    query,
    label: geocoded.data.label,
    latitude: geocoded.data.latitude,
    longitude: geocoded.data.longitude,
  });
}

export async function saveResolvedProfileLocation(
  userId: string,
  location: { query: string; label?: string; latitude: number; longitude: number }
) {
  const resolvedLocation = {
    query: location.query.trim(),
    label: location.label ?? location.query.trim(),
    latitude: location.latitude,
    longitude: location.longitude,
  };

  await cacheProfileLocation(userId, resolvedLocation);

  return supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        location_query: resolvedLocation.query,
        location_label: resolvedLocation.label,
        latitude: resolvedLocation.latitude,
        longitude: resolvedLocation.longitude,
      },
      { onConflict: 'id' }
    )
    .select('*')
    .single();
}

export async function getCachedProfileLocation(userId: string): Promise<ProfileLocation | null> {
  const stored = await AsyncStorage.getItem(buildProfileLocationCacheKey(userId));

  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<ResolvedProfileLocation>;

    if (typeof parsed.latitude !== 'number' || typeof parsed.longitude !== 'number') {
      return null;
    }

    return {
      query: typeof parsed.query === 'string' ? parsed.query : undefined,
      label: typeof parsed.label === 'string' ? parsed.label : undefined,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
    };
  } catch {
    return null;
  }
}

export async function ensureProfile(userId: string, email?: string | null) {
  return supabase
    .from('profiles')
    .upsert({ id: userId, email: email ?? null }, { onConflict: 'id' })
    .select('*')
    .single();
}

export async function saveProfileContext(userId: string, context: ProfileContext) {
  return supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        display_name: normalizeText(context.displayName),
        age_range: normalizeText(context.ageRange),
        skin_type: normalizeText(context.skinType),
        sensitivity_level: normalizeText(context.sensitivityLevel),
        skin_goals: context.skinGoals ?? [],
        known_triggers: context.knownTriggers ?? [],
        skin_context_note: normalizeText(context.skinContextNote),
      },
      { onConflict: 'id' }
    )
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

export function toProfileContext(profile: ProfileRow | null | undefined): ProfileContext {
  if (!profile) {
    return {};
  }

  return {
    displayName: profile.display_name ?? undefined,
    ageRange: profile.age_range ?? undefined,
    skinType: profile.skin_type ?? undefined,
    sensitivityLevel: profile.sensitivity_level ?? undefined,
    skinGoals: profile.skin_goals ?? [],
    knownTriggers: profile.known_triggers ?? [],
    skinContextNote: profile.skin_context_note ?? undefined,
  };
}

async function cacheProfileLocation(userId: string, location: ResolvedProfileLocation) {
  await AsyncStorage.setItem(buildProfileLocationCacheKey(userId), JSON.stringify(location));
}

function buildProfileLocationCacheKey(userId: string) {
  return `substrate:${userId}:profile-location`;
}

function normalizeText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
