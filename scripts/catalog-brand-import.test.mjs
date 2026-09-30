import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareBrandImport,buildBrandSql,stableId,variantIdentity} from './catalog-brand-import.mjs';
const backup={brands:[],products:[],catalog_records:[],ingredients:[]};
const snapshot=id=>({source:{id,created_time:'2026-09-30',url:'https://drive.google.com/file/d/'+id,modified_time:'2026-09-30'},sheets:[],sha256:id});
const row=(id,patch={})=>({source_id:id,source_file_id:id,sha256:id,sheet:'Products',row:2,raw:{},fields:{brand:'Example',product_name:'Serum',variant:'',ingredient_list:'',formula_status:'missing',category:'serum',product_type:'topical',is_bundle:'false',price_raw:'',price_amount:'',currency:'',manufacturer_sku:'',...patch}});
test('IDs are stable and imports do not archive existing products',()=>{
 const p=prepareBrandImport([row('a')],backup,[snapshot('a')]);
 const second=prepareBrandImport([row('a')],backup,[snapshot('a')]);
 assert.equal(p.products[0].id,second.products[0].id);
 assert.match(stableId('x'),/^[a-f0-9-]{36}$/);
 assert.doesNotMatch(buildBrandSql(p,[snapshot('a')]),/delete from|set archived_at/i);
});
test('sizes and Base/Premium remain separate',()=>{
 const rows=[row('a',{variant:'40 mL'}),row('b',{variant:'80 mL'}),row('c',{variant:'Base'}),row('d',{variant:'Premium'})];
 assert.equal(prepareBrandImport(rows,backup,rows.map(r=>snapshot(r.source_file_id))).products.length,4);
});
test('collapsed family copies merge while source evidence survives',()=>{
 const rows=[row('a'),row('b',{variant:'Current official presentation(s); sizes consolidated'})];
 const p=prepareBrandImport(rows,backup,rows.map(r=>snapshot(r.source_file_id)));
 assert.equal(p.products.length,1);assert.equal(p.sources.length,2);
 assert.equal(variantIdentity('Current official presentation(s); sizes consolidated'),'');
});
test('conflicting formulas disable formula readiness and create a review',()=>{
 const rows=[row('a',{ingredient_list:'Water, Glycerin'}),row('b',{ingredient_list:'Water, Retinol'})];
 const p=prepareBrandImport(rows,backup,rows.map(r=>snapshot(r.source_file_id)));
 assert.equal(p.products[0].formula_status,'unresolved');assert.equal(p.ingredientLinks.length,0);
 assert.match(p.reviews[0].fields.issue,/Conflicting ingredient/);
});
test('same-name rows in one file stay distinct',()=>{
 const rows=[row('a'),{...row('b'),source_file_id:'a',row:3}];
 assert.equal(prepareBrandImport(rows,backup,[snapshot('a')]).products.length,2);
});
test('an existing product identity is preserved',()=>{
 const brand={id:stableId('brand:example'),name:'Example',slug:'example'};
 const b={...backup,brands:[brand],products:[{id:stableId('live'),brand_id:brand.id,name:'Serum',aliases:[]}],catalog_records:[{source_id:'SKP-1',product_id:stableId('live'),fields:{}}]};
 const p=prepareBrandImport([row('a')],b,[snapshot('a')]);
 assert.equal(p.products[0].id,stableId('live'));assert.equal(p.records.length,0);assert.equal(p.products[0].existing,true);
});
