import { stateLabels } from '@/skin-intelligence/skinStoryRules';
import type { SkinStory, SkinStoryState } from '@/skin-intelligence/skinStoryTypes';
import type { PlanItem, PlanMoment, TodayPlan, TodayPlanInput } from '@/skin-intelligence/todayPlanTypes';

type PlanTemplateItem = Omit<PlanItem, 'id' | 'completed'>;

export function generateTodayPlan({ date, id, skinStory, skinStoryId }: TodayPlanInput): TodayPlan {
  const items = buildPlanItems(skinStory).slice(0, 7).map((item, index) => ({
    ...item,
    id: `${item.moment}-${index}-${slugify(item.label)}`,
    completed: false,
  }));

  return {
    id,
    date,
    skinStoryId,
    context: buildPlanContext(skinStory),
    items,
  };
}

function buildPlanItems(skinStory: SkinStory): PlanTemplateItem[] {
  const secondary = skinStory.secondaryState;
  const primaryItems = getStateItems(skinStory.primaryState);
  const secondaryItems = secondary ? getSecondaryStateItems(secondary) : [];
  const baseItems = [
    ...primaryItems,
    ...secondaryItems,
    {
      moment: 'day' as const,
      label: 'Keep water intake steady',
      reason: 'Daily context can affect hydration and recovery signals.',
    },
  ];

  return dedupePlanItems(baseItems).sort((a, b) => getMomentOrder(a.moment) - getMomentOrder(b.moment));
}

function getStateItems(state: SkinStoryState): PlanTemplateItem[] {
  if (state === 'barrier') {
    return [
      { moment: 'morning', label: 'Use your gentle cleanser', reason: 'Lower-friction cleansing helps keep the barrier steady.' },
      { moment: 'morning', label: 'Apply barrier-support serum', reason: 'Today’s story points toward barrier support.' },
      { moment: 'morning', label: 'Moisturize before SPF', reason: 'Moisturizer helps reduce tightness and dryness.' },
      { moment: 'day', label: 'Reapply SPF if outdoors', reason: 'UV can add stress when the barrier is already a focus.' },
      { moment: 'evening', label: 'Use barrier-support moisturizer', reason: 'Evening is a good time to reinforce the barrier.' },
      { moment: 'evening', label: 'Skip strong acids tonight', reason: 'Reducing irritation keeps the plan conservative.' },
    ];
  }

  if (state === 'inflammation') {
    return [
      { moment: 'morning', label: 'Use your gentle cleanser', reason: 'Simple cleansing avoids adding irritation.' },
      { moment: 'morning', label: 'Apply a calming serum', reason: 'Today’s story points toward lower reactivity.' },
      { moment: 'morning', label: 'Apply SPF', reason: 'UV and heat can amplify visible redness.' },
      { moment: 'day', label: 'Avoid high-heat exposure', reason: 'Heat can make reactivity look stronger.' },
      { moment: 'evening', label: 'Keep the routine short', reason: 'Fewer steps make irritation easier to calm.' },
      { moment: 'evening', label: 'Skip exfoliation tonight', reason: 'Exfoliation can be too much on a reactive day.' },
    ];
  }

  if (state === 'hydration') {
    return [
      { moment: 'morning', label: 'Use a gentle cleanse', reason: 'Gentle cleansing helps avoid extra dryness.' },
      { moment: 'morning', label: 'Apply hydrating serum', reason: 'Today’s story points toward hydration support.' },
      { moment: 'morning', label: 'Seal with moisturizer', reason: 'Moisturizer helps hold water in the skin.' },
      { moment: 'day', label: 'Prioritize hydration', reason: 'Water intake supports the hydration side of the plan.' },
      { moment: 'day', label: 'Reapply SPF if outdoors', reason: 'Sun exposure can worsen dryness and dehydration signs.' },
      { moment: 'evening', label: 'Moisturize while skin is damp', reason: 'Applying moisturizer over damp skin can support water retention.' },
    ];
  }

  return [
    { moment: 'morning', label: 'Use your gentle cleanser', reason: 'Consistent cleansing supports oil balance.' },
    { moment: 'morning', label: 'Apply niacinamide if tolerated', reason: 'Today’s story points toward oil and breakout support.' },
    { moment: 'morning', label: 'Use lightweight moisturizer', reason: 'Hydration still matters without heavy layering.' },
    { moment: 'morning', label: 'Apply SPF', reason: 'SPF keeps the plan protective without adding treatment intensity.' },
    { moment: 'day', label: 'Avoid heavy occlusive layers', reason: 'Heavy layers can feel like too much on oilier days.' },
    { moment: 'evening', label: 'Use salicylic acid only if tolerated', reason: 'Keep breakout support targeted rather than aggressive.' },
  ];
}

function getSecondaryStateItems(state: SkinStoryState): PlanTemplateItem[] {
  if (state === 'barrier') {
    return [{ moment: 'evening', label: 'Skip retinoids tonight', reason: 'The secondary barrier signal suggests keeping actives gentle.' }];
  }
  if (state === 'inflammation') {
    return [{ moment: 'day', label: 'Keep irritation low', reason: 'The secondary inflammation signal suggests avoiding extra triggers.' }];
  }
  if (state === 'hydration') {
    return [{ moment: 'day', label: 'Add hydration support', reason: 'The secondary hydration signal suggests a little extra water balance support.' }];
  }
  return [{ moment: 'evening', label: 'Keep breakout treatment targeted', reason: 'The secondary breakout signal suggests avoiding broad, aggressive treatment.' }];
}

function buildPlanContext(skinStory: SkinStory) {
  const states = [skinStory.primaryState, skinStory.secondaryState]
    .filter((state): state is SkinStoryState => Boolean(state))
    .map((state) => stateLabels[state].toLowerCase());

  return `Today we’re prioritizing ${formatStateList(states)}.`;
}

function dedupePlanItems(items: PlanTemplateItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getMomentOrder(moment: PlanMoment) {
  if (moment === 'morning') return 0;
  if (moment === 'day') return 1;
  return 2;
}

function formatStateList(states: string[]) {
  if (states.length === 0) return 'skin support';
  if (states.length === 1) return states[0];
  return `${states.slice(0, -1).join(', ')} and ${states[states.length - 1]}`;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
