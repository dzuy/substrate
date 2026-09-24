import catalog from './catalog/curated-products.json' with { type: 'json' };
import { matchProducts } from '../../packages/ingredient-engine/dist/products.js';
import knowledge from './knowledge/active.json' with { type: 'json' };
import { evaluate, coverage, ruleVersion } from '../../packages/ingredient-engine/dist/engine.js';
import { validateAnswers } from './public/questions.mjs';
export const knowledgeVersion = knowledge.version;
export const knowledgeInfo = { version: knowledge.version, ruleVersion, sourceFile: knowledge.sourceFile, sha256: knowledge.sha256, coverage: coverage(knowledge) };
export const conditionOptions = knowledge.tables.conditions.map(r => ({ id: r.Condition_ID, name: r['Condition / Goal'] }));
export function resolveIngredients(analysis, input) {
 const answers=validateAnswers(input,conditionOptions.map(c=>c.id));
 const decision = evaluate({analysis,answers,now:new Date().toISOString(),assumedContext:{ageBand:'40–50',source:'prototype setting'}},knowledge);
 return { ...decision, productSuggestions: matchProducts(decision, catalog) };
}
