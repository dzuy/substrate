import test from 'node:test';
import assert from 'node:assert/strict';
import {loadDatabaseCatalog} from './catalog/database.mjs';
const env={EXPO_PUBLIC_SUPABASE_URL:'https://example.supabase.co',EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public-test-key'};
test('full catalog includes late unpublished records and preserves reviewed metadata',async()=>{
 const rows=Array.from({length:10756},(_,i)=>({id:String(i),name:`Product ${i}`,formula_status:'full_unverified',product_type:'topical',brand:{name:'Brand'},product_ingredients:[{ingredient:{name:'Glycerin'}}]}));
 let pages=0;
 const result=await loadDatabaseCatalog(env,async(url,options)=>{
  assert.equal(options.headers.Authorization,'Bearer user-token');
  if(url.pathname.includes('/rpc/'))return {ok:true,json:async()=>({products:[{id:'0',sourceUrl:'https://brand.example/product',formulaHash:'reviewed'}]})};
  assert.equal(url.searchParams.get('archived_at'),'is.null');
  assert.equal(url.searchParams.has('catalog_visible'),false);
  pages++;
  const offset=Number(url.searchParams.get('offset'));
  return {ok:true,json:async()=>rows.slice(offset,offset+Number(url.searchParams.get('limit')))};
 },'Bearer user-token');
 assert.equal(result.products.length,10756);
 assert.equal(result.products.at(-1).expressions[0].ingredientId,'I_GLY');
 assert.equal(result.products[0].sourceUrl,'https://brand.example/product');
 assert.equal(pages,54);
});
test('a failed later page never returns a partial catalog',async()=>{
 const result=await loadDatabaseCatalog(env,async url=>url.pathname.includes('/rpc/')?{ok:true,json:async()=>({products:[]})}:Number(url.searchParams.get('offset'))===0?{ok:true,json:async()=>Array.from({length:200},(_,id)=>({id:String(id)}))}:{ok:false},'Bearer user-token');
 assert.equal(result.version,'database-unavailable');assert.deepEqual(result.products,[]);
});
test('anonymous requests never call the catalog',async()=>{
 const result=await loadDatabaseCatalog(env,()=>{throw Error('must not call');});
 assert.equal(result.version,'sign-in-required');
});
