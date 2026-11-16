export function isDayChangeRequest(text) {
 if(/\b(what if|maybe|might|should i|hypothetical|why|do not|not cancel|yesterday|already|finished)\b|don['’]t/i.test(text))return false;
 if(/\b(medication|prescription|retinol|retinoid|tretinoin|acid|peel|laser|procedure|treatment|dose|dosage|serum|cleanser|moisturizer|sunscreen|spf)\b/i.test(text))return false;
 return /\b(i['’]m|i am)\s+\w+ing\b/i.test(text) || /\b(going to|headed to|planning to|plan to|playing|having|update|replace)\b/i.test(text) || /\b(cancel(?:l?ing|l?ed)?|remove|skip(?:ping)?|add|move|reschedule|change|instead|not going|not playing|no longer)\b|won['’]t/i.test(text);
}
export function currentDayActivities(checkIn={}){
 const saved=checkIn.routineEvents?.length?checkIn.routineEvents:checkIn.dailyActivities?.length?checkIn.dailyActivities:[];
 return saved.length?saved:[checkIn.routineNote||checkIn.movementPlanNote||''].flatMap(s=>s.split(/[,;\n]|\bthen\b/i)).map(s=>s.trim()).filter(Boolean);
}
function assertTodayChange(request){
 if(/\b(tomorrow|yesterday|next\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i.test(request))throw Error('This editor updates today only. Please describe today’s change; nothing was changed.');
}
export function cancellationActivities(request,current){
 assertTodayChange(request);
 if(!/\b(cancel(?:l?ing|l?ed)?|remove|skip(?:ping)?|not going|not playing|no longer)\b|won['’]t/i.test(request))return null;
 if(/\b(add|replace|move|reschedule|then|instead)\b|\band\s+(?:i['’]m|i am|go|going|play|playing|have|having)\b/i.test(request))throw Error('Please make one activity change at a time so I can apply the whole request accurately. Nothing was changed.');
 const words=request.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w.length>2&&!['cancel','canceling','cancelling','canceled','cancelled','remove','skip','skipping','not','going','playing','longer','today','please','can','could','you','the','from','plan','routine','with','and','just','want','won'].includes(w));
 const ranked=current.map(activity=>({activity,score:words.filter(word=>new RegExp(`\\b${word}\\b`,'i').test(activity)).length}));
 const best=Math.max(0,...ranked.map(r=>r.score));
 const matches=ranked.filter(r=>best>0&&r.score===best).map(r=>r.activity);
 if(matches.length>1&&!/\band\b/i.test(request))throw Error('More than one activity matches. Tell me the exact activity; nothing was changed.');
 if(!matches.length)throw Error('I could not identify that activity in your saved day. Tell me its name; nothing was changed.');
 return current.filter(activity=>!matches.includes(activity));
}
export function replacementScope(text){
 if(/\b(?:replace|clear|drop)\s+(?:(?:all|the|my|these|those|other|current|existing|rest of|of)\s+)*(?:plans|activities|schedule|day)\b/i.test(text))return {all:true,target:null};
 const target=text.match(/\breplace\s+(.+?)\s+with\b/i)?.[1]?.trim();
 return {all:false,target:target||null};
}
function activityDescription(text){
 return text.replace(/\b(?:replace|clear|drop)\s+(?:(?:all|the|my|these|those|other|current|existing|rest of|of)\s+)*(?:plans|activities|schedule|day)(?:\s+with)?/ig,'')
 .replace(/(?:[.!;]|\band\b)?\s*(?:please\s+)?(?:update|apply|rebuild|regenerate)\s+(?:(?:the|my|this|that|new)\s+)*(?:routine|plan|plans|day)(?:\s+(?:now|please))?/ig,'')
 .replace(/^[\s.!;,]+|[\s.!;,]+$/g,'').trim();
}
const canonical=text=>text.toLowerCase().replace(/\b(i|i'm|am|going|to|the|have|having|a|an)\b|[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
export function validateActivityChange(request,current,proposed){
 if(!isDayChangeRequest(request))throw Error('This is not an explicit day-plan change.');
 const cancelled=cancellationActivities(request,current);if(cancelled)return cancelled;
 if(!proposed.length)throw Error('I could not identify the replacement activities. Nothing was changed.');
 if(proposed.some(a=>/\b(medication|prescription|retinol|retinoid|tretinoin|peel|laser|procedure|treatment|dose|dosage)\b/i.test(a)))throw Error('I can adjust activities, not add medical treatments. Nothing was changed.');
 const scope=replacementScope(request);
 const missing=current.filter(activity=>!proposed.some(p=>canonical(p)===canonical(activity)));
 if(!scope.all && missing.some(activity=>!scope.target || !canonical(activity).includes(canonical(scope.target))))throw Error('That interpretation would replace other plans. Please clarify the exact change; nothing was changed.');
 return proposed;
}
export function resolveDayChangeRequest(text,messages=[]){
 if(!isDayChangeRequest(text))return text;
 const description=activityDescription(text).replace(/\b(and|please)\b/ig,'').trim();
 if(!description || /^(?:do it|yes|okay|ok)$/i.test(description)){
  const prior=[...messages].reverse().find(m=>m.role==='user'&&isDayChangeRequest(m.content)&&activityDescription(m.content)&&/\b(going|headed|planning|playing|having|add|move|reschedule|jogging)\b/i.test(m.content));
  if(prior)return replacementScope(text).all?`${prior.content}. ${text}`:prior.content;
  throw Error('What activity or time should I update? Your routine is unchanged.');
 }
 return text;
}
const activityKinds=[['Gym',/\b(gym|workout)\b/i],['Pickleball',/\bpickleball\b/i],['Swimming',/\b(swim|swimming)\b/i],['Jogging',/\b(jog|jogging)\b/i],['Run',/\b(run|running)\b/i],['Dinner',/\bdinner\b/i],['Lunch',/\blunch\b/i],['Breakfast',/\bbreakfast\b/i],['Walk',/\bwalk\b/i]];
export function directActivityChange(request,current){
 const cancellation=cancellationActivities(request,current);
 if(cancellation)return cancellation;
 const description=activityDescription(request);
 const scope=replacementScope(request);
 const matches=activityKinds.filter(([name,pattern])=>{const match=description.match(pattern);if(!match)return false;return !(['Lunch','Breakfast','Dinner'].includes(name)&&/\b(after|before|around|at|during)\s+(?:a |the )?$/i.test(description.slice(0,match.index)));});
 if(matches.length!==1)return null;
 const [name,pattern]=matches[0];
 const match=description.match(pattern);
 if(/\b(at|around|after|before|during|in the|this morning|this afternoon|this evening)\b/i.test(description.slice(0,match.index)))return null;
 const tail=description.slice(match.index+match[0].length).replace(/[.!?]+$/,'').trim();
 if(/\b(and|then|instead of)\b/i.test(tail))return null;
 // Retain the user's actual timing, never infer a clock time for lunchtime.
 const timing=tail.match(/^(?:(?:at|around|after|before|during|in|this|to)\s+).{1,80}$/i)?.[0] || '';
 const label=name+(timing?' '+timing.replace(/^to\s+/i,'at '):'');
 if(scope.all)return [label];
 if(scope.target)return null;
 const existing=current.map((value,index)=>({value,index})).filter(({value})=>pattern.test(value));
 if(existing.length>1)throw Error(`You have more than one ${name.toLowerCase()} plan. Which one should change? Nothing was changed.`);
 if(existing.length){
  if(!timing)return current;
  return current.map((value,index)=>index===existing[0].index?label:value);
 }
 const before = /\b(lunchtime|lunch|noon|afternoon)\b/i.test(timing) ? current.findIndex(activity=>/\b(dinner|evening|bed)\b/i.test(activity)) : -1;
 return before<0?[...current,label]:[...current.slice(0,before),label,...current.slice(before)];
}
