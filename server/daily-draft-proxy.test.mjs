import {test} from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';import {createDailyDraftProxy} from './daily-draft-proxy.mjs';
test('local preflight works; fixed destination preserves auth; unrelated origins/routes rejected',async()=>{
 let request;const server=createDailyDraftProxy({fetcher:async(url,options)=>{request={url,options};return new Response('{"draft":{"dailyActivities":["Breakfast"]}}',{status:200});}});server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
 try{
 const preflight=await fetch(base+'/api/daily-draft',{method:'OPTIONS',headers:{Origin:'http://localhost:8081'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'http://localhost:8081');
 assert.equal((await fetch(base+'/api/daily-draft',{method:'OPTIONS',headers:{Origin:'https://untrusted.example'}})).status,403);
 assert.equal((await fetch(base+'/api/other')).status,404);
 assert.equal((await fetch(base+'/api/daily-draft',{method:'POST'})).status,401);
 const response=await fetch(base+'/api/daily-draft',{method:'POST',headers:{Origin:'http://localhost:8081',Authorization:'Bearer fake.test.token','Content-Type':'application/json'},body:JSON.stringify({note:'Breakfast'})});assert.equal(response.status,200);assert.equal(request.url,'https://www.substrate-skin.com/api/daily-draft');assert.equal(request.options.headers.Authorization,'Bearer fake.test.token');assert.equal(request.options.headers.Origin,undefined);
 }finally{server.closeAllConnections();server.close();await once(server,'close');}
});
