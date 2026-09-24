import type { Decision } from './contracts.js';

export interface Product {
 id: string; brand: string; name: string; format: string; sourceUrl: string;
 expressions: Array<{ ingredientId: string; label: string; role: string; concentration: number | null }>;
 requiredEligibleIds: string[]; note: string; category?: string; demoAllowed?: boolean; demoOnly?: boolean;
}
export interface ProductCatalog { version: string; region: string; verifiedAt: string; products: Product[] }

/** Catalog facts never promote an ingredient's evidence or eligibility. */
export function matchProducts(decision: Decision, catalog: ProductCatalog) {
 const eligible = new Map(decision.cards.filter(c => c.status === 'candidate').map(c => [c.ingredientId, c]));
 const items = decision.status === 'ready' ? catalog.products.flatMap(product => {
  // Treatment actives must themselves qualify; an incidental humectant cannot bypass a hold.
  if (product.demoOnly || product.requiredEligibleIds.some(id => !eligible.has(id))) return [];
  const matches = product.expressions.filter(e => e.role === 'primary' && eligible.has(e.ingredientId)).map(e => ({
   ...e, ingredientName: eligible.get(e.ingredientId)!.name,
   reason: eligible.get(e.ingredientId)!.explanation,
  }));
  if (!matches.length) return [];
  return [{ ...product, matches, priority: Math.max(...matches.map(m => eligible.get(m.ingredientId)!.priority)) }];
 }).sort((a,b) => b.priority-a.priority || a.id.localeCompare(b.id)) : [];
 // Show one option per ingredient before additional alternatives, without strength-based ranking.
 const covered = new Set<string>();
 const first = items.filter(p => { const fresh=p.matches.some(m=>!covered.has(m.ingredientId)); p.matches.forEach(m=>covered.add(m.ingredientId)); return fresh; });
 const ordered = [...first, ...items.filter(p=>!first.includes(p))].slice(0,4);
 // Demo browsing is deliberately separate from the eligible recommendation list.
 const a = decision.answers || {};
 const blocked = ['withheld','clinician_review','research_only','no_change'];
 const canDemo = decision.status === 'ready' && a.allergy === 'None known'
  && a.routine !== 'Yes, comfortable and working' && a.change !== 'Recent or planned procedure'
  && !['Stinging / burning','Itchy'].includes(String(a.feel))
  && !decision.states?.some(s => ['C_POSTPROC','C_SCAR','C_BRUISE'].includes(s.conditionId));
 const linked = new Map(decision.cards.filter(c => !blocked.includes(c.status)).map(c=>[c.ingredientId,c]));
 const examples = canDemo ? catalog.products.filter(p => p.demoAllowed && !p.requiredEligibleIds.length
  && !ordered.some(x=>x.id===p.id)
  && !p.expressions.some(e=>decision.cards.some(c=>c.ingredientId===e.ingredientId && blocked.includes(c.status))))
 .flatMap(p => {
  const matches=p.expressions.filter(e=>linked.has(e.ingredientId)).map(e=>({...e,ingredientName:linked.get(e.ingredientId)!.name,reason:linked.get(e.ingredientId)!.explanation,status:linked.get(e.ingredientId)!.status}));
  return matches.length ? [{...p,matches}] : [];
 }) : [];
 const categories=new Set<string>();
 const diverse=examples.filter(p=>{const category=p.category||p.format;if(categories.has(category))return false;categories.add(category);return true;});
 const demoItems=[...diverse,...examples.filter(p=>!diverse.includes(p))].slice(0,4);
 return { demoItems, demoPolicyVersion: 'linked-examples-v1', catalogVersion: catalog.version, knowledgeVersion: decision.knowledgeVersion, ruleVersion: decision.ruleVersion,
  region: catalog.region, verifiedAt: catalog.verifiedAt, items: ordered,
  message: ordered.length ? 'Options matched to your eligible ingredients. Choose alternatives, not all together.' : eligible.size ? 'No product match yet for your eligible ingredients.' : 'No product suggestions yet. Ingredient eligibility or context needs to be resolved first.' };
}
