import { supabase } from '@/lib/supabase';
import { getEnvironmentSnapshot, toEnvironmentSnapshot } from '@/services/environment';
import { analyzeDailyPhoto, toPhotoAnalysis } from '@/services/photos';
import { getProfile, toProfileContext } from '@/services/profile';
import type { AnalysisSignals, CheckInResponses, DailyPlan, EnvironmentSnapshot, Json, PhotoAnalysis, ProfileContext, SkinStory } from '@/types/database';

type TodayRecommendation = {
  entryId: string;
  analysis: AnalysisSignals;
  skinStory: Required<Pick<SkinStory, 'headline' | 'summary' | 'contributors' | 'priority'>>;
  dailyPlan: Required<Pick<DailyPlan, 'priorities' | 'avoid'>>;
  safetyNotes: string[];
  isGenerated: boolean;
};

type ScoreDriver = NonNullable<AnalysisSignals['drivers']>[number];

type GeneratedRecommendation = Required<Pick<SkinStory, 'headline' | 'summary' | 'contributors' | 'priority'>> & {
  dailyPlan: Required<Pick<DailyPlan, 'priorities' | 'avoid'>>;
  safetyNotes: string[];
  provider: string;
  model: string;
  rawResponse: Json | null;
};

export async function getOrCreateTodayRecommendation(userId: string, dailyEntryId: string) {
  const existing = await getLatestRecommendation(userId, dailyEntryId);

  if (existing.error) {
    return existing;
  }

  if (existing.data && typeof existing.data.analysis.skinHealthScore === 'number') {
    return { data: { ...existing.data, isGenerated: false }, error: null };
  }

  const entry = await supabase
    .from('daily_entries')
    .select('*')
    .eq('id', dailyEntryId)
    .eq('user_id', userId)
    .single();

  if (entry.error) {
    return { data: null, error: entry.error };
  }

  const photo = await supabase
    .from('photos')
    .select('id, quality_checks')
    .eq('daily_entry_id', dailyEntryId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (photo.error) {
    return { data: null, error: photo.error };
  }

  let photoAnalysis = toPhotoAnalysis(photo.data?.quality_checks);

  if (photo.data && !photoAnalysis?.analyzedAt) {
    const analyzed = await analyzeDailyPhoto(photo.data.id);
    photoAnalysis = analyzed.data ?? photoAnalysis;
  }

  const environment = await getEnvironmentSnapshot(userId, dailyEntryId);

  if (environment.error) {
    return { data: null, error: environment.error };
  }

  const profile = await getProfile(userId);
  const profileContext = profile.error ? {} : toProfileContext(profile.data);

  const priorScore = await getPriorSkinHealthScore(userId, entry.data.entry_date);
  const generated = buildRecommendation(
    entry.data.check_in,
    Boolean(photo.data),
    photoAnalysis,
    toEnvironmentSnapshot(environment.data),
    priorScore
  );

  if (existing.data) {
    return {
      data: {
        entryId: dailyEntryId,
        analysis: generated.analysis,
        skinStory: generated.skinStory,
        dailyPlan: generated.dailyPlan,
        safetyNotes: generated.safetyNotes,
        isGenerated: true,
      },
      error: null,
    };
  }

  const analysis = await supabase
    .from('analysis_results')
    .insert({
      user_id: userId,
      daily_entry_id: dailyEntryId,
      photo_id: photo.data?.id ?? null,
      provider: 'substrate-prototype',
      model: 'rules-v1',
      signals: generated.analysis,
      confidence: {
        level: 'low',
        basis: 'Prototype rules using check-in responses and photo presence.',
      },
      caveats: [
        'This is a prototype wellness signal, not a medical diagnosis.',
        'Image analysis is not yet active; photo presence is used as a workflow signal.',
      ],
    })
    .select('*')
    .single();

  if (analysis.error) {
    return { data: null, error: analysis.error };
  }

  const recommendationContent = await generateRecommendationCopy(dailyEntryId, entry.data.check_in, generated, profileContext);
  const recommendation = await supabase
    .from('recommendation_results')
    .insert({
      user_id: userId,
      daily_entry_id: dailyEntryId,
      provider: recommendationContent.provider,
      model: recommendationContent.model,
      skin_story: {
        headline: recommendationContent.headline,
        summary: recommendationContent.summary,
        contributors: recommendationContent.contributors,
        priority: recommendationContent.priority,
      },
      daily_plan: recommendationContent.dailyPlan,
      safety_notes: recommendationContent.safetyNotes,
      raw_response: recommendationContent.rawResponse,
    })
    .select('*')
    .single();

  if (recommendation.error) {
    return { data: null, error: recommendation.error };
  }

  await supabase.from('daily_entries').update({ status: 'planned' }).eq('id', dailyEntryId);

  return {
    data: {
      entryId: dailyEntryId,
      analysis: analysis.data.signals,
      skinStory: recommendation.data.skin_story,
      dailyPlan: recommendation.data.daily_plan,
      safetyNotes: recommendation.data.safety_notes,
      isGenerated: true,
    },
    error: null,
  };
}

async function generateRecommendationCopy(
  dailyEntryId: string,
  checkIn: CheckInResponses,
  generated: Omit<TodayRecommendation, 'entryId' | 'isGenerated'>,
  profileContext: ProfileContext
): Promise<GeneratedRecommendation> {
  const fallback = personalizeFallbackRecommendation(
    {
    headline: generated.skinStory.headline,
    summary: generated.skinStory.summary,
    contributors: generated.skinStory.contributors,
    priority: generated.skinStory.priority,
    dailyPlan: generated.dailyPlan,
    safetyNotes: generated.safetyNotes,
    provider: 'substrate-prototype',
    model: 'rules-v1',
    rawResponse: null,
    },
    profileContext
  );

  try {
    const response = await supabase.functions.invoke('generate-recommendation', {
      body: {
        dailyEntryId,
        profileContext,
        checkIn,
        analysis: generated.analysis,
        fallback: {
          skinStory: generated.skinStory,
          dailyPlan: generated.dailyPlan,
          safetyNotes: generated.safetyNotes,
        },
      },
    });

    if (response.error || !response.data) {
      console.warn('AI recommendation generation unavailable; using rules fallback.', response.error);
      return fallback;
    }

    const normalized = normalizeAiRecommendation(response.data);

    return normalized ?? fallback;
  } catch (error) {
    console.warn('AI recommendation generation failed; using rules fallback.', error);
    return fallback;
  }
}

function normalizeAiRecommendation(data: unknown): GeneratedRecommendation | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const value = data as {
    skinStory?: SkinStory;
    dailyPlan?: DailyPlan;
    safetyNotes?: unknown;
    provider?: unknown;
    model?: unknown;
    rawResponse?: unknown;
  };
  const skinStory = value.skinStory;
  const dailyPlan = value.dailyPlan;

  if (!skinStory?.headline || !skinStory.summary || !skinStory.priority || !dailyPlan?.priorities?.length || !dailyPlan.avoid?.length) {
    return null;
  }

  return {
    headline: skinStory.headline,
    summary: skinStory.summary,
    contributors: skinStory.contributors?.length ? skinStory.contributors : [],
    priority: skinStory.priority,
    dailyPlan: {
      priorities: dailyPlan.priorities,
      avoid: dailyPlan.avoid,
    },
    safetyNotes: Array.isArray(value.safetyNotes) ? value.safetyNotes.filter((item): item is string => typeof item === 'string') : [],
    provider: typeof value.provider === 'string' ? value.provider : 'openai',
    model: typeof value.model === 'string' ? value.model : 'unknown',
    rawResponse: isJson(value.rawResponse) ? value.rawResponse : null,
  };
}

