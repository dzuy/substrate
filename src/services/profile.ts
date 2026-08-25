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
  const profileData = normalizeProfileContext(context);
  const knownTriggers = [
    ...(profileData.knownTriggers ?? []),
    ...(profileData.skinHistory ?? []),
    ...(profileData.medicalHistory ?? []),
  ];

  return supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        display_name: normalizeText(profileData.displayName),
        age_range: normalizeText(profileData.age ?? profileData.ageRange),
        skin_type: normalizeText(profileData.skinType),
        sensitivity_level: normalizeText(profileData.sensitivityLevel),
        skin_goals: profileData.skinGoals ?? [],
        known_triggers: Array.from(new Set(knownTriggers)),
        skin_context_note: normalizeText(profileData.skinContextNote),
        profile_data: profileData,
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

  const profileData = toProfileData(profile.profile_data);

  return {
    ...profileData,
    displayName: profileData.displayName ?? profile.display_name ?? undefined,
    age: profileData.age ?? profile.age_range ?? undefined,
    ageRange: profileData.ageRange ?? profile.age_range ?? undefined,
    skinType: profileData.skinType ?? profile.skin_type ?? undefined,
    sensitivityLevel: profileData.sensitivityLevel ?? profile.sensitivity_level ?? undefined,
    skinGoals: profileData.skinGoals ?? profile.skin_goals ?? [],
    skinHistory: profileData.skinHistory ?? profile.known_triggers ?? [],
    knownTriggers: profileData.knownTriggers ?? profile.known_triggers ?? [],
    skinContextNote: profileData.skinContextNote ?? profile.skin_context_note ?? undefined,
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

function normalizeProfileContext(context: ProfileContext): ProfileContext {
  return {
    ...context,
    displayName: normalizeOptionalString(context.displayName),
    age: normalizeOptionalString(context.age),
    ageRange: normalizeOptionalString(context.ageRange),
    height: normalizeOptionalString(context.height),
    skinAncestry: normalizeOptionalString(context.skinAncestry),
    skinType: normalizeOptionalString(context.skinType),
    sensitivityLevel: normalizeOptionalString(context.sensitivityLevel),
    regularCycles: normalizeOptionalString(context.regularCycles),
    averageCycleLength: normalizeOptionalString(context.averageCycleLength),
    lastPeriodStart: normalizeOptionalString(context.lastPeriodStart),
    perimenopause: normalizeOptionalString(context.perimenopause),
    menopause: normalizeOptionalString(context.menopause),
    hrt: normalizeOptionalString(context.hrt),
    birthControl: normalizeOptionalString(context.birthControl),
    testosterone: normalizeOptionalString(context.testosterone),
    glp1Medications: normalizeOptionalString(context.glp1Medications),
    smoking: normalizeOptionalString(context.smoking),
    alcohol: normalizeOptionalString(context.alcohol),
    exerciseFrequency: normalizeOptionalString(context.exerciseFrequency),
    sauna: normalizeOptionalString(context.sauna),
    swimming: normalizeOptionalString(context.swimming),
    sunExposure: normalizeOptionalString(context.sunExposure),
    spfUse: normalizeOptionalString(context.spfUse),
    dailyProtein: normalizeOptionalString(context.dailyProtein),
    dailyWater: normalizeOptionalString(context.dailyWater),
    dailyFruit: normalizeOptionalString(context.dailyFruit),
    dailyVegetables: normalizeOptionalString(context.dailyVegetables),
    supplementNote: normalizeOptionalString(context.supplementNote),
    skincareProducts: normalizeOptionalString(context.skincareProducts),
    skincareSearch: normalizeOptionalString(context.skincareSearch),
    skinContextNote: normalizeOptionalString(context.skinContextNote),
    skinGoals: normalizeStringArray(context.skinGoals),
    skinHistory: normalizeStringArray(context.skinHistory),
    medicalHistory: normalizeStringArray(context.medicalHistory),
    reproductiveHormonalStatus: normalizeStringArray(context.reproductiveHormonalStatus),
    typicalDiet: normalizeStringArray(context.typicalDiet),
    supplements: normalizeStringArray(context.supplements),
    proceduresHistory: normalizeStringArray(context.proceduresHistory),
    knownTriggers: normalizeStringArray(context.knownTriggers),
  };
}

function toProfileData(value: unknown): ProfileContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return normalizeProfileContext(value as ProfileContext);
}

function normalizeOptionalString(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function normalizeStringArray(values?: string[]) {
  const normalized = values?.map((value) => value.trim()).filter(Boolean) ?? [];
  return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
}
