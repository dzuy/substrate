import { engineIdentity } from './ingredient-identity.mjs';
const support = new Set(['I_GLY', 'I_CER', 'I_HA', 'I_PANTH']);
export function projectCatalogProduct(p) {
  const complete = ['full_verified', 'full_unverified'].includes(p.formula_status);
  const links = p.product_ingredients || p.ingredients || [];
  const expressions = complete && p.product_type === 'topical' && !p.is_bundle ? links.flatMap(link => {
    const ingredient = link.ingredient;
    const id = engineIdentity(ingredient?.inci_name) || engineIdentity(ingredient?.name);
    return id ? [{ ingredientId: id, label: ingredient.inci_name || ingredient.name, role: 'primary', concentration: null }] : [];
  }) : [];
  return { id:p.id, name:p.name, brand:p.brand?.name || '', category:p.category, format:p.category,
    sourceUrl:'', expressions, requiredEligibleIds:[...new Set(expressions.filter(e=>!support.has(e.ingredientId)).map(e=>e.ingredientId))],
    note: p.formula_status === 'full_verified' ? 'Ingredient list marked verified in the catalog.' : 'Imported ingredient list; formula verification is pending.',
    formulaStatus:p.formula_status, updatedAt:p.updated_at };
}
const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
// Match identities across the entire catalog after OCR, never an alphabetical prefix.
export function matchDetectedProduct(detection, products) {
  const name = normalize(detection.detectedProductName);
  const brand = normalize(detection.detectedBrand);
  if (!name || !brand) return null;
  const ranked = products.filter(p => normalize(p.brand?.name ?? p.brand) === brand).map(p => {
    const names = [p.name, ...(p.aliases || [])].map(normalize);
    const score = Math.max(...names.map(n => {
      if (n === name || `${brand} ${n}` === name) return 1;
      const a = new Set(n.split(' ')), b = new Set(name.split(' '));
      const common = [...a].filter(word => b.has(word)).length;
      return common / new Set([...a, ...b]).size;
    }));
    return { id:p.id, score };
  }).sort((a,b)=>b.score-a.score);
  const top = ranked[0];
  return top && top.score >= 0.8 && (!ranked[1] || top.score - ranked[1].score >= 0.15) ? top.id : null;
}
export function matchDailyProducts(products, favor = [], avoid = []) {
  const favored = new Set(favor.map(engineIdentity).filter(Boolean));
  const avoided = new Set(avoid.map(engineIdentity).filter(Boolean));
  return products.map(projectCatalogProduct).filter(p => p.expressions.length && p.requiredEligibleIds.every(id => id === 'I_NIA' && favored.has(id))
    && !p.expressions.some(e=>avoided.has(e.ingredientId)))
    .map(p=>({...p, matchedIngredients:[...new Set(p.expressions.filter(e=>favored.has(e.ingredientId)).map(e=>e.label))]}))
    .filter(p=>p.matchedIngredients.length).sort((a,b)=>b.matchedIngredients.length-a.matchedIngredients.length || a.id.localeCompare(b.id))
    .slice(0,4).map(({id,name,brand,matchedIngredients,note})=>({id,name,brand,matchedIngredients,note}));
}