function personalizeFallbackRecommendation(
  recommendation: GeneratedRecommendation,
  profileContext: ProfileContext
): GeneratedRecommendation {
  const profileContributor = buildProfileContributor(profileContext);
  const profilePriority = buildProfilePriority(profileContext);

  return {
    ...recommendation,
    contributors: profileContributor
      ? [profileContributor, ...recommendation.contributors.filter((item) => item.label !== profileContributor.label)].slice(0, 4)
      : recommendation.contributors,
    dailyPlan: {
      priorities: profilePriority
        ? [profilePriority, ...recommendation.dailyPlan.priorities.filter((item) => item.title !== profilePriority.title)].slice(0, 3)
        : recommendation.dailyPlan.priorities,
      avoid: recommendation.dailyPlan.avoid,
    },
  };
}

function buildProfileContributor(profileContext: ProfileContext) {
  if (profileContext.sensitivityLevel === 'High') {
    return {
      label: 'High sensitivity baseline',
      detail: 'Your profile suggests a lower threshold for irritation, so conservative changes matter today.',
    };
  }

  if (profileContext.skinType === 'Dry') {
    return {
      label: 'Dry skin baseline',
      detail: 'Your baseline skin type makes hydration and barrier support more important.',
    };
  }

  const trigger = profileContext.knownTriggers?.[0];
  if (trigger) {
    return {
      label: `${trigger} trigger`,
      detail: 'This saved profile trigger should be treated as a possible contributor when symptoms shift.',
    };
  }

  const goal = profileContext.skinGoals?.[0];
  if (goal) {
    return {
      label: `${goal} goal`,
      detail: 'Your saved goal helps prioritize today’s plan toward what you are tracking over time.',
    };
  }

  if (profileContext.skinContextNote?.trim()) {
    return {
      label: 'Profile note',
      detail: 'Your saved note adds context for interpreting today’s skin signals.',
    };
  }

  return null;
}

