import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, dependencies = {}) {
  const exports = {};
  const js = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, { exports, require: name => dependencies[name] });
  return exports;
}
const pagination = load('src/services/catalog-pagination.ts');
function service(rows, failurePage = -1) {
  const calls = [];
  const supabase = { from(table) {
    let active = rows;
    const q = {
      select() { return q; }, order() { return q; },
      is(key, value) { active = active.filter(r => r[key] === value); return q; },
      eq(key, value) { active = active.filter(r => r[key] === value); return q; },
      range(from, to) { calls.push([from, to]); return Promise.resolve(from === failurePage ? {data:null,error:{message:'page failed'}} : {data:active.slice(from,to+1),error:null}); },
      upsert(payload, options) { calls.push({table, payload, options}); return q; },
      single() { return Promise.resolve({data:calls.at(-1)?.payload,error:null}); },
    };
    return q;
  }};
  return { api: load('src/services/catalog.ts', {'@/lib/supabase': {supabase}, './catalog-pagination': pagination}), calls };
}
test('all pages include incomplete drafts; archived excluded; late catalog search works', async () => {
  const rows = Array.from({length:10762}, (_,i) => ({id:String(i),name:`Product ${i}`,archived_at:null,catalog_visible:false,formula_status:'unresolved',recommendation_enabled:false,status:'draft',product_ingredients:[]}));
  rows.push({...rows[0],id:'archived',archived_at:'2026-01-01'});
  const before = JSON.stringify(rows);
  const {api,calls} = service(rows);
  const result = await api.listCatalogProducts();
  assert.equal(result.error,null);
  assert.equal(result.data.length,10762);
  assert.equal(api.searchCatalogProducts(result.data, 'product 10761').length,1);
  assert.equal(result.data.some(p=>p.id==='archived'),false);
  assert.equal(calls.length,22);
  assert.equal(JSON.stringify(rows),before);
  assert.equal((await api.listCatalogProducts({includeArchived:true})).data.length,10763);
});
test('page failure is surfaced rather than returning a partial catalog', async () => {
  const {api} = service(Array.from({length:600},()=>({archived_at:null})),500);
  const result = await api.listCatalogProducts();
  assert.equal(result.data,null); assert.equal(result.error.message,'page failed');
});
test('adding an existing draft only upserts the member wardrobe reference', async () => {
  const {api,calls} = service([]);
  const result = await api.addProductToWardrobe('member','draft-product');
  assert.equal(result.error,null);
  assert.equal(calls.length,1);
  assert.equal(calls[0].table,'user_wardrobe_items');
  assert.equal(calls[0].payload.product_id,'draft-product');
  assert.equal(calls[0].payload.user_id,'member');
  assert.equal(calls[0].options.onConflict,'user_id,product_id');
});
