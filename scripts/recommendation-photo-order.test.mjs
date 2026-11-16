import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
async function run(concurrent=false){
 const calls=[];let revision=0,reads=0;
 const query={select:()=>query,eq:()=>query,order:()=>query,limit:()=>query,single:async()=>({data:{entry_date:'2026-11-16',check_in:{}}}),maybeSingle:async()=>({data:{id:'photo',quality_checks:{}}}),update:()=>{calls.push('saved');return {eq:async()=>({})};}};
 const modules={
 '../../shared/routine-sections.mjs':{organizeRoutineSections:(note,events,items)=>({items:[...items,{id:'event-care-pickleball',label:'Gently cleanse after sweating',moment:'day',completed:false}],sections:[]})},
 '@/lib/supabase':{supabase:{from:()=>query}},
 '@/services/photos':{toPhotoAnalysis:x=>x,analyzeDailyPhoto:async()=>{calls.push('analysis');revision++;return {data:{analyzedAt:'now'}};}},
 '@/services/environment':{getEnvironmentSnapshot:async()=>({data:{}}),toEnvironmentSnapshot:x=>x},
 '@/services/profile':{getProfile:async()=>({data:{}}),toProfileContext:x=>x},
 '@/services/catalog-pagination':{collectCatalogRows:async()=>({data:[]})},
 '../../shared/catalog-matching.mjs':{matchDailyProducts:()=>[]},
 '../../shared/activity-routine.mjs':{activityRoutineItems:()=>[]},
 '../../shared/journey.mjs':{ownedRoutine:()=>[]},
 };
 const source=readFileSync('src/services/recommendations.ts','utf8')
 .replace('const existing = await getLatestRecommendation(', 'const existing = await __latest(')
 .replaceAll('await readPlanInputs(userId,dailyEntryId)', 'await __inputs()')
 .replace('await getPriorSkinHealthScore(userId, entry.data.entry_date)', 'undefined')
 .replace('const generated = buildRecommendation(', 'const generated = __build(')
 .replace('const personalized = personalizeFallbackRecommendation(', 'const personalized = __personalize(');
 const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Error,require:n=>modules[n]||{},__latest:async()=>({data:{skinStory:{},dailyPlan:{items:[{id:'event-care-pickleball',label:'Gently cleanse after sweating',completed:true}]},recommendationId:'r'}}),__inputs:async()=>{calls.push('snapshot');reads++;return {data:{fingerprint:String(revision+(concurrent&&reads>1?1:0)),wardrobe:[],entry:{entry_date:'2026-11-16',check_in:{}}}};},__build:()=>({skinStory:{ingredientsToFavor:[],ingredientsToAvoid:[]},dailyPlan:{items:[]},analysis:{},safetyNotes:[]}),__personalize:x=>x});
 const result=await exports.getOrCreateTodayRecommendation('user','entry');return {calls,result};
}
test('new photo analysis happens before input snapshot and routine save succeeds',async()=>{const h=await run();assert.equal(h.result.error,null);assert.deepEqual(h.calls,['analysis','snapshot','snapshot','saved']);assert.equal(h.result.data.dailyPlan.inputFingerprint,'1');assert.equal(h.result.data.dailyPlan.items.find(i=>i.id==='event-care-pickleball').completed,true);});
test('genuine concurrent input changes still prevent stale routine save',async()=>{const h=await run(true);assert.match(h.result.error.message,/inputs changed/);assert.ok(!h.calls.includes('saved'));});
