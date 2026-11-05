import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { matchDetectedProduct } from '../shared/catalog-matching.mjs';

function fixture(count = 10756) {
  const rows = Array.from({length:count}, (_,i) => ({id:String(i), name:`Product ${i}`, aliases:[`Alias ${i}`], brand:{name:'Brand'}, archived_at:null}));
  rows.push({id:'archived',name:'Archived',archived_at:'yesterday'});
  const calls = [];
  let failure = -1, pending = 0, maxPending = 0, clock = 0;
  const supabase = { from(table) {
    let from, to;
    const q = {
      select(fields) { assert.equal(table,'products'); assert.ok(!fields.includes('*')); assert.ok(!fields.includes('ingredient')); return q; },
      is(key,value) { assert.equal(key,'archived_at'); assert.equal(value,null); return q; },
      order() { return q; },
      range(start,end) { from=start; to=end; return q; },
      async abortSignal(signal) {
        calls.push([from,to]); maxPending=Math.max(maxPending,++pending);
        await new Promise(resolve=>setImmediate(resolve)); --pending;
        if(signal.aborted) return {data:null,error:{message:'aborted'}};
        return from===failure ? {data:null,error:{message:'page failed'}} : {data:rows.filter(r=>r.archived_at===null).slice(from,to+1),error:null};
      },
    }; return q;
  }};
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('src/services/catalog-discovery.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {exports,require:()=>({supabase}),Date:{now:()=>clock}});
  return {api:exports,calls,fail:page=>failure=page,advance:()=>clock+=300001,maxPending:()=>maxPending};
}
test('complete lightweight catalog in six bounded waves; late aliases still match; warm focus makes no requests', async()=>{
  const f=fixture(); const signal=new AbortController().signal;
  const result=await f.api.listCatalogDiscoveryProducts('member',signal);
  assert.equal(result.error,null); assert.equal(result.data.length,10756);
  assert.equal(new Set(result.data.map(p=>p.id)).size,10756);
  assert.equal(result.data.at(-1).id,'10755');
  assert.equal(matchDetectedProduct({detectedBrand:'Brand',detectedProductName:'Alias 10755'},result.data),'10755');
  assert.equal(f.calls.length,24); assert.equal(f.maxPending(),4);
  assert.equal((await f.api.listCatalogDiscoveryProducts('member',signal)).data,result.data);
  assert.equal(f.calls.length,24);
  f.advance(); await f.api.listCatalogDiscoveryProducts('member',signal); assert.equal(f.calls.length,48);
});
test('failed later page never becomes a partial catalog or cache; retry succeeds',async()=>{
  const f=fixture(1600),signal=new AbortController().signal; f.fail(1000);
  const result=await f.api.listCatalogDiscoveryProducts('a',signal);
  assert.equal(result.data,null);assert.equal(result.error.message,'page failed');
  f.fail(-1); assert.equal((await f.api.listCatalogDiscoveryProducts('a',signal)).data.length,1600);
  assert.equal(f.calls.length,8);
});
test('abort cancels current loading without caching; member changes and writes invalidate cache',async()=>{
  const f=fixture(600),controller=new AbortController();
  const pending=f.api.listCatalogDiscoveryProducts('a',controller.signal);controller.abort();
  await assert.rejects(pending,/canceled/);
  const signal=new AbortController().signal;
  await f.api.listCatalogDiscoveryProducts('a',signal);assert.equal(f.calls.length,8);
  await f.api.listCatalogDiscoveryProducts('b',signal);assert.equal(f.calls.length,12);
  f.api.invalidateCatalogDiscovery();await f.api.listCatalogDiscoveryProducts('b',signal);assert.equal(f.calls.length,16);
});
test('empty and exact page boundaries finish without duplicates',async()=>{
  for(const count of [0,500,2000]) {
    const f=fixture(count);const result=await f.api.listCatalogDiscoveryProducts('a',new AbortController().signal);
    assert.equal(result.data.length,count);assert.equal(result.error,null);
  }
});