function buildProfilePriority(profileContext: ProfileContext) {
  if (profileContext.sensitivityLevel === 'High' || profileContext.knownTriggers?.includes('Strong actives')) {
    return {
      title: 'Keep the routine low-risk',
      detail: 'Your profile context points to sensitivity or active-related triggers.',
      actions: ['Avoid adding new strong actives today', 'Keep cleanser and moisturizer familiar', 'Prioritize SPF and barrier support'],
    };
  }

  if (profileContext.skinType === 'Dry' || profileContext.skinGoals?.includes('Hydration')) {
    return {
      title: 'Prioritize hydration and barrier support',
      detail: 'Your profile baseline makes moisture balance a useful daily focus.',
      actions: ['Use a gentle cleanser', 'Layer moisturizer while skin is slightly damp', 'Avoid unnecessary exfoliation today'],
    };
  }

  if (profileContext.skinGoals?.includes('Breakouts')) {
    return {
      title: 'Reduce breakout variables',
      detail: 'Your profile goal makes consistency more useful than adding new products.',
      actions: ['Keep products familiar today', 'Avoid heavy occlusive layers if congested', 'Track any new product exposure'],
    };
  }

  return null;
}

function isJson(value: unknown): value is Json {
  if (value === null) return true;
  if (['string', 'number', 'boolean'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJson);
  if (typeof value !== 'object') return false;

  return Object.values(value).every(isJson);
}

export async function getAnalysisScoresForEntries(userId: string, dailyEntryIds: string[]) {
  if (dailyEntryIds.length === 0) {
    return { data: {}, error: null };
  }

  const analysis = await supabase
    .from('analysis_results')
    .select('daily_entry_id, signals, created_at')
    .eq('user_id', userId)
    .in('daily_entry_id', dailyEntryIds)
    .order('created_at', { ascending: false });

  if (analysis.error) {
    return { data: {}, error: analysis.error };
  }

  const scoresByEntryId: Record<string, AnalysisSignals> = {};

  for (const result of analysis.data ?? []) {
    if (!scoresByEntryId[result.daily_entry_id]) {
      scoresByEntryId[result.daily_entry_id] = result.signals;
    }
  }

  return { data: scoresByEntryId, error: null };
}

export async function getLatestRecommendation(userId: string, dailyEntryId: string) {
  const recommendation = await supabase
    .from('recommendation_results')
    .select('*')
    .eq('daily_entry_id', dailyEntryId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recommendation.error || !recommendation.data) {
    return { data: null, error: recommendation.error };
  }

  const analysis = await supabase
    .from('analysis_results')
    .select('*')
    .eq('daily_entry_id', dailyEntryId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (analysis.error) {
    return { data: null, error: analysis.error };
  }

  return {
    data: {
      entryId: dailyEntryId,
      analysis: analysis.data?.signals ?? {},
      skinStory: recommendation.data.skin_story,
      dailyPlan: recommendation.data.daily_plan,
      safetyNotes: recommendation.data.safety_notes,
    },
    error: null,
  };
}

function buildRecommendation(
  checkIn: CheckInResponses,
  hasPhoto: boolean,
  photoAnalysis?: PhotoAnalysis,
  environment?: EnvironmentSnapshot,
  priorScore?: number
): Omit<TodayRecommendation, 'entryId' | 'isGenerated'> {
  const inflammation = scoreInflammation(checkIn, photoAnalysis);
  const dryness = scoreDryness(checkIn, photoAnalysis);
  const congestion = scoreCongestion(checkIn, photoAnalysis);
  const fatigue = scoreFatigue(checkIn, photoAnalysis);
  const skinHealth = calculateSkinHealthScore(checkIn, hasPhoto, photoAnalysis, environment, priorScore);
  const topSignal = getTopSignal({ inflammation, dryness, congestion, fatigue });
  const contributors = buildContributors(checkIn, hasPhoto, skinHealth.drivers);
  const avoid = buildAvoidList(checkIn, topSignal);
  const priority = buildPriority(topSignal, skinHealth.scoreBand);

  return {
    analysis: {
      redness: inflammation,
      dryness,
      congestion,
      fatigue,
      photoQuality: calculatePhotoQuality(hasPhoto, photoAnalysis),
      photoAnalysis,
      environment,
      skinHealthScore: skinHealth.score,
      scoreBand: skinHealth.scoreBand,
      scoreDelta: skinHealth.scoreDelta,
      drivers: skinHealth.drivers,
      confidence: skinHealth.confidence,
    },
    skinStory: {
      headline: buildHeadline(topSignal, skinHealth.scoreBand),
      summary: buildSummary(topSignal, checkIn, hasPhoto, skinHealth),
      contributors,
      priority,
    },
    dailyPlan: {
      priorities: buildPlan(topSignal, checkIn),
      avoid,
    },
    safetyNotes: ['Patch test new products and avoid treating sudden or severe symptoms as cosmetic only.'],
  };
}

async function getPriorSkinHealthScore(userId: string, currentEntryDate: string) {
  const entries = await supabase
    .from('daily_entries')
    .select('id')
    .eq('user_id', userId)
    .lt('entry_date', currentEntryDate)
    .order('entry_date', { ascending: false })
    .limit(10);

  if (entries.error || !entries.data?.length) {
    return undefined;
  }

  const entryIds = entries.data.map((entry) => entry.id);
  const scores = await getAnalysisScoresForEntries(userId, entryIds);

  if (scores.error) {
    return undefined;
  }

  for (const entryId of entryIds) {
    const score = scores.data[entryId]?.skinHealthScore;

    if (typeof score === 'number') {
      return score;
    }
  }

  return undefined;
}

function calculateSkinHealthScore(
  checkIn: CheckInResponses,
  hasPhoto: boolean,
  photoAnalysis?: PhotoAnalysis,
  environment?: EnvironmentSnapshot,
  priorScore?: number
) {
  const drivers: ScoreDriver[] = [];
  let score = 100;

  applyDriver(drivers, 'Poor sleep', checkIn.sleepQuality === 'Poor' ? -10 : 0);
  applyDriver(drivers, 'Okay sleep', checkIn.sleepQuality === 'Okay' ? -4 : 0);
  applyDriver(drivers, 'Rested sleep', checkIn.sleepQuality === 'Rested' ? 3 : 0);
  applyDriver(drivers, 'High stress', checkIn.stressLevel === 'High' ? -12 : 0);
  applyDriver(drivers, 'Medium stress', checkIn.stressLevel === 'Medium' ? -6 : 0);
  applyDriver(drivers, 'Low stress', checkIn.stressLevel === 'Low' ? 3 : 0);
  applyDriver(drivers, 'Light alcohol', checkIn.alcoholConsumption === 'Light' ? -2 : 0);
  applyDriver(drivers, 'Moderate alcohol', checkIn.alcoholConsumption === 'Moderate' ? -6 : 0);
  applyDriver(drivers, 'High alcohol', checkIn.alcoholConsumption === 'High' ? -12 : 0);
  applyDriver(drivers, 'No alcohol', checkIn.alcoholConsumption === 'None' ? 2 : 0);
  applyDriver(drivers, 'Luteal phase', checkIn.cyclePhase === 'Luteal' ? -4 : 0);
  applyDriver(drivers, 'Menstrual phase', checkIn.cyclePhase === 'Menstrual' ? -3 : 0);
  applyRoutineDrivers(drivers, checkIn);
  applyDriver(drivers, 'No saved photo', !hasPhoto ? -8 : 0);
  applyPhotoAnalysisDrivers(drivers, hasPhoto, photoAnalysis);
  applyEnvironmentDrivers(drivers, environment);

  for (const driver of drivers) {
    score += driver.impact;
  }

  const finalScore = clamp(score, 1, 100);

  return {
    score: finalScore,
    scoreBand: getScoreBand(finalScore),
    scoreDelta: typeof priorScore === 'number' ? finalScore - priorScore : undefined,
    drivers: drivers.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)),
    confidence: calculateConfidence(checkIn, hasPhoto, photoAnalysis, environment),
  };
}

