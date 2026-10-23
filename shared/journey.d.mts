import type { SkinReport } from '../src/report/types';
import type { ProfileContext, CheckInResponses, DailyPlan } from '../src/types/database';
import type { UserWardrobeItem } from '../src/services/catalog';
export const stages: string[];
export function localDate(date?: Date): string;
export function stableInput(value: unknown): string;
export function nextStage(stage: string): string;
export function summaryCards(report: SkinReport | null, profile?: ProfileContext, wardrobe?: UserWardrobeItem[]): {title:string;body:string;source:string}[];
export function ownedRoutine(wardrobe: UserWardrobeItem[], checkIn?: CheckInResponses): NonNullable<DailyPlan['items']>;
