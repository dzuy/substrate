import type {CheckInResponses} from '../src/types/database';
export function isDayChangeRequest(text:string):boolean;
export function currentDayActivities(checkIn?:CheckInResponses):string[];
export function cancellationActivities(request:string,current:string[]):string[]|null;
export function validateActivityChange(request:string,current:string[],proposed:string[]):string[];

export function resolveDayChangeRequest(text:string,messages?:{role:string;content:string}[]):string;
export function directActivityChange(request:string,current:string[]):string[]|null;
