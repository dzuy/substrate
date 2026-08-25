import {
  stateAvoids,
  stateIngredientsToFavor,
  stateLabels,
  statePriorities,
} from '@/skin-intelligence/skinStoryRules';
import type {
  SkinFrameworkDimension,
  SkinStory,
  SkinStoryInputs,
  SkinStoryScores,
  SkinStoryState,
} from '@/skin-intelligence/skinStoryTypes';

type Reason = {
  state: SkinStoryState;
  text: string;
};

export function buildSkinStory(inputs: SkinStoryInputs): SkinStory {
  const { reasons, scores } = scoreSkinStates(inputs);
  const rankedStates = (Object.entries(scores) as [SkinStoryState, number][]).sort((a, b) => b[1] - a[1]);
  const primaryState = rankedStates[0]?.[0] ?? 'barrier';
  const secondaryCandidate = rankedStates[1];
  const secondaryState =
    secondaryCandidate && secondaryCandidate[1] >= 35 && scores[primaryState] - secondaryCandidate[1] <= 18
      ? secondaryCandidate[0]
      : undefined;
  const storyReasons = buildReasons(reasons, primaryState, secondaryState);

  return {
    primaryState,
    secondaryState,
    headline: buildHeadline(primaryState, secondaryState, scores[primaryState]),
    summary: buildSummary(primaryState, secondaryState, storyReasons, inputs),
    reasons: storyReasons,
    frameworkRead: buildFrameworkRead(inputs, scores, primaryState, secondaryState),
    priorities: buildPriorities(primaryState, secondaryState),
    ingredientsToFavor: buildIngredientsToFavor(primaryState, secondaryState),
    ingredientsToAvoid: buildIngredientsToAvoid(primaryState, secondaryState, scores),
    contributors: storyReasons.map((reason) => ({ label: 'Possible contributor', detail: reason })),
    priority: statePriorities[primaryState][0],
  };
}

export function scoreSkinStates({ checkIn, environment, hasPhoto, photoAnalysis }: SkinStoryInputs) {
  const scores: SkinStoryScores = {
    barrier: 12,
    inflammation: 12,
    hydration: 12,
    breakout: 12,
  };
  const reasons: Reason[] = [];
  const contextText = [checkIn.yesterdayNote, checkIn.movementPlanNote, checkIn.routineNote].filter(Boolean).join(' ');

  addVisualScore(scores, reasons, 'barrier', photoAnalysis?.dryness, 0.36, 'Your photo shows more dryness today.');
  addVisualScore(scores, reasons, 'hydration', photoAnalysis?.dryness, 0.3, 'Visible dryness may point to lower hydration.');
  addVisualScore(scores, reasons, 'inflammation', photoAnalysis?.redness, 0.38, 'Your photo shows more redness today.');
  addVisualScore(scores, reasons, 'breakout', photoAnalysis?.congestion, 0.34, 'Your photo suggests more congestion or breakout activity.');

  if (!hasPhoto) {
    add(scores, reasons, 'barrier', 6, 'A saved photo would make today’s read more specific.');
  }

  if (checkIn.skinFeelToday === 'Dry') {
    add(scores, reasons, 'barrier', 16, 'Your skin feeling dry may be contributing.');
    add(scores, reasons, 'hydration', 14, 'Dry-feeling skin could be related to lower water balance.');
  }
  if (checkIn.skinFeelToday === 'Itchy') {
    add(scores, reasons, 'barrier', 14, 'Itch can suggest temporary barrier stress.');
    add(scores, reasons, 'inflammation', 12, 'Itch may also reflect irritation or inflammation.');
  }
  if (checkIn.skinFeelToday === 'Oily') {
    add(scores, reasons, 'breakout', 14, 'Your skin feeling oily may be contributing.');
  }
  if (checkIn.stressLevel === 'High') {
    add(scores, reasons, 'inflammation', 16, 'High stress could be related to more visible reactivity.');
    add(scores, reasons, 'breakout', 10, 'Stress may also contribute to oiliness or breakouts.');
  }
  if (checkIn.stressLevel === 'Medium') {
    add(scores, reasons, 'inflammation', 9, 'Moderate stress may be contributing.');
  }
  if (checkIn.sleepQuality === 'Poor') {
    add(scores, reasons, 'barrier', 10, 'Poor sleep may reduce overnight recovery.');
    add(scores, reasons, 'inflammation', 10, 'Poor sleep could be related to more redness or sensitivity.');
  }
  if (checkIn.sleepQuality === 'Okay') {
    add(scores, reasons, 'hydration', 5, 'Okay sleep may leave recovery slightly less complete.');
  }

  if (typeof environment?.humidity === 'number') {
    if (environment.humidity < 35) {
      add(scores, reasons, 'barrier', 14, 'Low humidity may be adding barrier stress.');
      add(scores, reasons, 'hydration', 14, 'Low humidity can make skin feel less hydrated.');
    } else if (environment.humidity > 70) {
      add(scores, reasons, 'breakout', 7, 'Higher humidity could be related to more oiliness.');
    }
  }

  if (/(travel|flight|plane|hotel|road trip|jet lag)/i.test(contextText)) {
    add(scores, reasons, 'barrier', 12, 'Recent travel may be contributing.');
    add(scores, reasons, 'hydration', 10, 'Travel can make hydration less predictable.');
  }
  if (/(low water|not enough water|dehydrat|thirsty|dry mouth)/i.test(contextText)) {
    add(scores, reasons, 'hydration', 16, 'Lower water intake could be related.');
  }
  if (/(breakout|blemish|pimple|acne)/i.test(contextText)) {
    add(scores, reasons, 'breakout', 12, 'Your notes mention breakout activity.');
  }
  if (/(retinol|retinoid|tretinoin|exfoliat|aha|bha|peel|active)/i.test(contextText)) {
    add(scores, reasons, 'barrier', 12, 'Strong actives may be contributing.');
    add(scores, reasons, 'inflammation', 10, 'Strong actives can temporarily increase reactivity.');
  }

  return { reasons, scores: clampScores(scores) };
}

