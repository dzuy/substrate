import type { SkinStory } from '@/skin-intelligence/skinStoryTypes';

export type PlanMoment = 'morning' | 'day' | 'evening';

export type PlanItem = {
  id: string;
  moment: PlanMoment;
  label: string;
  reason?: string;
  completed: boolean;
};

export type TodayPlan = {
  id: string;
  date: string;
  skinStoryId?: string;
  context: string;
  items: PlanItem[];
};

export type TodayPlanInput = {
  date: string;
  id: string;
  skinStory: SkinStory;
  skinStoryId?: string;
};
