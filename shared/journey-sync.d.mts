import type {Journey} from '../src/services/journey';
export type JourneyConflict={revision:number;stage:string;updatedAt:string};
export type JourneyResult={state:Journey;cloud:boolean;available:boolean;conflict:JourneyConflict|null};
export function createJourneyStore(options:{storage:{getItem(key:string):Promise<string|null>;setItem(key:string,value:string):Promise<unknown>};remote:{read(id:string):Promise<{data:{revision:number;payload:Journey}|null;error:unknown}>;write(id:string,revision:number,payload:Journey):Promise<{error:unknown}>};now?:()=>string}):{load(id:string):Promise<JourneyResult>;save(id:string,state:Journey):Promise<JourneyResult>;resolve(id:string,state:Journey,choice:'device'|'account',revision:number):Promise<JourneyResult>};
