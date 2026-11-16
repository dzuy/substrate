import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {activityRoutineItems} from '../shared/activity-routine.mjs';
function setup({conflict=false,failure=false,checkIn={sleepHours:7,hrvMs:55,cycleDay:12,dailyActivities:['Work']}}={}){
 const calls=[];let saved;const exports={};
 const modules={
 '@/services/routine-events':{extractRoutineEvents:async()=>({activities:['Gym at 4 PM'],source:'model'})},
 '@react-native-async-storage/async-storage':{default:{getItem:async()=>null,setItem:async(k,v)=>calls.push(['draft',JSON.parse(v).note]),removeItem:async()=>calls.push(['clear'])}},
 '@/services/daily-entries':{getOrCreateDailyEntry:async()=>({data:{id:'entry',updated_at:'revision',check_in:checkIn}})},
 '@/lib/supabase':{supabase:{from:()=>({update:patch=>{saved=patch.check_in;const query={eq:(key,value)=>{calls.push(['eq',key,value]);return query;},select:()=>query,single:async()=>conflict?{error:'conflict'}:{data:{id:'entry'}}};return query;}})}},
 '@/services/recommendations':{getOrCreateTodayRecommendation:async()=>{calls.push(['generate',saved||checkIn]);return failure?{error:'offline'}:{data:{dailyPlan:{items:activityRoutineItems(saved||checkIn)}}};}},
 '../../shared/journey.mjs':{localDate:()=> '2026-11-16'},
 };
 vm.runInNewContext(ts.transpileModule(readFileSync('src/services/create-day-routine.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Error,require:n=>modules[n]});
 return {calls,run:note=>exports.createDayRoutine('user',note)};
}
test('raw text saved before generation, fresh metrics preserved, real activity rule changes result',async()=>{
 const h=setup();const result=await h.run('Gym at 4 PM');const context=h.calls.find(c=>c[0]==='generate')[1];
 assert.equal(context.routineNote,'Gym at 4 PM');assert.equal(context.sleepHours,7);assert.equal(context.hrvMs,55);assert.equal(context.cycleDay,12);assert.deepEqual(context.dailyActivities,['Work']);
 assert.ok(h.calls.some(c=>c[0]==='eq'&&c[1]==='updated_at'&&c[2]==='revision'));
 assert.match(result.dailyPlan.items[0].label,/sweating/);assert.match(result.dailyPlan.items[0].reason,/Gym at 4 PM/);assert.deepEqual(h.calls.at(-1),['clear']);
});
test('save conflict never generates or clears draft',async()=>{const h=setup({conflict:true});await assert.rejects(h.run('Gym'));assert.ok(!h.calls.some(c=>['generate','clear'].includes(c[0])));});
test('generation failure keeps saved draft; retry with identical note refreshes extracted events',async()=>{const h=setup({failure:true});await assert.rejects(h.run('Gym'));assert.ok(!h.calls.some(c=>c[0]==='clear'));const retry=setup({checkIn:{routineNote:'Gym'}});await retry.run('Gym');assert.ok(retry.calls.some(c=>c[0]==='eq')); });
test('blank input generates from current context without wiping prior note',async()=>{const h=setup({checkIn:{routineNote:'Swimming'}});const result=await h.run('');assert.match(result.dailyPlan.items[0].label,/swimming/);assert.ok(!h.calls.some(c=>c[0]==='eq'));});
test('unsupported and negated note activities do not invent steps',()=>{assert.deepEqual(activityRoutineItems({routineNote:'Dinner with friends'}),[]);assert.deepEqual(activityRoutineItems({routineNote:'No gym today'}),[]);});
