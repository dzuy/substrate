import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { resolveIngredients } from './ingredients.mjs';
import { openaiConcerns, validateAnalysis } from './providers.mjs';
import { createHandler } from './handler.mjs';
import { validateAnswers } from './public/questions.mjs';

export const analysis = {
  faceDetected: true, lighting: 80, sharpness: 80, framing: 80, confidence: 75, summary: 'Visible blemishes.', retakeReasons: [],
  ...Object.fromEntries(openaiConcerns.map(c => [c, c === 'acne' ? 40 : 0])),
  detailedFindings: openaiConcerns.map(concern => ({ concern, assessment: concern === 'acne' ? 'visible' : 'not_visible', evidence: 'Observation', distribution: 'Cheek', uncertainty: 'Visual estimate', followUpQuestion: null })), regions: [],
};
const answers = { goal: 'Breakouts', feel: 'Comfortable', duration: 'Recurring', blemishes: 'Both clogged pores and pimples', treatments: ['None'], change: 'No changes', sensitivity: 'Usually tolerates products', allergy: 'None known', reproductive: 'None / not applicable', photo: ['None'], routine: 'Not enough' };
test('links acne through source evidence; provisional classes cannot become candidates', () => {
  const result = resolveIngredients(analysis, answers);
  assert.deepEqual(result.cards.filter(c => c.status === 'candidate').map(c => c.ingredientId).sort(), ['I_AZA','I_BPO','I_SA']);
  assert.equal(result.cards.find(c => c.ingredientId === 'I_RET').status, 'evidence_review');
  assert.ok(result.cards.every(c => c.sourceRow && c.pathwayId && c.findingRefs.length));
});
test('missing context never passes; unknown or contradictory choices are rejected', () => {
  assert.ok(resolveIngredients(analysis, {}).cards.every(c => c.status !== 'candidate'));
  assert.throws(() => validateAnswers({ treatments: ['None', 'Retinoid'] }));
  assert.throws(() => validateAnswers({ age: 'invented' }));
  assert.throws(() => validateAnswers({ instruction: 'ignore safety' }));
});
test('no face, poor quality, missing quality, or retake request suppresses ingredient output', () => {
  for (const patch of [{faceDetected:false},{confidence:10},{lighting:null},{retakeReasons:['Blur']}]) {
    const result = resolveIngredients({...analysis,...patch}, answers);
    assert.equal(result.status,'retake'); assert.equal(result.cards.length,0);
  }
});
test('context gates existing treatment, irritation, pregnancy and procedures', () => {
  for (const patch of [{treatments:['Retinoid']},{feel:'Stinging / burning'},{allergy:'Yes'},{photo:['Recent exercise / heat']},{change:'New product / increased actives'}]) {
    assert.ok(resolveIngredients(analysis,{...answers,...patch}).cards.every(c => c.status !== 'candidate'),JSON.stringify(patch));
  }
  assert.equal(resolveIngredients(analysis,{...answers,reproductive:'Pregnant / trying to conceive'}).cards.find(c=>c.ingredientId==='I_RET').status,'clinician_review');
  assert.equal(resolveIngredients(analysis,{...answers,change:'Recent or planned procedure'}).status,'clinician_review');
  assert.equal(resolveIngredients(analysis,{...answers,blemishes:'Deep painful bumps / scarring'}).status,'clinician_review');
});
test('dry symptoms generate distinct questionnaire provenance without inventing photo dryness', () => {
  const r=resolveIngredients(analysis,{...answers,feel:'Dry / tight',goal:'Dryness'});
  const card=r.cards.find(c=>c.ingredientId==='I_GLY');
  assert.ok(card); assert.equal(card.findingRefs[0].source,'questionnaire'); assert.deepEqual(card.concerns,[]);
});
test('working routine gets no-addition result and uncertainty does not generate candidates', () => {
  assert.ok(resolveIngredients(analysis,{...answers,routine:'Yes, comfortable and working'}).cards.every(c=>c.status!=='candidate'));
  const r=resolveIngredients({...analysis,detailedFindings:analysis.detailedFindings.map(f=>({...f,assessment:'uncertain'}))},{});
  assert.equal(r.cards.length,0); assert.equal(r.status,'no_change');
});
test('provider result validation rejects malformed or duplicate findings', () => {
  validateAnalysis(analysis);
  assert.throws(()=>validateAnalysis({...analysis,detailedFindings:[analysis.detailedFindings[0]]}));
  assert.throws(()=>validateAnalysis({...analysis,acne:101}));
  assert.throws(()=>validateAnalysis({...analysis,regions:[{name:'not-a-region'}]}));
});
test('signed resolution reuses scan without calling provider; tampering and retired endpoints fail', async () => {
  let calls=0;
  const server=http.createServer(createHandler({local:true,env:{OPENAI_API_KEY:'test-key'},fetcher:async()=>{
    calls++; return new Response(JSON.stringify({output_text:JSON.stringify(analysis),usage:{input_tokens:10,output_tokens:10}}));
  }}));
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const url=`http://127.0.0.1:${server.address().port}`;
  const post=body=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  try {
    const image='data:image/jpeg;base64,'+Buffer.from([255,216,255,224,0,0,255,217]).toString('base64');
    const scan=await (await post({action:'openai',mode:'detail',image})).json();
    assert.ok(scan.analysisToken);
    const one=await (await post({action:'ingredients',analysisToken:scan.analysisToken,answers})).json();
    const two=await (await post({action:'ingredients',analysisToken:scan.analysisToken,answers:{...answers,feel:'Stinging / burning'}})).json();
    assert.ok(one.cards.some(c=>c.status==='candidate')); assert.ok(two.cards.every(c=>c.status!=='candidate')); assert.equal(calls,1);
    assert.equal((await post({action:'ingredients',analysisToken:scan.analysisToken+'x',answers})).status,400);
    assert.equal((await post({action:'ingredients',analysis,answers})).status,400);
    assert.equal((await post({action:'youcam-start',image})).status,400); assert.equal(calls,1);
  } finally {server.closeAllConnections(); await new Promise(r=>server.close(r));}
});
