import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractLibraryNames,prepareLibrary} from './catalog-library.mjs';
test('partial lists add explicit names without claiming a full formula',()=>{
 assert.deepEqual(extractLibraryNames('PARTIAL — opening confirmed: Water, Rosehip Oil [LIST TRUNCATES HERE IN ALL SOURCES]').names,['Water','Rosehip Oil']);
});
test('source notes and generic ingredient groups do not become ingredients',()=>{
 for(const raw of ['KEY INGREDIENTS — PARTIAL, NOT FULL INCI','INCI NOT PUBLISHED — DO NOT INFER','AHA/PHA exfoliating technology','botanical extracts','Grass-fed','five HA forms'])assert.deepEqual(extractLibraryNames(raw).names,[]);
});
test('active and inactive sections stay separate and concentrations are removed',()=>{
 assert.deepEqual(extractLibraryNames('Active Ingredients: Zinc Oxide 9.0%. Inactive Ingredients: Water, Glycerin').names,['Zinc Oxide','Water','Glycerin']);
});
test('aliases and repeated names are reused',()=>{
 const r=prepareLibrary({ingredients:[{name:'Rosa Canina Seed Oil',aliases:['Rosehip Oil']}],records:[{ingredient_list:'Rosehip Oil, Bergamot Oil'},{ingredient_list:'BERGAMOT OIL, Grapefruit Oil'}]});
 assert.deepEqual(r.names,['Bergamot Oil','Grapefruit Oil']);
});
test('annotated formula retains explicit tokens but excludes the uncertainty',()=>{
 assert.deepEqual(extractLibraryNames('Water, Glycerin, [Di-substituted] Sodium Sulfosuccinate (named inconsistently across sources), Beeswax').names,['Water','Glycerin','Beeswax']);
});
