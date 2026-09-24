// Shared boundaries exercised by the workbook's product/outcome fixtures.
export interface Expression { id:string; productId:string; version:string; ingredientId:string; form:string; efficacy:number; load:number; safety:number; duplication:number; verified:boolean; evidenceIds:string[] }
export function createExpression(e:Expression, history:Expression[]):Expression {
 if(history.some(x=>x.id===e.id && JSON.stringify(x)!==JSON.stringify(e)))throw Error('Expression IDs are immutable; create a new product version/expression');
 if(e.efficacy>0 && (!e.verified||!e.evidenceIds.length))throw Error('Efficacy requires verified exposure and evidence');
 return structuredClone(e);
}
export function productPerformance(product:{job:string;verified:boolean;labelPerformance:number|null;filterLoad?:number}) {
 return product.verified?product.labelPerformance:null;
}
export function chooseMinimumChange(input:{coverage:number|null;increment:number|null;load:number;tolerated:boolean;adherent:boolean;replacementAdvantage?:boolean}) {
 if(input.coverage===null||input.increment===null)return 'REVIEW COVERAGE';
 if(!input.tolerated)return 'REVIEW OPTIONAL LOAD';
 if(input.coverage>=3) return input.adherent?'NO CHANGE':'USE DIFFERENTLY';
 if(input.replacementAdvantage && input.increment>0)return 'REPLACE';
 if(input.increment<=0)return 'NO CHANGE';
 if(!input.adherent)return 'USE DIFFERENTLY';
 return input.load>0?'TEST':'ADD';
}
export function evaluateClinicalRule(trigger:string,form:string,rules:Array<{id:string;version:string;approved:boolean;trigger:string;form:string;action:string}>) {
 const rule=rules.find(r=>r.trigger===trigger&&r.form===form);
 return {action:rule?.approved?rule.action:'CLINICIAN REVIEW',ruleId:rule?.id||null,version:rule?.version||null,definitive:Boolean(rule?.approved)};
}
export function recordOutcome(input:{scope:'PERSONAL'|'COHORT';memberId?:string;outcome:string;adherenceReviewed:boolean;confoundersReviewed:boolean}, personal:Record<string,unknown>, global:unknown) {
 if(input.scope==='COHORT')return {personal:structuredClone(personal),global:structuredClone(global),researchSignal:{outcome:input.outcome,claimEligible:false}};
 if(!input.memberId)throw Error('Member ID required');
 return {personal:input.adherenceReviewed&&input.confoundersReviewed?{...structuredClone(personal),[input.memberId]:{outcome:input.outcome,scope:'PERSONAL'}}:structuredClone(personal),global:structuredClone(global),researchSignal:null};
}
export function admitEvidence(global:Record<string,unknown>,id:string,value:unknown,admission:{id:string;approved:boolean;scientificReview:boolean;predefinedEndpoint:boolean}) {
 if(!admission.approved||!admission.scientificReview||!admission.predefinedEndpoint)throw Error('Evidence admission required');
 return {...structuredClone(global),[id]:{value,admissionId:admission.id}};
}
export function generateClaim(text:string,admission?:{approved:boolean;claim:string}) {
 if(!admission?.approved||admission.claim!==text)throw Error('Claim blocked: approved claim-specific evidence required'); return text;
}