function applyPhotoAnalysisDrivers(drivers: ScoreDriver[], hasPhoto: boolean, photoAnalysis?: PhotoAnalysis) {
  if (!hasPhoto) {
    return;
  }

  if (!photoAnalysis?.analyzedAt) {
    applyDriver(drivers, 'Photo analysis unavailable', -3);
    return;
  }

  applyDriver(drivers, 'Face not clearly detected', photoAnalysis.faceDetected === false ? -12 : 0);
  applyDriver(drivers, 'Low photo lighting', isBelow(photoAnalysis.lighting, 55) ? -4 : 0);
  applyDriver(drivers, 'Soft photo focus', isBelow(photoAnalysis.sharpness, 55) ? -4 : 0);
  applyDriver(drivers, 'Off-center photo', isBelow(photoAnalysis.framing, 55) ? -3 : 0);
  applyVisualDriver(drivers, 'Visible redness', photoAnalysis.redness, -5, -10);
  applyVisualDriver(drivers, 'Visible dryness', photoAnalysis.dryness, -4, -8);
  applyVisualDriver(drivers, 'Visible congestion', photoAnalysis.congestion, -4, -8);
  applyVisualDriver(drivers, 'Visible fatigue', photoAnalysis.fatigue, -3, -6);
  applyVisualDriver(drivers, 'Uneven tone signal', photoAnalysis.toneUnevenness, -3, -6);

  if (isAtLeast(photoAnalysis.lighting, 75) && isAtLeast(photoAnalysis.sharpness, 75) && isAtLeast(photoAnalysis.framing, 75)) {
    applyDriver(drivers, 'High-quality photo', 2);
  }
}

