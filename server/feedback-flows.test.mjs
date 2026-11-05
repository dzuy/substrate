import test from 'node:test';
import assert from 'node:assert/strict';
import {activityRoutineItems} from '../shared/activity-routine.mjs';
import {visibleReportQuestions,validateReportAnswers,engineAnswers} from '../shared/report-questions.mjs';
import {cleanDailyDraft} from '../shared/daily-draft.mjs';
import {profileReportAnswers} from '../shared/profile-report-answers.mjs';
import {createSupplementLabelHandler} from './supplement-label.mjs';
test('routine follows reviewed activity timing without inventing exercise',()=>{
 assert.deepEqual(activityRoutineItems({dailyActivities:['Work at 9 AM','Dinner at 7 PM']}),[]);
 const items=activityRoutineItems({dailyActivities:['Gym at 4 PM','Swimming at 6 PM','No running']});
 assert.equal(items.length,2);assert.match(items[0].reason,/Gym at 4 PM/);assert.match(items[1].label,/swimming/);
});
test('questionnaire removes reproductive prompt and adapts allergy and cycle fields',()=>{
 assert.ok(!visibleReportQuestions({}).some(q=>q.id==='reproductive'));
 assert.ok(!visibleReportQuestions({allergy:'Unsure'}).some(q=>q.id==='allergyNotes'));
 assert.ok(visibleReportQuestions({allergy:'Yes'}).some(q=>q.id==='allergyNotes'));
 assert.ok(!visibleReportQuestions({cycleTracking:'Not applicable'}).some(q=>q.id==='cycleDay'));
 const answers=Object.fromEntries(visibleReportQuestions({}).filter(q=>!q.optional).map(q=>[q.id,q.multi?[q.options[0]]:q.options[0]]));
 const valid=validateReportAnswers({...answers,oil:"Usually balanced",treatments:["None"],cycleTracking:'Tracking',cycleDay:'37'});
 assert.equal(valid.cycleDay,'37');assert.equal(engineAnswers(valid).reproductive,undefined);assert.equal(engineAnswers({...valid,reproductive:'None / not applicable'}).reproductive,undefined);
 assert.throws(()=>validateReportAnswers({...answers,oil:"Usually balanced",treatments:["None"],cycleTracking:'Tracking',cycleDay:'0'}),/cycle day/);
});
test('cycle day survives draft round trip without inferred phase',()=>{
 assert.deepEqual(cleanDailyDraft({cycleDay:37}),{cycleDay:37});assert.throws(()=>cleanDailyDraft({cycleDay:0}),/Cycle day/);
 assert.equal(profileReportAnswers({ingredientAllergy:'Prefer not to say'}).allergy,'Unsure');
});
const env={EXPO_PUBLIC_SUPABASE_URL:'https://auth.example',EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'test',OPENAI_API_KEY:'test'};
async function label({body={image:'data:image/jpeg;base64,YQ=='},headers={authorization:'Bearer token',host:'app.example'},fetcher=()=>{throw Error('unexpected network');}}={}) {
 let status,data;await createSupplementLabelHandler({env,fetcher})({method:'POST',headers,body},{writeHead(s){status=s;},end(s){data=JSON.parse(s);}});return {status,data};
}
test('label endpoint rejects unauthenticated/cross-origin and invalid images',async()=>{
 assert.equal((await label({headers:{}})).status,401);
 assert.equal((await label({headers:{authorization:'Bearer token',host:'app.example',origin:'https://evil.example'}})).status,403);
 assert.equal((await label({body:{image:'https://private.example'},fetcher:async()=>new Response('{"id":"user"}')})).status,400);
});
test('label extraction is a non-stored draft, not a database write',async()=>{
 const calls=[];const result=await label({fetcher:async(url,opts)=>{calls.push({url,opts});return new Response(JSON.stringify(url.includes('/auth/')?{id:'user'}:{output:[{content:[{type:'output_text',text:'Brand\n[unreadable]'}]}]}));}});
 assert.equal(result.status,200);assert.equal(result.data.text,'Brand\n[unreadable]');assert.equal(calls.length,2);
 assert.equal(JSON.parse(calls[1].opts.body).store,false);assert.match(JSON.parse(calls[1].opts.body).instructions,/Never identify/);
});
test('label provider failure leaves manual recovery available',async()=>{
 const result=await label({fetcher:async url=>new Response(url.includes('/auth/')?'{"id":"user"}':'failure',{status:url.includes('/auth/')?200:503})});assert.equal(result.status,503);
});