function addVisualScore(
  scores: SkinStoryScores,
  reasons: Reason[],
  state: SkinStoryState,
  value: number | undefined,
  weight: number,
  text: string
) {
  if (typeof value !== 'number') {
    return;
  }

  const impact = Math.round(value * weight);
  scores[state] += impact;
  if (value >= 45) {
    reasons.push({ state, text });
  }
}

function add(scores: SkinStoryScores, reasons: Reason[], state: SkinStoryState, impact: number, text: string) {
  scores[state] += impact;
  reasons.push({ state, text });
}

function clampScores(scores: SkinStoryScores): SkinStoryScores {
  return {
    barrier: clamp(scores.barrier),
    inflammation: clamp(scores.inflammation),
    hydration: clamp(scores.hydration),
    breakout: clamp(scores.breakout),
  };
}

function buildReasons(reasons: Reason[], primaryState: SkinStoryState, secondaryState?: SkinStoryState) {
  const preferred = reasons.filter((reason) => reason.state === primaryState || reason.state === secondaryState);
  const fallback = reasons.length > 0 ? reasons : [{ state: primaryState, text: 'Your available inputs look relatively steady today.' }];
  return Array.from(new Set((preferred.length > 0 ? preferred : fallback).map((reason) => reason.text))).slice(0, 4);
}

function buildHeadline(primaryState: SkinStoryState, secondaryState: SkinStoryState | undefined, severity: number) {
  if (severity < 30) {
    return 'Your skin looks fairly steady today';
  }

  if (secondaryState) {
    return `Your skin may need ${stateLabels[primaryState].toLowerCase()} and ${stateLabels[secondaryState].toLowerCase()} support today`;
  }

  if (primaryState === 'barrier') return 'Your skin may need more barrier support today';
  if (primaryState === 'inflammation') return 'Your skin looks a little more reactive today';
  if (primaryState === 'hydration') return 'Your skin may be asking for more hydration today';
  return 'Your skin may be leaning oilier or more breakout-prone today';
}

function buildSummary(
  primaryState: SkinStoryState,
  secondaryState: SkinStoryState | undefined,
  reasons: string[],
  inputs: SkinStoryInputs
) {
  const stateCopy = secondaryState
    ? `${stateLabels[primaryState].toLowerCase()} with a secondary ${stateLabels[secondaryState].toLowerCase()} signal`
    : stateLabels[primaryState].toLowerCase();
  const sourceCopy = inputs.hasPhoto ? 'today’s photo and check-in' : 'today’s check-in';
  const reasonCopy = reasons[0]?.toLowerCase() ?? 'your available inputs look relatively steady';

  return `Based on ${sourceCopy}, we’re seeing a ${stateCopy} pattern. ${reasonCopy} The read below separates what may be changing today from the slower background dimensions we will track over time.`;
}

function buildFrameworkRead(
  inputs: SkinStoryInputs,
  scores: SkinStoryScores,
  primaryState: SkinStoryState,
  secondaryState?: SkinStoryState
) {
  return (['barrier', 'inflammation', 'hydration', 'collagen', 'pigmentation'] as SkinFrameworkDimension[]).map((dimension) => ({
    dimension,
    status: buildFrameworkStatus(dimension, scores, primaryState, secondaryState),
    detail: buildFrameworkDetail(dimension, inputs, scores),
  }));
}

function buildFrameworkStatus(
  dimension: SkinFrameworkDimension,
  scores: SkinStoryScores,
  primaryState: SkinStoryState,
  secondaryState?: SkinStoryState
) {
  if (dimension === primaryState) return 'Primary signal today';
  if (dimension === secondaryState) return 'Secondary signal today';
  if (dimension === 'collagen' || dimension === 'pigmentation') return 'Background context';
  if (scores[dimension] >= 35) return 'Mildly elevated';
  return 'Steady today';
}