function applyRoutineDrivers(drivers: ScoreDriver[], checkIn: CheckInResponses) {
  const note = getRoutineContext(checkIn);

  if (!note) {
    applyDriver(drivers, 'Routine consistency', 2);
    return;
  }

  if (/(retinol|retinoid|tretinoin|exfoliat|aha|bha|peel|active)/i.test(note)) {
    applyDriver(drivers, 'Strong actives', -10);
    return;
  }

  if (/(laser|facial|microneedl|treatment|wax|procedure)/i.test(note)) {
    applyDriver(drivers, 'Recent treatment', -8);
    return;
  }

  if (/(new|first time|changed|switch)/i.test(note)) {
    applyDriver(drivers, 'New product', -5);
  }
}

function applyVisualDriver(drivers: ScoreDriver[], label: string, value: number | undefined, moderateImpact: number, highImpact: number) {
  if (typeof value !== 'number') {
    return;
  }

  if (value >= 70) {
    applyDriver(drivers, label, highImpact);
  } else if (value >= 45) {
    applyDriver(drivers, label, moderateImpact);
  }
}

function applyEnvironmentDrivers(drivers: ScoreDriver[], environment?: EnvironmentSnapshot) {
  if (!environment) {
    applyDriver(drivers, 'No environment data', -5);
    return;
  }

  const uvIndex = environment.uvIndex;
  const humidity = environment.humidity;
  const usAqi = environment.usAqi;
  const pm25 = environment.pm25;
  const temperatureF = environment.temperatureF;

  if (typeof uvIndex === 'number') {
    if (uvIndex >= 8) {
      applyDriver(drivers, 'Very high UV', -8);
    } else if (uvIndex >= 6) {
      applyDriver(drivers, 'High UV', -4);
    } else if (uvIndex <= 2) {
      applyDriver(drivers, 'Low UV exposure', 1);
    }
  }

  if (typeof humidity === 'number') {
    if (humidity < 30) {
      applyDriver(drivers, 'Very low humidity', -7);
    } else if (humidity < 40) {
      applyDriver(drivers, 'Low humidity', -4);
    } else if (humidity >= 40 && humidity <= 60) {
      applyDriver(drivers, 'Balanced humidity', 2);
    }
  }

  if (typeof usAqi === 'number') {
    if (usAqi > 150) {
      applyDriver(drivers, 'Elevated air quality risk', -10);
    } else if (usAqi > 100) {
      applyDriver(drivers, 'Poor air quality', -6);
    } else if (usAqi > 50) {
      applyDriver(drivers, 'Moderate air quality', -3);
    }
  }

  if (typeof pm25 === 'number' && pm25 > 35) {
    applyDriver(drivers, 'Elevated PM2.5', -4);
  }

  if (typeof temperatureF === 'number') {
    if (temperatureF >= 90) {
      applyDriver(drivers, 'High heat', -4);
    } else if (temperatureF <= 35) {
      applyDriver(drivers, 'Cold air exposure', -3);
    }
  }
}

