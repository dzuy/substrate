// Event names must be grounded in the user's exact note; model output is untrusted.
const known = [
 ['breakfast', /\bbreakfast\b/i, 'Post-breakfast', 'meal'],
 ['pickleball', /\bpickleball\b/i, 'After Pickleball', 'sport'],
 ['jogging', /\b(jog|jogging|run|running)\b/i, 'After your run', 'sport'],
 ['gym', /\b(gym|workout)\b/i, 'After your workout', 'sport'],
 ['swimming', /\b(swim|swimming|pool)\b/i, 'After swimming', 'swim'],
 ['lunch', /\blunch\b/i, 'Around lunch', 'meal'],
 ['dinner', /\bdinner\b/i, 'Before Dinner', 'meal'],
];
export function groundRoutineEvents(note, proposed = []) {
 const text = String(note || '');
 const clauses = text.split(/[.!;\n]|\b(?:then|but)\b/i).filter(c=>!/[?]|\b(maybe|might|possibly|if|could|should)\b/i.test(c));
 const events = [];
 for (const [id, pattern, title, kind] of known) {
  const clause = clauses.find(c => pattern.test(c) && !/\b(no|not|skip|cancelled|canceled|yesterday|already|finished)\b|won['’]t/i.test(c));
  if (!clause) continue;
  const match = text.match(pattern);
  if(kind==='meal' && /\b(after|before|around|during)\s+(?:a |the )?$/i.test(text.slice(0,match.index)))continue;
  events.push({id,title,kind,source:match[0],index:match.index});
 }
 // Model-extracted other events are used only if their complete wording appears
 // verbatim in a non-negated clause. Paraphrases cannot fabricate an event.
 for (const candidate of proposed) {
  if (typeof candidate !== 'string' || candidate.length < 3 || candidate.length > 70) continue;
  const lower = candidate.toLowerCase();
  const index = text.toLowerCase().indexOf(lower);
  if(index < 0 || known.some(([,p])=>p.test(candidate)) || /\b(no|not|yesterday|skip|cancelled|canceled)\b/i.test(candidate)) continue;
  if(!clauses.some(c=>c.toLowerCase().includes(lower)&&!/\b(no|not|skip|yesterday|cancelled|canceled)\b/i.test(c)))continue;
  events.push({id:`event-${index}`,title:`Around ${candidate.replace(/^(?:i['’]m|i am|i will|i'm going to|going to|planning to)\s+/i,'').replace(/^./,c=>c.toUpperCase())}`,kind:'other',source:text.slice(index,index+candidate.length),index});
 }
 return events.sort((a,b)=>a.index-b.index).slice(0,8);
}
export function organizeRoutineSections(note, proposed, original) {
 const events=groundRoutineEvents(note,proposed);
 if(!events.length)return {items:original,sections:[]};
 const items=[...original];const assigned=new Set();const sections=[];
 const add=(id,title,selected)=>{if(!selected.length)return;selected.forEach(i=>assigned.add(i.id));sections.push({id,title,itemIds:selected.map(i=>i.id)});};
 const morning=items.filter(i=>i.moment==='morning');
 const breakfast=events.find(e=>e.id==='breakfast');
 add('start',breakfast?'Post-breakfast':'Start of your day',morning);
 for(const event of events.filter(e=>e.id!=='breakfast')) {
  const sport=event.kind==='sport'||event.kind==='swim';
  if(sport){
   add(`before-${event.id}`,`Before ${event.source}`,items.filter(i=>!assigned.has(i.id)&&i.moment==='day'&&/SPF|sun protection/i.test(i.label)));
   const id=`event-care-${event.id}`;
   const care={id,moment:'day',label:event.kind==='swim'?'Rinse after swimming; moisturize if needed':'Gently cleanse after sweating',reason:`For your stated ${event.source} plans. Avoid extra scrubbing or repeating a cleanse if your skin is already clean.`,completed:original.find(i=>i.id===id)?.completed||false};
   const existingCare = items.filter(i=>!assigned.has(i.id)&&i.id.startsWith('activity-')&&(event.kind==='swim'?/swim/i:/sweat/i).test(i.label));
   if(!existingCare.length && !items.some(i=>i.id===id))items.push(care);
   add(event.id,event.title,existingCare.length ? existingCare : items.filter(i=>i.id===id));
  }else{
   const id=`event-care-${event.id}`;
   const care={id,moment:'day',label:'No extra treatment needed',reason:`Your ${event.source} plans do not require an additional skincare treatment. Keep your usual product timing; nighttime steps remain below.`,completed:original.find(i=>i.id===id)?.completed||false};
   if(!items.some(i=>i.id===id))items.push(care);
   add(event.id,event.title,items.filter(i=>i.id===id));
  }
 }
 add('day','As needed today',items.filter(i=>!assigned.has(i.id)&&i.moment!=='evening'));
 add('night','Before bed',items.filter(i=>!assigned.has(i.id)));
 return {items,sections};
}