function buildFrameworkDetail(dimension: SkinFrameworkDimension, inputs: SkinStoryInputs, scores: SkinStoryScores) {
  const { checkIn, environment, photoAnalysis } = inputs;
  const lowHumidity = typeof environment?.humidity === 'number' && environment.humidity < 35;
  const visibleDryness = typeof photoAnalysis?.dryness === 'number' && photoAnalysis.dryness >= 45;
  const visibleRedness = typeof photoAnalysis?.redness === 'number' && photoAnalysis.redness >= 45;
  const contextText = [checkIn.yesterdayNote, checkIn.movementPlanNote, checkIn.routineNote].filter(Boolean).join(' ');
  const recentTravel = /(travel|flight|plane|hotel|road trip|jet lag)/i.test(contextText);
  const lowWater = /(low water|not enough water|dehydrat|thirsty|dry mouth)/i.test(contextText);

  if (dimension === 'barrier') {
    if (scores.barrier >= 35) {
      return [
        visibleDryness ? 'visible dryness' : undefined,
        checkIn.skinFeelToday === 'Itchy' ? 'itchiness' : undefined,
        lowHumidity ? 'low humidity' : undefined,
        recentTravel ? 'recent travel' : undefined,
      ]
        .filter(Boolean)
        .join(', ')
        .replace(/^(.+)$/, 'Barrier looks more relevant because of $1. This can show up as tightness, roughness, or easier irritation.');
    }
    return 'Barrier does not look like the main pressure point today, so the goal is to keep it steady rather than over-correct.';
  }

  if (dimension === 'inflammation') {
    if (scores.inflammation >= 35) {
      return [
        visibleRedness ? 'visible redness' : undefined,
        checkIn.stressLevel === 'High' || checkIn.stressLevel === 'Medium' ? `${checkIn.stressLevel.toLowerCase()} stress` : undefined,
        checkIn.sleepQuality === 'Poor' ? 'poor sleep' : undefined,
      ]
        .filter(Boolean)
        .join(', ')
        .replace(/^(.+)$/, 'Inflammation may be part of the story because of $1. We should treat this as a possible reactivity pattern, not a diagnosis.');
    }
    return 'Inflammation looks relatively quiet in the available inputs, with no strong redness or stress-linked signal taking over.';
  }

  if (dimension === 'hydration') {
    if (scores.hydration >= 35) {
      return [
        visibleDryness ? 'dryness in the photo' : undefined,
        checkIn.skinFeelToday === 'Dry' ? 'dry-feeling skin' : undefined,
        lowHumidity ? 'low humidity' : undefined,
        lowWater ? 'lower water intake' : undefined,
      ]
        .filter(Boolean)
        .join(', ')
        .replace(/^(.+)$/, 'Hydration may need attention because of $1. This points more toward water balance and moisture retention than a permanent skin-type change.');
    }
    return 'Hydration does not appear to be the dominant issue today, though steady water intake and moisturizer still support the rest of the framework.';
  }

  if (dimension === 'collagen') {
    return 'Collagen is a slower-moving support dimension. Today’s daily inputs can influence recovery conditions, but we are not treating collagen as an acute daily state yet.';
  }

  if (visibleRedness || recentTravel || checkIn.cyclePhase === 'Luteal' || checkIn.cyclePhase === 'Menstrual') {
    return 'Pigmentation is background context today because inflammation, UV exposure, hormones, or irritation can affect pigment risk over time.';
  }

  return 'Pigmentation does not look like a main daily signal from the current inputs, but it remains part of the longer-term framework.';
}

function buildPriorities(primaryState: SkinStoryState, secondaryState?: SkinStoryState) {
  const priorities = [...statePriorities[primaryState], ...(secondaryState ? statePriorities[secondaryState] : [])];
  return Array.from(new Set(priorities)).slice(0, 3);
}

function buildIngredientsToFavor(primaryState: SkinStoryState, secondaryState?: SkinStoryState) {
  const ingredients = [
    ...stateIngredientsToFavor[primaryState],
    ...(secondaryState ? stateIngredientsToFavor[secondaryState] : []),
  ];
  return Array.from(new Set(ingredients)).slice(0, 4);
}

function buildIngredientsToAvoid(primaryState: SkinStoryState, secondaryState: SkinStoryState | undefined, scores: SkinStoryScores) {
  const avoid = [...(stateAvoids[primaryState] ?? []), ...(secondaryState ? stateAvoids[secondaryState] ?? [] : [])];

  if (scores.barrier < 35 && scores.inflammation < 35 && primaryState !== 'breakout') {
    return [];
  }

  return Array.from(new Set(avoid)).slice(0, 4);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