function applyDriver(drivers: ScoreDriver[], label: string, impact: number) {
  if (impact === 0) {
    return;
  }

  drivers.push({
    label,
    impact,
    direction: impact > 0 ? 'positive' : 'negative',
  });
}

function getScoreBand(score: number): NonNullable<AnalysisSignals['scoreBand']> {
  if (score >= 85) return 'stable';
  if (score >= 70) return 'balanced';
  if (score >= 55) return 'stressed';
  if (score >= 40) return 'reactive';
  return 'high_stress';
}

function calculateConfidence(
  checkIn: CheckInResponses,
  hasPhoto: boolean,
  photoAnalysis?: PhotoAnalysis,
  environment?: EnvironmentSnapshot
) {
  const requiredSignals = [
    checkIn.sleepQuality,
    checkIn.stressLevel,
    checkIn.alcoholConsumption,
    checkIn.cyclePhase,
    checkIn.routineChange,
  ];
  const completedSignals = requiredSignals.filter(Boolean).length;
  const missingSignals = requiredSignals.length - completedSignals;
  const baseConfidence = hasPhoto ? 70 : 45;
  const environmentBoost = environment ? 8 : -6;
  const photoAnalysisBoost = photoAnalysis?.analyzedAt ? 10 : hasPhoto ? -3 : 0;

  return clamp(baseConfidence + completedSignals * 3 - missingSignals * 5 + environmentBoost + photoAnalysisBoost, 0, 100);
}

function scoreInflammation(checkIn: CheckInResponses, photoAnalysis?: PhotoAnalysis) {
  let score = 8;
  if (checkIn.stressLevel === 'High') score += 10;
  if (checkIn.stressLevel === 'Medium') score += 6;
  if (checkIn.sleepQuality === 'Poor') score += 8;
  if (checkIn.alcoholConsumption === 'Moderate') score += 6;
  if (checkIn.alcoholConsumption === 'High') score += 10;
  if (checkIn.cyclePhase === 'Luteal') score += 5;
  if (checkIn.cyclePhase === 'Menstrual') score += 4;
  const routineContext = getRoutineContext(checkIn);
  if (/(retinol|retinoid|tretinoin|exfoliat|aha|bha|peel|active|laser|facial|microneedl|treatment|wax|procedure)/i.test(routineContext)) score += 10;
  score += scaleVisualSignal(photoAnalysis?.redness, 0.35);
  return clamp(score);
}

function scoreDryness(checkIn: CheckInResponses, photoAnalysis?: PhotoAnalysis) {
  let score = 7;
  if (checkIn.sleepQuality === 'Poor') score += 4;
  if (checkIn.alcoholConsumption === 'Moderate') score += 5;
  if (checkIn.alcoholConsumption === 'High') score += 9;
  if (/(retinol|retinoid|tretinoin|exfoliat|aha|bha|peel|active)/i.test(getRoutineContext(checkIn))) score += 8;
  score += scaleVisualSignal(photoAnalysis?.dryness, 0.35);
  return clamp(score);
}

function scoreCongestion(checkIn: CheckInResponses, photoAnalysis?: PhotoAnalysis) {
  let score = 6;
  if (checkIn.stressLevel === 'High') score += 6;
  if (checkIn.cyclePhase === 'Luteal') score += 6;
  if (checkIn.cyclePhase === 'Menstrual') score += 4;
  if (/(new|first time|changed|switch)/i.test(getRoutineContext(checkIn))) score += 5;
  score += scaleVisualSignal(photoAnalysis?.congestion, 0.35);
  return clamp(score);
}

