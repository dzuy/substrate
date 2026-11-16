import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groundRoutineEvents,organizeRoutineSections} from './routine-sections.mjs';
const items=[
 {id:'am-owned',moment:'morning',label:'Saved moisturizer',reason:'Your saved product',completed:true},
 {id:'spf',moment:'day',label:'Reapply SPF if outdoors',completed:false},
 {id:'night-owned',moment:'evening',label:'Saved nighttime moisturizer',completed:false},
];
test('breakfast pickleball dinner yields real sections, preserved products and safe timing',()=>{
 const result=organizeRoutineSections('Breakfast, then afternoon pickleball, then steak dinner',['Breakfast','Afternoon pickleball','Steak dinner'],items);
 assert.ok(result.sections.some(s=>s.title==='Post-breakfast'));
 assert.ok(result.sections.some(s=>s.title==='After Pickleball'));
 assert.ok(result.sections.some(s=>s.title==='Before Dinner'));
 assert.deepEqual(result.sections.find(s=>s.id==='start').itemIds,['am-owned']);
 assert.deepEqual(result.sections.find(s=>s.id==='night').itemIds,['night-owned']);
 assert.ok(result.sections.find(s=>s.id==='before-pickleball').itemIds.includes('spf'));
 assert.ok(result.items.some(i=>i.id==='event-care-pickleball'&&/sweating/.test(i.label)));
 assert.equal(result.items.find(i=>i.id==='am-owned').completed,true);
 const assigned=result.sections.flatMap(s=>s.itemIds);assert.equal(new Set(assigned).size,result.items.length);
 assert.doesNotMatch(JSON.stringify(result),/steak.*(?:causes|inflammation|acne)/i);
});
test('no fabricated events from model, negated/past events rejected',()=>{
 assert.deepEqual(groundRoutineEvents('No pickleball today. Yesterday dinner.',['Swimming','Gym']),[]);
 assert.deepEqual(organizeRoutineSections('',[],items),{items,sections:[]});
 assert.equal(groundRoutineEvents('Walk the dog',['Walk the dog','Get a facial']).length,1);
});
test('fallback extracts only explicitly named known events',()=>{assert.deepEqual(groundRoutineEvents('Breakfast then pickleball then dinner').map(e=>e.id),['breakfast','pickleball','dinner']);});

test('uncertain or hypothetical events do not become plans',()=>{assert.deepEqual(groundRoutineEvents('What if I play pickleball? Maybe dinner later.'),[]);});

test('jogging has an activity section rather than awkward first-person Around label',()=>{const result=organizeRoutineSections("i'm jogging in the morning",["i'm jogging in the morning"],items);assert.ok(result.sections.some(s=>s.title==='After your run'));assert.ok(!result.sections.some(s=>/Around i['’]m/i.test(s.title)));});

test('meal used only as timing reference does not become its own section',()=>{assert.deepEqual(groundRoutineEvents('Gym after lunch',['Gym after lunch']).map(e=>e.id),['gym']);});
