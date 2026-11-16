import type {DailyPlan} from '../src/types/database';
export function groundRoutineEvents(note:string,proposed?:string[]): {id:string;title:string;kind:string;source:string;index:number}[];
export function organizeRoutineSections(note:string,proposed:string[],items:NonNullable<DailyPlan['items']>): {items:NonNullable<DailyPlan['items']>;sections:NonNullable<DailyPlan['sections']>};
