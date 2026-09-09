import test from 'node:test';
import assert from 'node:assert/strict';
import {parseIngredients,generate} from './catalog-ingredients.mjs';
test('preserves numeric locants, parenthetical commas and compound slash names',()=>{
 const p=parseIngredients('Water, 1,2-Hexanediol, Extract (Leaf, Stem), Caprylic/Capric Triglyceride');
 assert.deepEqual(p.items.map(i=>i.name),['Water','1,2-Hexanediol','Extract (Leaf, Stem)','Caprylic/Capric Triglyceride']);
});
test('extracts explicit percentages and separates drug facts sections',()=>{
 const p=parseIngredients('CURRENT FORMULA — ACTIVE: Zinc Oxide 9.0%, Octinoxate 7.5%. INACTIVE: Water, Glycerin');
 assert.equal(p.items.length,4);assert.equal(p.items[0].concentration,9);assert.equal(p.items[2].section,'Inactive');assert.equal(p.items[2].concentration,null);
 assert.equal(parseIngredients('Petrolatum (100%)').items[0].name,'Petrolatum');
});
test('quarantines missing, narrative, incomplete and historical formulas',()=>{
 for(const s of ['NEEDS_MANUFACTURER_VERIFICATION','NOT VERIFIED — no list','PARTIAL — Water, Glycerin','Water, Glycerin [list truncates]','PRIOR FORMULA: Water','Water (Aqua','ACTIVE: Zinc Oxide 10%. INACTIVE (partial — see note): Water'])assert.ok(parseIngredients(s).reason,s);
});
test('reuses INCI matches and preserves existing link metadata',()=>{
 const s={ingredients:[{id:'i',name:'Vitamin C',inci_name:'Ascorbic Acid',aliases:[]}],links:[{product_id:'p',ingredient_id:'i',concentration:15}],records:[{source_id:'SKP-0001',product_id:'p',fields:{ingredient_list:'Ascorbic Acid, Water, Water'}}]};
 const p=generate(s);assert.equal(p.report.preservedLinks,1);assert.equal(p.report.newLinks,1);assert.equal(p.report.newIngredients,1);assert.ok(!p.sql.includes('delete from'));assert.ok(p.sql.includes('on conflict(product_id,ingredient_id) do nothing'));
});
test('refuses ambiguous library matches',()=>{
 assert.throws(()=>generate({ingredients:[{id:'a',name:'Water'},{id:'b',name:'WATER'}],links:[],records:[{source_id:'SKP-0001',product_id:'p',fields:{ingredient_list:'Water'}}]}),/Ambiguous/);
});
