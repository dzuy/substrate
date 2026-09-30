import test from 'node:test';
import assert from 'node:assert/strict';
import {loadDatabaseCatalog} from './catalog/database.mjs';
const env={EXPO_PUBLIC_SUPABASE_URL:'https://example.supabase.co',EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public-test-key'};
test('matching consumes the approved database catalog without demo fallback',async()=>{
 const catalog={version:'empty',region:'unspecified',verifiedAt:'',products:[]};
 const result=await loadDatabaseCatalog(env,async(url,options)=>{
  assert.equal(url.pathname,'/rest/v1/rpc/get_recommendation_catalog');
  assert.equal(options.headers.apikey,'public-test-key');
  assert.equal(options.body,'{}');
  assert.equal(options.headers.Authorization,'Bearer user-token');
  return {ok:true,json:async()=>catalog};
 },'Bearer user-token');
 assert.deepEqual(result,catalog);
});
test('database failure or missing configuration cannot resurrect demo products',async()=>{
 for(const result of [await loadDatabaseCatalog({},undefined,'Bearer user-token'),await loadDatabaseCatalog(env,async()=>({ok:false}),'Bearer user-token'),await loadDatabaseCatalog(env,async()=>{throw Error('offline');},'Bearer user-token')]){
  assert.deepEqual(result.products,[]);assert.ok(['database-unavailable','sign-in-required'].includes(result.version));
 }
});

test('anonymous requests never forward a service credential or call the catalog',async()=>{const r=await loadDatabaseCatalog(env,async()=>{throw Error('must not call');});assert.equal(r.version,'sign-in-required');assert.deepEqual(r.products,[]);});
