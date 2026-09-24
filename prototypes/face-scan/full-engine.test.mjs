import test from 'node:test';
import assert from 'node:assert/strict';
import data from './knowledge/active.json' with {type:'json'};
import {evaluate,coverage} from '../../packages/ingredient-engine/dist/engine.js';
import {recordOutcome,admitEvidence,generateClaim,evaluateClinicalRule,createExpression,productPerformance,chooseMinimumChange} from '../../packages/ingredient-engine/dist/integrity.js';
import {defaultTestAnswers,scenarioAnswers,validateAnswers} from './public/questions.mjs';
const blank={faceDetected:true,lighting:90,sharpness:90,framing:90,confidence:90,retakeReasons:[],regions:[],detailedFindings:[]};
const input=(answers)=>({analysis:blank,answers,now:'2026-09-23T00:00:00Z',assumedContext:{ageBand:'40–50',source:'prototype setting'}});
const allIds=data.tables.conditions.map(r=>r.Condition_ID);
for(const condition of data.tables.conditions)test(`coverage ${condition.Condition_ID}: produces a traceable outcome`,()=>{
 const answers=scenarioAnswers(condition.Condition_ID);
 validateAnswers(answers,allIds);
 const result=evaluate(input(answers),data);
 assert.ok(result.states.some(s=>s.conditionId===condition.Condition_ID));
 assert.ok(result.cards.some(c=>c.conditionIds.includes(condition.Condition_ID))||result.notes.some(n=>n.startsWith(condition['Condition / Goal'])));
 assert.equal(new Set(result.cards.map(c=>c.ingredientId)).size,result.cards.length);
 for(const card of result.cards){assert.ok(card.trace.length); assert.ok(card.trace.every(t=>t.sourceRows.length===2));}
});
test('all fourteen ingredient nodes are reachable and raw workbook is unchanged',()=>{
 const before=JSON.stringify(data);const reached=new Set();
 for(const id of allIds)for(const card of evaluate(input(scenarioAnswers(id)),data).cards)reached.add(card.ingredientId);
 assert.deepEqual([...reached].sort(),data.tables.ingredients.map(r=>r.Ingredient_ID).sort());assert.equal(JSON.stringify(data),before);
 const c=coverage(data);assert.equal(c.conditions.length,16);assert.equal(c.pathways.length,11);assert.ok(c.governors.every(g=>g.implemented));
});
test('source evidence does not transfer acne claims into redness or photoaging',()=>{
 for(const id of ['C_ROSACEA','C_WRINKLE','C_PIH'])assert.ok(evaluate(input(scenarioAnswers(id)),data).cards.every(c=>c.status!=='candidate'));
});
test('a workbook replacement changes edges without engine edits; new nodes remain traceable',()=>{
 const next=structuredClone(data);next.version='replacement';
 next.tables.conditions.push({Condition_ID:'C_NEW','Condition / Goal':'New reported goal',_source:{sheet:'01_CONDITIONS',row:21}});
 next.tables.conditionPathways.push({Condition_ID:'C_NEW',Pathway_ID:'P_HYDR',Base_Relevance_0_3:2,_source:{sheet:'04_CONDITION_PATHWAY',row:21}});
 const r=evaluate(input({...defaultTestAnswers(),goal:'Dryness',conditions:['C_NEW']}),next);
 assert.equal(r.knowledgeVersion,'replacement');assert.ok(r.cards.some(c=>c.conditionIds.includes('C_NEW')&&c.ingredientId==='I_GLY'));
 assert.ok(r.cards.filter(c=>c.conditionIds.includes('C_NEW')).every(c=>c.status!=='candidate'));
});
test('combined concerns preserve every source and do not double count evidence',()=>{
 const a=evaluate(input(scenarioAnswers('C_WRINKLE')),data);
 const b=evaluate(input({...scenarioAnswers('C_WRINKLE'),conditions:['C_WRINKLE','C_LAXITY']}),data);
 assert.equal(a.cards.find(c=>c.ingredientId==='I_RET').priority,b.cards.find(c=>c.ingredientId==='I_RET').priority);
 assert.equal(b.cards.filter(c=>c.ingredientId==='I_RET').length,1);
});
test('family/form and age assumptions stay explicit',()=>{
 const r=evaluate({...input(scenarioAnswers('C_ACNE')),assumedContext:undefined},data);
 assert.ok(r.cards.every(c=>c.status!=='candidate'));assert.ok(r.cards.find(c=>c.ingredientId==='I_RET').ruleIds.includes('FORM-APPLICABILITY'));
});
const global={E_AZA:{score:3}},personal={};
test('T-FW-001: personal learning never mutates global evidence',()=>{
 const r=recordOutcome({scope:'PERSONAL',memberId:'test',outcome:'improvement',adherenceReviewed:true,confoundersReviewed:true},personal,global);
 assert.ok(r.personal.test);assert.deepEqual(r.global,global);assert.deepEqual(personal,{});
});
test('T-FW-002: pooled outcomes create only a research signal; admission required',()=>{
 const r=recordOutcome({scope:'COHORT',outcome:'1000 outcomes',adherenceReviewed:true,confoundersReviewed:true},personal,global);
 assert.equal(r.researchSignal.claimEligible,false);assert.deepEqual(r.global,global);
 assert.throws(()=>admitEvidence(global,'new',3,{id:'pending',approved:false,scientificReview:false,predefinedEndpoint:false}));
});
test('T-FW-003: uncontrolled member marketing claim is blocked',()=>{
 assert.throws(()=>generateClaim('87% improved'));
});
const unresolved={id:'CR-001',version:'v0.1',approved:false,trigger:'pregnant / trying',form:'retinyl palmitate; sunscreen; unknown concentration',action:'UNRESOLVED'};
test('T-CR-001: unresolved exact-form clinical rule makes no safety statement',()=>{
 const r=evaluateClinicalRule(unresolved.trigger,unresolved.form,[unresolved]);assert.equal(r.action,'CLINICIAN REVIEW');assert.equal(r.definitive,false);
});
test('T-CR-002: synthetic approved rule follows exact version and scope',()=>{
 const fixture={...unresolved,approved:true,version:'synthetic-v2',action:'CLINICIAN REVIEW'};
 const r=evaluateClinicalRule(fixture.trigger,fixture.form,[fixture]);assert.equal(r.version,'synthetic-v2');assert.equal(r.ruleId,'CR-001');assert.equal(r.action,fixture.action);
 assert.equal(evaluateClinicalRule(fixture.trigger,'tretinoin',[fixture]).definitive,false);
});
const expression={id:'PX_TEST_V1',productId:'SPF_TEST',version:'V1',ingredientId:'I_RET',form:'retinyl palmitate',efficacy:0,load:0,safety:2,duplication:0,verified:false,evidenceIds:[]};
test('T-EX-001: incidental presence can carry safety relevance without efficacy',()=>{
 const e=createExpression(expression,[]);assert.equal(e.efficacy,0);assert.equal(e.safety,2);assert.throws(()=>createExpression({...e,efficacy:3},[]));
});
test('T-PR-001: verified finished-product performance governs, not filter load',()=>{
 assert.equal(productPerformance({job:'SPF',verified:true,labelPerformance:50,filterLoad:11}),productPerformance({job:'SPF',verified:true,labelPerformance:50,filterLoad:45}));
 assert.equal(productPerformance({job:'SPF',verified:false,labelPerformance:50,filterLoad:45}),null);
});
test('T-NB-001: adequate coverage and redundant load cannot produce ADD',()=>{
 assert.equal(chooseMinimumChange({coverage:3,increment:0,load:2,tolerated:true,adherent:true}),'NO CHANGE');
 assert.equal(chooseMinimumChange({coverage:3,increment:0,load:2,tolerated:true,adherent:false}),'USE DIFFERENTLY');
 assert.equal(chooseMinimumChange({coverage:null,increment:null,load:0,tolerated:true,adherent:true}),'REVIEW COVERAGE');
});
test('T-PV-001: formula changes require new immutable expression identity',()=>{
 assert.throws(()=>createExpression({...expression,version:'V2'},[expression]));
 assert.equal(createExpression({...expression,id:'PX_TEST_V2',version:'V2'},[expression]).version,'V2');
});
test('updated evidence is read from the dataset, but cannot transfer between ingredients',()=>{
 const next=structuredClone(data); const gly=next.tables.pathwayIngredients.find(r=>r.Ingredient_ID==='I_GLY');
 gly.Evidence_IDs='E_GLY_HYDR';next.tables.evidence.push({Evidence_ID:'E_GLY_HYDR',Source_ID:'SRC_AAD_ACNE','Ingredient/Form Studied':'glycerin',Endpoint:'hydration',Evidence_0_3:2,_source:{sheet:'12_EVIDENCE_OBJECTS',row:9}});
 // Supply an explicit workbook condition edge to replace the proposed missing route.
 next.tables.conditionPathways.push({Condition_ID:'C_DEHYDRATION',Pathway_ID:'P_HYDR',Base_Relevance_0_3:3,_source:{sheet:'04_CONDITION_PATHWAY',row:21}});
 assert.equal(evaluate(input(scenarioAnswers('C_DEHYDRATION')),next).cards.find(c=>c.ingredientId==='I_GLY').status,'candidate');
 next.tables.evidence.at(-1)['Ingredient/Form Studied']='topical retinoids';
 assert.equal(evaluate(input(scenarioAnswers('C_DEHYDRATION')),next).cards.find(c=>c.ingredientId==='I_GLY').status,'evidence_review');
});
test('declared clinical history is distinct from a photo diagnosis',()=>{
 const r=evaluate(input({...scenarioAnswers('C_GLOW'),diagnoses:['C_MELASMA']}),data);
 assert.ok(r.states.some(s=>s.conditionId==='C_MELASMA'&&s.source==='questionnaire'));
});
