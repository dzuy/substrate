import { supabase } from '@/lib/supabase';
import type { AnalysisSignals, CheckInResponses, DailyPlan, SkinStory } from '@/types/database';

type TodayRecommendation = {
  entryId: string;
  analysis: AnalysisSignals;
  skinStory: Required<Pick<SkinStory, 'headline' | 'summary' | 'contributors' | 'priority'>>;
  dailyPlan: Required<Pick<DailyPlan, 'priorities' | 'avoid'>>;
  safetyNotes: string[];
  isGenerated: boolean;
};

export async function getOrCreateTodayRecommendation(userId: string, dailyEntryId: string) {
  const existing = await getLatestRecommendation(userId, dailyEntryId);

  if (existing.error) {
    return existing;
  }

  if (existing.data) {
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
    .select('id')
    .eq('daily_entry_id', dailyEntryId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (photo.error) {
    return { data: null, error: photo.error };
  }

  const generated = buildRecommendation(entry.data.check_in, Boolean(photo.data));

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

  const recommendation = await supabase
    .from('recommendation_results')
    .insert({
      user_id: userId,
      daily_entry_id: dailyEntryId,
      provider: 'substrate-prototype',
      model: 'rules-v1',
      skin_story: generated.skinStory,
      daily_plan: generated.dailyPlan,
      safety_notes: generated.safetyNotes,
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

function buildRecommendation(checkIn: CheckInResponses, hasPhoto: boolean): Omit<TodayRecommendation, 'entryId' | 'isGenerated'> {
  const inflammation = scoreInflammation(checkIn);
  const dryness = scoreDryness(checkIn);
  const congestion = scoreCongestion(checkIn);
  const fatigue = scoreFatigue(checkIn);
  const topSignal = getTopSignal({ inflammation, dryness, congestion, fatigue });
  const contributors = buildContributors(checkIn, hasPhoto);
  const avoid = buildAvoidList(checkIn, topSignal);
  const priority = buildPriority(topSignal);

  return {
    analysis: {
      redness: inflammation,
      dryness,
      congestion,
      fatigue,
      photoQuality: hasPhoto ? 72 : 35,
    },
    skinStory: {
      headline: buildHeadline(topSignal),
      summary: buildSummary(topSignal, checkIn, hasPhoto),
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

function scoreInflammation(checkIn: CheckInResponses) {
  let score = 8;
  if (checkIn.skinFeel === 'Reactive') score += 14;
  if (checkIn.stressLevel === 'High') score += 10;
  if (checkIn.stressLevel === 'Medium') score += 6;
  if (checkIn.sleepQuality === 'Poor') score += 8;
  if (checkIn.cyclePhase === 'Luteal') score += 5;
  return clamp(score);
}

function scoreDryness(checkIn: CheckInResponses) {
  let score = 7;
  if (checkIn.skinFeel === 'Dry') score += 18;
  if (checkIn.activityLevel === 'Intense') score += 5;
  if (checkIn.sleepQuality === 'Poor') score += 4;
  return clamp(score);
}

function scoreCongestion(checkIn: CheckInResponses) {
  let score = 6;
  if (checkIn.skinFeel === 'Congested') score += 18;
  if (checkIn.stressLevel === 'High') score += 6;
  if (checkIn.cyclePhase === 'Luteal') score += 6;
  return clamp(score);
}

function scoreFatigue(checkIn: CheckInResponses) {
  let score = 5;
  if (checkIn.sleepQuality === 'Poor') score += 18;
  if (checkIn.sleepQuality === 'Okay') score += 9;
  if (checkIn.stressLevel === 'High') score += 7;
  return clamp(score);
}

function getTopSignal(scores: Record<string, number>) {
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'inflammation';
}

function buildHeadline(topSignal: string) {
  if (topSignal === 'dryness') return 'Your skin may need more barrier support today.';
  if (topSignal === 'congestion') return 'Your skin may be trending more congested today.';
  if (topSignal === 'fatigue') return 'Your skin may be showing recovery stress today.';
  return 'Your skin may be more reactive today.';
}

function buildSummary(topSignal: string, checkIn: CheckInResponses, hasPhoto: boolean) {
  const photoCopy = hasPhoto ? 'paired with today’s photo' : 'without a saved photo yet';
  return `Based on your check-in ${photoCopy}, the strongest prototype signal is ${topSignal}. Current analysis is rules-based and intentionally conservative.`;
}

function buildPriority(topSignal: string) {
  if (topSignal === 'dryness') return 'Rebuild hydration and reduce friction.';
  if (topSignal === 'congestion') return 'Keep pores clear without over-stripping.';
  if (topSignal === 'fatigue') return 'Prioritize recovery and reduce unnecessary actives.';
  return 'Calm inflammation and support the skin barrier.';
}

function buildContributors(checkIn: CheckInResponses, hasPhoto: boolean) {
  const contributors: Array<{ label: string; detail: string }> = [];

  if (checkIn.sleepQuality === 'Poor') contributors.push({ label: 'Poor sleep', detail: 'Lower recovery may increase visible stress signals.' });
  if (checkIn.stressLevel === 'High' || checkIn.stressLevel === 'Medium') contributors.push({ label: `${checkIn.stressLevel} stress`, detail: 'Stress can amplify reactivity and uneven tone.' });
  if (checkIn.cyclePhase === 'Luteal') contributors.push({ label: 'Luteal phase', detail: 'Barrier and blemish sensitivity may be elevated.' });
  if (checkIn.activityLevel === 'Intense') contributors.push({ label: 'Intense activity', detail: 'Heat and sweat may add temporary irritation.' });
  if (checkIn.skinFeel) contributors.push({ label: `${checkIn.skinFeel} skin feel`, detail: 'Your self-reported skin state is weighted in the plan.' });
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

  if (topSignal === 'inflammation' || checkIn.skinFeel === 'Reactive') avoid.unshift('Retinoids');
  if (topSignal === 'dryness') avoid.unshift('Foaming cleansers');
  if (topSignal === 'congestion') avoid.unshift('Heavy facial oils');

  return Array.from(new Set(avoid)).slice(0, 4);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}