function scoreFatigue(checkIn: CheckInResponses, photoAnalysis?: PhotoAnalysis) {
  let score = 5;
  if (checkIn.sleepQuality === 'Poor') score += 18;
  if (checkIn.sleepQuality === 'Okay') score += 9;
  if (checkIn.stressLevel === 'High') score += 7;
  score += scaleVisualSignal(photoAnalysis?.fatigue, 0.3);
  return clamp(score);
}

function getTopSignal(scores: Record<string, number>) {
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'inflammation';
}

function buildHeadline(topSignal: string, scoreBand: NonNullable<AnalysisSignals['scoreBand']>) {
  if (scoreBand === 'stable') return 'Your skin score looks stable today.';
  if (scoreBand === 'balanced') return 'Your skin score is generally balanced today.';
  if (scoreBand === 'high_stress') return 'Your skin score shows a high-stress day.';
  if (topSignal === 'dryness') return 'Your skin may need more barrier support today.';
  if (topSignal === 'congestion') return 'Your skin may be trending more congested today.';
  if (topSignal === 'fatigue') return 'Your skin may be showing recovery stress today.';
  return 'Your skin may be more reactive today.';
}

function buildSummary(
  topSignal: string,
  checkIn: CheckInResponses,
  hasPhoto: boolean,
  skinHealth: ReturnType<typeof calculateSkinHealthScore>
) {
  const photoCopy = hasPhoto ? 'paired with today’s photo' : 'without a saved photo yet';
  const deltaCopy =
    typeof skinHealth.scoreDelta === 'number'
      ? ` This is ${formatDelta(skinHealth.scoreDelta)} from your last scored check-in.`
      : ' This is your first scored check-in.';

  return `Based on your check-in ${photoCopy}, your Skin Score is ${skinHealth.score}. The strongest prototype signal is ${topSignal}.${deltaCopy}`;
}

function buildPriority(topSignal: string, scoreBand?: NonNullable<AnalysisSignals['scoreBand']>) {
  if (scoreBand === 'stable') return 'Keep your routine consistent and preserve the baseline.';
  if (scoreBand === 'balanced') return 'Maintain consistency and avoid adding unnecessary variables.';
  if (scoreBand === 'high_stress') return 'Simplify aggressively and focus on recovery.';
  if (topSignal === 'dryness') return 'Rebuild hydration and reduce friction.';
  if (topSignal === 'congestion') return 'Keep pores clear without over-stripping.';
  if (topSignal === 'fatigue') return 'Prioritize recovery and reduce unnecessary actives.';
  return 'Calm inflammation and support the skin barrier.';
}

function buildContributors(checkIn: CheckInResponses, hasPhoto: boolean, drivers: ScoreDriver[]) {
  const contributors: Array<{ label: string; detail: string }> = [];
  const driverContributors = drivers
    .filter((driver) => driver.direction === 'negative')
    .slice(0, 4)
    .map((driver) => ({
      label: driver.label,
      detail: `${Math.abs(driver.impact)} point impact on today’s Skin Score.`,
    }));

  if (driverContributors.length > 0) {
    return driverContributors;
  }

  if (checkIn.sleepQuality === 'Poor') contributors.push({ label: 'Poor sleep', detail: 'Lower recovery may increase visible stress signals.' });
  if (checkIn.stressLevel === 'High' || checkIn.stressLevel === 'Medium') contributors.push({ label: `${checkIn.stressLevel} stress`, detail: 'Stress can amplify reactivity and uneven tone.' });
  if (checkIn.alcoholConsumption === 'Moderate' || checkIn.alcoholConsumption === 'High') contributors.push({ label: `${checkIn.alcoholConsumption} alcohol`, detail: 'Alcohol may affect hydration, recovery, and visible redness.' });
  if (checkIn.cyclePhase === 'Luteal') contributors.push({ label: 'Luteal phase', detail: 'Barrier and blemish sensitivity may be elevated.' });
  if (checkIn.cyclePhase === 'Menstrual') contributors.push({ label: 'Menstrual phase', detail: 'Inflammation and sensitivity can shift during this phase.' });
  const routineContext = getRoutineContext(checkIn);
  if (/(retinol|retinoid|tretinoin|exfoliat|aha|bha|peel|active)/i.test(routineContext)) contributors.push({ label: 'Strong actives', detail: 'Retinoids or exfoliants may increase short-term sensitivity.' });
  if (/(new|first time|changed|switch)/i.test(routineContext)) contributors.push({ label: 'New product', detail: 'New variables can make changes harder to interpret.' });
  if (/(laser|facial|microneedl|treatment|wax|procedure)/i.test(routineContext)) contributors.push({ label: 'Recent treatment', detail: 'Professional or at-home treatments can temporarily affect redness.' });
  if (!hasPhoto) contributors.push({ label: 'No saved photo', detail: 'Add a photo to improve future comparison quality.' });

  return contributors.slice(0, 4);
}

