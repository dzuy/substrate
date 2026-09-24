import test from 'node:test';
import assert from 'node:assert/strict';
import { matchProducts } from '../../packages/ingredient-engine/dist/products.js';
import catalog from './catalog/curated-products.json' with {type:'json'};
import { resolveIngredients } from './ingredients.mjs';
import { openaiConcerns } from './providers.mjs';
const card=(id,status='candidate')=>({ingredientId:id,status,name:id,priority:1,explanation:'Acne'});
const decision=(cards,status='ready')=>({cards,status,knowledgeVersion:'test',ruleVersion:'test'});
test('deduplicates multi-ingredient products without inventing concentrations',()=>{
 const r=matchProducts(decision([card('I_CER'),card('I_GLY'),card('I_HA')]),{...catalog,products:catalog.products.filter(p=>p.id==='cerave-cream')});
 assert.equal(r.items.length,1);assert.equal(r.items[0].matches.length,3);
 assert.ok(r.items[0].matches.every(m=>m.concentration===null));
});
test('noneligible ingredients and decision holds cannot produce products',()=>{
 for(const status of ['withheld','needs_context','evidence_review','research_only','no_change','clinician_review'])assert.equal(matchProducts(decision([card('I_SA',status)]),catalog).items.length,0);
 for(const status of ['retake','no_change','clinician_review'])assert.equal(matchProducts(decision([card('I_SA')],status),catalog).items.length,0);
});
test('incidental ingredient cannot bypass held treatment active',()=>{
 const mixed={...catalog,products:[{...catalog.products[2],expressions:[{ingredientId:'I_GLY',label:'Glycerin',role:'primary',concentration:null}]}]};
 assert.equal(matchProducts(decision([card('I_GLY'),card('I_BPO','withheld')]),mixed).items.length,0);
 assert.equal(matchProducts(decision([card('I_GLY')]),catalog).items.some(p=>p.id==='panoxyl-bpo'),false);
});
test('actual ingredient adapter attaches catalog matches and respects changed context',()=>{
 const analysis={faceDetected:true,lighting:80,sharpness:80,framing:80,confidence:75,retakeReasons:[],...Object.fromEntries(openaiConcerns.map(c=>[c,c==='acne'?40:0])),detailedFindings:openaiConcerns.map(concern=>({concern,assessment:concern==='acne'?'visible':'not_visible'})),regions:[]};
 const answers={goal:'Breakouts',feel:'Comfortable',duration:'Recurring',blemishes:'Both clogged pores and pimples',treatments:['None'],change:'No changes',sensitivity:'Usually tolerates products',allergy:'None known',reproductive:'None / not applicable',photo:['None'],routine:'Not enough'};
 const r=resolveIngredients(analysis,answers);
 assert.equal(r.productSuggestions.items.length,4);
 assert.equal(new Set(r.productSuggestions.items.slice(0,3).flatMap(p=>p.matches.map(m=>m.ingredientId))).size,3);
 assert.equal(r.productSuggestions.knowledgeVersion,r.knowledgeVersion);
 for(const patch of [{feel:'Stinging / burning'},{routine:'Yes, comfortable and working'},{allergy:'Yes'}])assert.equal(resolveIngredients(analysis,{...answers,...patch}).productSuggestions.items.length,0);
});

test('broader catalog uses valid ingredient IDs and distinct products',async()=>{
 const {default:k}=await import('./knowledge/active.json',{with:{type:'json'}});
 const ids=new Set(k.tables.ingredients.map(x=>x.Ingredient_ID));
 assert.equal(catalog.products.length,12);
 assert.equal(new Set(catalog.products.map(p=>p.id)).size,12);
 assert.ok(catalog.products.every(p=>p.expressions.every(e=>ids.has(e.ingredientId))));
});
test('demo examples connect pending support ingredients without promoting them',()=>{
 const d={...decision([card('I_CER','evidence_review'),card('I_HA','needs_context'),card('I_NIA','evidence_review'),card('I_PANTH','evidence_review')]),answers:{allergy:'None known',feel:'Comfortable'},states:[]};
 const r=matchProducts(d,catalog);
 assert.equal(r.items.length,0);assert.equal(r.demoItems.length,4);
 assert.equal(new Set(r.demoItems.map(p=>p.category)).size,4);
 assert.ok(d.cards.every(c=>c.status!=='candidate'));
 assert.ok(r.demoItems.every(p=>!p.requiredEligibleIds.length));
 for(const patch of [{allergy:'Yes'},{feel:'Stinging / burning'},{change:'Recent or planned procedure'},{routine:'Yes, comfortable and working'}]) assert.equal(matchProducts({...d,answers:{...d.answers,...patch}},catalog).demoItems.length,0);
 assert.equal(matchProducts({...d,status:'retake'},catalog).demoItems.length,0);
});
test('held ingredient cannot reappear through demo product or secondary ingredient',()=>{
 const d={...decision([card('I_CER','withheld'),card('I_HA','evidence_review'),card('I_RET','evidence_review')]),answers:{allergy:'None known'}};
 const r=matchProducts(d,catalog);
 assert.ok(r.demoItems.every(p=>!p.expressions.some(e=>['I_CER','I_RET'].includes(e.ingredientId))));
});
