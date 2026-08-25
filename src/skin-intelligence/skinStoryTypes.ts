import type { CheckInResponses, EnvironmentSnapshot, PhotoAnalysis } from '@/types/database';

export type SkinStoryState = 'barrier' | 'inflammation' | 'hydration' | 'breakout';
export type SkinFrameworkDimension = 'barrier' | 'inflammation' | 'hydration' | 'collagen' | 'pigmentation';

export type SkinStoryInputs = {
  checkIn: CheckInResponses;
  environment?: EnvironmentSnapshot;
  hasPhoto: boolean;
  photoAnalysis?: PhotoAnalysis;
};

export type SkinStoryScores = Record<SkinStoryState, number>;

export type SkinStory = {
  primaryState: SkinStoryState;
  secondaryState?: SkinStoryState;
  headline: string;
  summary: string;
  reasons: string[];
  frameworkRead: {
    dimension: SkinFrameworkDimension;
    status: string;
    detail: string;
  }[];
  priorities: string[];
  ingredientsToFavor: string[];
  ingredientsToAvoid: string[];
  contributors?: { label: string; detail: string }[];
  priority?: string;
};