function buildPlan(topSignal: string, checkIn: CheckInResponses) {
  const base = [
    {
      title: topSignal === 'dryness' ? '1. Restore hydration' : '1. Calm the primary signal',
      detail: buildPriority(topSignal),
      actions:
        topSignal === 'congestion'
          ? ['Use a gentle cleanse', 'Avoid heavy occlusive layering', 'Keep treatment targeted']
          : ['Use a low-friction cleanse', 'Apply a calming serum', 'Seal with barrier moisturizer'],
    },
    {
      title: '2. Keep the routine simple',
      detail: 'Limit variables so tomorrow’s check-in is easier to interpret.',
      actions: ['Avoid adding new actives', 'Use familiar products', 'Track any irritation'],
    },
  ];

  if (checkIn.sleepQuality === 'Poor' || checkIn.stressLevel === 'High') {
    base.push({
      title: '3. Support recovery',
      detail: 'Your context signals suggest recovery should be part of the skincare plan.',
      actions: ['Prioritize sleep tonight', 'Avoid high-heat treatments', 'Keep evening routine short'],
    });
  } else if (checkIn.alcoholConsumption === 'Moderate' || checkIn.alcoholConsumption === 'High') {
    base.push({
      title: '3. Rehydrate and protect',
      detail: 'Alcohol can make hydration and barrier support more important today.',
      actions: ['Add a hydrating layer', 'Use barrier moisturizer', 'Keep SPF consistent'],
    });
  } else {
    base.push({
      title: '3. Maintain consistency',
      detail: 'Your check-in does not suggest a major escalation today.',
      actions: ['Stay consistent with SPF', 'Hydrate through the day', 'Repeat the same photo setup tomorrow'],
    });
  }

  return base;
}

function buildAvoidList(checkIn: CheckInResponses, topSignal: string) {
  const avoid = ['Strong exfoliation', 'High-heat treatments'];

  if (topSignal === 'inflammation' || /(retinol|retinoid|tretinoin|exfoliat|aha|bha|peel|active)/i.test(getRoutineContext(checkIn))) avoid.unshift('Retinoids');
  if (topSignal === 'dryness') avoid.unshift('Foaming cleansers');
  if (topSignal === 'congestion') avoid.unshift('Heavy facial oils');
  if (checkIn.alcoholConsumption === 'Moderate' || checkIn.alcoholConsumption === 'High') avoid.push('Dehydrating masks');

  return Array.from(new Set(avoid)).slice(0, 4);
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function calculatePhotoQuality(hasPhoto: boolean, photoAnalysis?: PhotoAnalysis) {
  if (!hasPhoto) {
    return 35;
  }

  if (!photoAnalysis?.analyzedAt) {
    return 72;
  }

  const qualityScores = [photoAnalysis.lighting, photoAnalysis.sharpness, photoAnalysis.framing].filter(
    (value): value is number => typeof value === 'number'
  );

  if (qualityScores.length === 0) {
    return 72;
  }

  return Math.round(qualityScores.reduce((total, value) => total + value, 0) / qualityScores.length);
}

function scaleVisualSignal(value: number | undefined, weight: number) {
  return typeof value === 'number' ? Math.round(value * weight) : 0;
}

function isBelow(value: number | undefined, threshold: number) {
  return typeof value === 'number' && value < threshold;
}

function isAtLeast(value: number | undefined, threshold: number) {
  return typeof value === 'number' && value >= threshold;
}

function formatDelta(delta: number) {
  if (delta > 0) return `up ${delta} points`;
  if (delta < 0) return `down ${Math.abs(delta)} points`;
  return 'unchanged';
}

function getRoutineContext(checkIn: CheckInResponses) {
  return checkIn.routineNote?.trim() || checkIn.routineChange || '';
}
