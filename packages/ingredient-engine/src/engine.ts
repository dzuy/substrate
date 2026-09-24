import type { Knowledge, Row, DecisionInput, Decision, State, Card, Status, Trace } from './contracts.js';
import { ruleVersion, inferredEdges, inferredIngredientEdges, visualConditions, goalConditions, sourceLocation, endpointTerms } from './policy.js';
export { ruleVersion } from './policy.js';
export type * from './contracts.js';
const list = (v: unknown): string[] => Array.isArray(v) ? v : typeof v === 'string' ? [v] : [];
const normalize = (v: unknown) => String(v || '').trim().toLowerCase();
const ids = (v: unknown) => typeof v === 'string' ? v.split(';').map(s=>s.trim()).filter(Boolean) : [];
const severity: Record<Status,number> = {candidate:0,evidence_review:1,no_change:2,needs_context:3,research_only:4,withheld:5,clinician_review:6};
const clinicalConditions = new Set(['C_MELASMA','C_LAXITY','C_VOLUME','C_SCAR','C_POSTPROC','C_BRUISE']);
const treatmentIds = new Set(['I_RET','I_SA','I_AZA','I_BPO','I_VITC']);
const overlap: Record<string,string[]> = {I_RET:['Retinoid'],I_SA:['Exfoliating acid'],I_AZA:['Azelaic acid'],I_BPO:['Benzoyl peroxide']};
const contextRules = ['G_RX','G_PROC','G_PREG','G_AGE','G_BARRIER','G_DUP','G_NEWVAR','G_EO','G_UV','G_REFERRAL'];

