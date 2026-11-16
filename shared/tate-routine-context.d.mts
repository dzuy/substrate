export function routineContext(entry:unknown,recommendation:unknown):{summary:string;snapshot:string};
export function withRoutineContext(history:{role:string;content:string}[],snapshot?:string):{role:string;content:string}[];
