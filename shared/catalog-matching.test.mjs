import test from 'node:test';
import assert from 'node:assert/strict';
import { matchDetectedProduct, matchDailyProducts, projectCatalogProduct } from './catalog-matching.mjs';
test('photo identity matches past ten thousand records without accepting ambiguous variants',()=>{
 const rows=Array.from({length:10756},(_,i)=>({id:String(i),name:`Formula ${i}`,brand:{name:'Brand'}}));
 const detection={detectedBrand:'Brand',detectedProductName:'Formula 10755'};
 assert.equal(matchDetectedProduct(detection,rows),'10755');
 assert.equal(matchDetectedProduct(detection,[...rows,{...rows.at(-1),id:'duplicate'}]),null);
 assert.equal(matchDetectedProduct({...detection,detectedBrand:null},rows),null);
});
test('daily matching evaluates full catalog and does not require publishing; incomplete formulas and treatment actives are excluded',()=>{
 const product={id:'last',name:'Barrier cream',brand:{name:'Example'},product_type:'topical',formula_status:'full_unverified',catalog_visible:false,product_ingredients:[{ingredient:{name:'Glycerin'}}]};
 const rows=[...Array.from({length:10000},(_,i)=>({id:String(i),name:'Unmapped'})),product];
 assert.equal(matchDailyProducts(rows,['Glycerin'])[0].id,'last');
 assert.deepEqual(matchDailyProducts([{...product,formula_status:'missing'}],['Glycerin']),[]);
 assert.deepEqual(matchDailyProducts([{...product,product_ingredients:[...product.product_ingredients,{ingredient:{name:'Retinol'}}]}],['Glycerin']),[]);
 assert.equal(projectCatalogProduct({...product,product_ingredients:[{ingredient:{name:'Sodium ascorbyl phosphate'}}]}).expressions.length,0);
});