export function evaluate(input: DecisionInput, knowledge: Knowledge): Decision {
 if (knowledge.schemaVersion !== 1) throw Error('Unsupported knowledge schema');
 const t=knowledge.tables, a=input.answers, photo=input.analysis;
 const result: Decision={knowledgeVersion:knowledge.version,ruleVersion,createdAt:input.now,answers:structuredClone(a),assumedContext:input.assumedContext,status:'ready',message:'',cards:[],notes:[],unmetConcerns:[],states:[],pathways:[],coverage:coverage(knowledge),policyNotes:['Priority is a prototype ordering, not a clinical probability.','Imported evidence is provisional until admitted.','Proposed missing-edge links remain distinct from workbook relationships.']};
 const badPhoto=!photo?.faceDetected || ['lighting','sharpness','framing','confidence'].some(k=>!Number.isFinite(photo[k]) || photo[k]<40) || Boolean(photo.retakeReasons?.length);
 if (badPhoto) { result.status='retake'; result.message='Retake the photo in even light with a clear face before linking ingredients.'; return result; }
 const visible=(photo.detailedFindings||[]).filter(f=>f.assessment==='visible' && Number.isFinite(photo[f.concern]) && photo[f.concern]>0).map(f=>f.concern);
 const known=new Set(t.conditions.map(r=>r.Condition_ID));
 const selected=[...new Set([...list(a.conditions),...(goalConditions[String(a.goal)]||[]).filter(id=>known.has(id))])];
 if (selected.some(id=>!known.has(id))) throw Error('Selected condition is not in the active workbook');
 const dry=a.feel==='Dry / tight', irritated=['Stinging / burning','Itchy'].includes(String(a.feel));
 const reported=[...selected];
 if(dry) reported.push('C_DEHYDRATION');
 if(irritated) reported.push('C_BARRIER');
 if(a.oil==='Often oily / shiny') reported.push('C_OIL');
 if(a.change==='Recent or planned procedure') reported.push('C_POSTPROC');
 const diagnoses=list(a.diagnoses);
 reported.push(...diagnoses.filter(id=>known.has(id)));
 const photoConfounded=!a.photo || list(a.photo).some(v=>v!=='None');
 for(const condition of t.conditions){
  const id=condition.Condition_ID, concerns=visible.filter(c=>(visualConditions[c]||[]).includes(id));
  const supported=reported.includes(id)||concerns.length>0;
  if(!supported) continue;
  const reasons:string[]=[];
  if(id==='C_ROSACEA' && !diagnoses.includes(id)) reasons.push('Redness context only; rosacea is not diagnosed by this scan.');
  if(id==='C_PIH' && a.marks!=='After a breakout / irritation') reasons.push('Pigment history is unconfirmed; visible discoloration does not establish PIH.');
  if(id==='C_DEHYDRATION') reasons.push('Based on reported dryness or a selected goal; water content is not measured.');
  if(id==='C_MELASMA' && !diagnoses.includes(id)) reasons.push('Selected concern only; diagnosis requires clinician context.');
  result.states.push({conditionId:id,name:condition['Condition / Goal'],supported:true,source:concerns.length ? reported.includes(id)?'photo + questionnaire':'photo':'questionnaire',concerns,reasons});
 }
 const cp: Array<Row & {origin:string}>=t.conditionPathways.map(r=>({...r,origin:'workbook'}));
 for(const [c,p,n] of inferredEdges) if(known.has(c)&&t.pathways.some(r=>r.Pathway_ID===p)&&!t.conditionPathways.some(r=>r.Condition_ID===c)) cp.push({Condition_ID:c,Pathway_ID:p,Base_Relevance_0_3:n,origin:'proposed narrative mapping',_source:{sheet:'prototype-policy',row:inferredEdges.findIndex(e=>e[0]===c&&e[1]===p)+1}} as any);
 const pi: Array<Row & {origin:string}>=t.pathwayIngredients.map(r=>({...r,origin:'workbook'}));
 for(const [p,i] of inferredIngredientEdges) if(t.pathways.some(r=>r.Pathway_ID===p)&&t.ingredients.some(r=>r.Ingredient_ID===i)&&!pi.some(r=>r.Pathway_ID===p&&r.Ingredient_ID===i)) pi.push({Pathway_ID:p,Ingredient_ID:i,Evidence_0_3:null,Direction:'support',origin:'proposed narrative mapping',_source:{sheet:'prototype-pigment-policy',row:inferredIngredientEdges.findIndex(e=>e[1]===i)+1}} as any);
 const edgeRefs=new Map<string,Trace[]>();
 for(const state of result.states){
  for(const edge of cp.filter(r=>r.Condition_ID===state.conditionId)){
   // Workbook phenotype triggers select routes rather than treating every condition edge as active.
   if(state.conditionId==='C_ACNE' && edge.Pathway_ID==='P_PIGMENT' && a.marks!=='After a breakout / irritation' && !visible.some(c=>['pigmentation','residual_marks'].includes(c))) continue;
   if(state.conditionId==='C_ACNE' && edge.Pathway_ID==='P_SEBUM' && a.oil!=='Often oily / shiny' && !['Clogged pores / blackheads','Both clogged pores and pimples'].includes(String(a.blemishes))) continue;
   if(state.conditionId==='C_GLOW' && edge.Pathway_ID==='P_HYDR' && !dry && !selected.includes('C_GLOW')) continue;
   if(state.conditionId==='C_GLOW' && edge.Pathway_ID==='P_INFLAM' && !irritated && !visible.includes('redness')) continue;
   if(state.conditionId==='C_GLOW' && edge.Pathway_ID==='P_PIGMENT' && !visible.some(c=>['pigmentation','residual_marks'].includes(c))) continue;
   let relevance=Number(edge.Base_Relevance_0_3)||0; const modifierIds:string[]=[];
   if(irritated && ['P_BARRIER','P_HYDR'].includes(edge.Pathway_ID)) {relevance=Math.min(3,relevance+1);modifierIds.push('G_BARRIER');}
   if(irritated && ['P_KERATIN','P_ECM'].includes(edge.Pathway_ID)) {relevance=Math.max(0,relevance-1);modifierIds.push('G_BARRIER');}
   if(a.climate==='Dry climate / recent travel' && ['P_BARRIER','P_HYDR'].includes(edge.Pathway_ID)) {relevance=Math.min(3,relevance+1);modifierIds.push('S_HUM','S_TRAVEL');}
   if(a.sun==='Often outdoors / inconsistent protection' && ['P_OX','P_PIGMENT'].includes(edge.Pathway_ID)) {relevance=Math.min(3,relevance+1);modifierIds.push('S_UV');}
   if(a.lifeStage==='Perimenopause / menopause' && ['P_ECM','P_BARRIER','P_HYDR'].includes(edge.Pathway_ID)) {relevance=Math.min(3,relevance+1);modifierIds.push('S_MENO');}
   if(state.conditionId==='C_ACNE' && edge.Pathway_ID==='P_INFLAM' && a.blemishes==='Clogged pores / blackheads') relevance=Math.max(0,relevance-1);
   for(const link of pi.filter(r=>r.Pathway_ID===edge.Pathway_ID)){
    const evidenceIds=ids(link.Evidence_IDs);
    // Resolve an exact linked evidence object and a known endpoint vocabulary.
    // New endpoint vocabularies require a reviewed adapter, not a guessed match.
    const node=t.ingredients.find(r=>r.Ingredient_ID===link.Ingredient_ID)!;
    const names=[node['Canonical Ingredient'],...ids(node.Synonyms)].map(normalize);
    const applicableEvidence=t.evidence.filter(e=>evidenceIds.includes(e.Evidence_ID)&&names.includes(normalize(e['Ingredient/Form Studied']))&&(endpointTerms[state.conditionId]||[]).some(term=>normalize(e.Endpoint).includes(term)));
    const endpointApplicable=applicableEvidence.some(e=>Number(e.Evidence_0_3)>0);
    const score=typeof link.Evidence_0_3==='number'?Math.min(link.Evidence_0_3,...(applicableEvidence.length?applicableEvidence.map(e=>Number(e.Evidence_0_3)||0):[link.Evidence_0_3])):null;
    const trace:Trace={conditionId:state.conditionId,pathwayId:edge.Pathway_ID,relevance,evidenceScore:score,sourceRows:[sourceLocation(edge),sourceLocation(link)],origin:edge.origin==='workbook'&&link.origin==='workbook'?'workbook':'proposed narrative mapping',evidenceIds,endpointApplicable,modifierIds};
    edgeRefs.set(link.Ingredient_ID,[...(edgeRefs.get(link.Ingredient_ID)||[]),trace]);
   }
   const existing=result.pathways.find(p=>p.id===edge.Pathway_ID); if(existing) existing.priority=Math.max(existing.priority,relevance);else result.pathways.push({id:edge.Pathway_ID,priority:relevance});
  }
 }
 for(const [id,trace] of edgeRefs){
  const ingredient=t.ingredients.find(r=>r.Ingredient_ID===id)!;
  const conditionIds=[...new Set(trace.map(x=>x.conditionId))], pathwayIds=[...new Set(trace.map(x=>x.pathwayId))];
  const states=result.states.filter(s=>conditionIds.includes(s.conditionId));
  const concerns=[...new Set(states.flatMap(s=>s.concerns))];
  const evidenceIds=[...new Set(trace.flatMap(x=>x.evidenceIds))];
  const applicable=trace.some(x=>x.endpointApplicable&&x.origin==='workbook'&&(x.evidenceScore||0)>0);
  const card:Card={ingredientId:id,name:ingredient['Canonical Ingredient'],form:ingredient['Form / Variant'],concerns,conditionIds,pathwayIds,pathwayId:pathwayIds.join(', '),job:ingredient['Typical Role']||'Explore relationship',status:applicable?'candidate':'evidence_review',reasons:[],ruleIds:[],findingRefs:states.flatMap(s=>s.concerns.length?s.concerns.map(c=>({concern:c,source:'photo',regions:(photo.regions||[]).filter(r=>Number.isFinite(r[c])&&r[c]>0).map(r=>r.name)})):[{concern:s.name,source:'questionnaire',field:'conditions',regions:[]}]),explanation:states.map(s=>s.name).join(' · '),evidence:applicable?'Source-linked workbook evidence; provisional prototype option, not an admitted production recommendation.':'Evidence or endpoint/form applicability needs review.',evidenceIds,source:null,sourceRow:sourceLocation(ingredient),priority:Math.max(...trace.map(x=>x.relevance*(x.evidenceScore??0)))+(conditionIds.some(c=>selected.includes(c))?1:0),trace,action:'EXPLORE',admission:'provisional'};
  const gate=(status:Status,reason:string,rule:string)=>{if(severity[status]>severity[card.status]) card.status=status; if(!card.reasons.includes(reason)) card.reasons.push(reason); if(!card.ruleIds.includes(rule))card.ruleIds.push(rule);};
  if(!applicable) gate('evidence_review','Relationship is represented; missing or mismatched evidence is not treated as approval.','EVIDENCE-APPLICABILITY');
  if(!applicable && trace.some(x=>x.origin!=='workbook')) gate('evidence_review','Includes a proposed link derived from workbook descriptions.','PROPOSED-MAPPING');
  const ev=t.evidence.find(e=>evidenceIds.includes(e.Evidence_ID)); const src=ev&&t.sources.find(s=>s.Source_ID===ev.Source_ID); if(src && /^https:\/\//.test(src.URL))card.source=src.URL;
  const directions=pi.filter(r=>r.Ingredient_ID===id&&pathwayIds.includes(r.Pathway_ID)).map(r=>r.Direction);
  if(directions.every(d=>d==='caution'||d==='emerging'))gate('research_only','The source relationship is caution/research, not an efficacy recommendation.','SOURCE-DIRECTION');
  if(/^I_HEL_/.test(id)) gate('research_only','Emerging research relationship; not a default treatment option.','RESEARCH-ONLY');
  if((id==='I_RET'||id==='I_VITC') && /multiple|variants|cosmetic \+ Rx/i.test(String(ingredient['Form / Variant']))) gate('evidence_review','Resolve the exact form and exposure; family-level evidence cannot cover every variant.','FORM-APPLICABILITY');
  if(!a.allergy||a.allergy!=='None known') gate('needs_context','Review exact ingredient/formula allergy context.','ALLERGY');
  if(!a.feel||a.feel==='Unsure')gate('needs_context','Confirm current skin comfort.','SYMPTOMS');
  if(photoConfounded && states.some(s=>s.source.includes('photo')))gate('needs_context','Photo conditions need confirmation for these visual links.','PHOTO-CONTEXT');
  if(!a.change||a.change==='Unsure')gate('needs_context','Confirm recent product/procedure changes.','CHANGES');
  if(treatmentIds.has(id)){
   if(irritated||a.sensitivity==='Easily irritated')gate('withheld','Barrier comfort takes priority over escalating this active.','G_BARRIER');
   if(!a.sensitivity||a.sensitivity==='Unsure')gate('needs_context','Confirm tolerance before exploring treatment actives.','G_BARRIER');
   if(a.change==='New product / increased actives'||a.change==='Shaving / waxing')gate('withheld','Stabilize the recent change before testing another active.','G_NEWVAR');
   if(!a.treatments||list(a.treatments).includes('Unsure'))gate('needs_context','Clarify existing treatment exposure.','G_DUP');
   if(list(a.treatments).some(v=>!['None','Unsure'].includes(v)) && (!a.frequency || a.frequency==='Unsure'))gate('needs_context','Treatment frequency is unknown; do not infer total exposure.','G_DUP');
   if(list(a.treatments).some(v=>!['None','Unsure'].includes(v)) && !list(a.treatments).some(v=>(overlap[id]||[]).includes(v)))gate('needs_context','Check overlap and total active load with the existing treatment.','G_DUP');
   if(list(a.treatments).includes('Other prescription')||a.retinoidForm==='Prescription retinoid')gate('needs_context','Prescription care remains the anchor; review overlap without changing prescribed use.','G_RX');
  }
  if(id==='I_RET'&&a.reproductive!=='None / not applicable')gate('clinician_review','Retinoid reproductive handling is unresolved (CR-002); no safety determination.','CR-002');
  if(id==='I_RET'&&list(a.treatments).includes('Retinoid'))gate('no_change','An existing retinoid may cover this job; exact coverage requires formulation and use.','G_DUP');
  if((overlap[id]||[]).some(v=>list(a.treatments).includes(v)))gate('no_change','This ingredient is already reported in your routine. Check coverage before adding it.','G_DUP');
  if(id==='I_HEL_EO'&&(irritated||conditionIds.some(c=>['C_ROSACEA','C_POSTPROC','C_BARRIER'].includes(c))))gate('withheld','Essential oil is distinct from extract and hydrolate; this context triggers fragrance caution.','G_EO');
  if(a.change==='Recent or planned procedure')gate('clinician_review','Procedure protocol governs; no hold/restart timing is inferred (CR-003).','G_PROC');
  if(conditionIds.every(c=>clinicalConditions.has(c)))gate('clinician_review','This concern requires clinical context; related ingredients are not a corrective treatment plan.','G_REFERRAL');
  if(conditionIds.includes('C_ACNE') && a.blemishes==='Deep painful bumps / scarring')gate('clinician_review','Deep or scarring breakouts need clinician assessment.','G_REFERRAL');
  if(conditionIds.includes('C_ACNE') && treatmentIds.has(id) && (!a.blemishes||['Unsure','No breakouts'].includes(String(a.blemishes))))gate('needs_context','Clarify breakout pattern; the scan does not confirm acne.','ACNE-CONTEXT');
  if(conditionIds.includes('C_ACNE') && (!a.duration||['Just today','Unsure','No current concern'].includes(String(a.duration))))gate('needs_context','Clarify persistence before treatment exploration.','DURATION');
  if(conditionIds.some(c=>['C_PIH','C_MELASMA','C_PHOTOAGING'].includes(c)) && a.sun!=='Consistent protection')gate('needs_context','Clarify photoprotection before corrective care.','G_UV');
  if(a.routine==='Yes, comfortable and working')gate('no_change','Your current routine helps; no new addition is established.','G_DUP');
  if(!input.assumedContext?.ageBand)gate('needs_context','Age context is missing; the product adapter must supply real profile context.','G_AGE');
  card.action=card.status==='no_change'?'NO CHANGE':card.status==='withheld'?'HOLD NEW OPTION':card.status==='clinician_review'?'CLINICIAN':card.status==='candidate'?'EXPLORE':'REVIEW';
  result.cards.push(card);
 }
 result.cards.sort((a,b)=>Number(b.status==='candidate')-Number(a.status==='candidate')||b.priority-a.priority||a.name.localeCompare(b.name));
 for(const state of result.states) if(!result.cards.some(c=>c.conditionIds.includes(state.conditionId))) result.notes.push(`${state.name}: no ingredient relationship in the available pathway data. ${clinicalConditions.has(state.conditionId)?'Clinical context is required.':'Mapping review is needed.'}`);
 result.unmetConcerns=visible.filter(c=>!result.cards.some(card=>card.concerns.includes(c)&&card.status==='candidate'));
 result.status=result.cards.length ? result.cards.every(c=>c.status==='clinician_review')?'clinician_review':'ready' : result.states.some(s=>clinicalConditions.has(s.conditionId))?'clinician_review':'no_change'; result.message=result.cards.length?'':'No supported ingredient option identified. Review the condition coverage and missing context below.';
 return result;
}

export function coverage(k:Knowledge){
 const t=k.tables;
 return {conditions:t.conditions.map(r=>({id:r.Condition_ID,name:r['Condition / Goal'],source:sourceLocation(r),mapping:t.conditionPathways.some(e=>e.Condition_ID===r.Condition_ID)?'workbook':inferredEdges.some(e=>e[0]===r.Condition_ID)?'proposed narrative mapping':'missing',observationAdapter:Object.values(visualConditions).some(ids=>ids.includes(r.Condition_ID))?'photo + context':'reported goal/context only'})),ingredients:t.ingredients.map(r=>({id:r.Ingredient_ID,name:r['Canonical Ingredient'],source:sourceLocation(r),edges:t.pathwayIngredients.filter(e=>e.Ingredient_ID===r.Ingredient_ID).length,evidence:r['Evidence Tier']})),pathways:t.pathways.map(r=>({id:r.Pathway_ID,edges:t.pathwayIngredients.filter(e=>e.Pathway_ID===r.Pathway_ID).length})),counts:Object.fromEntries(Object.entries(t).map(([key,rows])=>[key,rows.length])),governors:t.governors.map(r=>({id:r.Governor_ID,implemented:contextRules.includes(r.Governor_ID),source:sourceLocation(r)})),clinicalRules:t.clinicalRules.map(r=>({id:r.Rule_ID,status:r.Status,version:r.Version})),modifiers:t.modifiers.map(r=>({id:r.Signal_ID,status:['S_HUM','S_TRAVEL','S_UV','S_MENO'].includes(r.Signal_ID)?'questionnaire context':'not assessed without timestamped external/longitudinal input'})),tests:t.tests.map(r=>({id:r.Test_ID,area:r.Area,status:'fixture acceptance suite'}))};
}
