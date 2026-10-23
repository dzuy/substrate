const key = id => `substrate:journey:v1:${id}`;
const fresh = () => ({version:1,stage:'welcome',revision:0,cloudRevision:0,updatedAt:new Date().toISOString()});
function valid(state) {
 if(!state || state.version!==1 || !Number.isSafeInteger(state.revision) || state.revision<0)throw Error('Stored journey needs recovery. No progress was replaced.');
 return state;
}
function preview(remote) {return {revision:remote.revision,stage:remote.payload.stage,updatedAt:remote.payload.updatedAt};}
function payload(state) {return {...state,cloudRevision:state.revision,photos:undefined,scan:undefined,report:state.report?{...state.report,photo:undefined}:undefined};}
export function createJourneyStore({storage,remote,now=()=>new Date().toISOString()}) {
 const queues=new Map();
 async function serial(id,fn) {const previous=queues.get(id)||Promise.resolve();const next=previous.catch(()=>{}).then(fn);queues.set(id,next);try{return await next;}finally{if(queues.get(id)===next)queues.delete(id);}}
 async function readLocal(id) {const raw=await storage.getItem(key(id));return raw?valid(JSON.parse(raw)):fresh();}
 async function readRemote(id) {try{return await remote.read(id);}catch{return {data:null,error:true};}}
 async function backup(id,device,account) {
  // One owner-scoped recovery snapshot preserves both versions before the explicit choice.
  await storage.setItem(`${key(id)}:conflict-backup`,JSON.stringify({savedAt:now(),device,account}));
 }
 function view(state,result) {
  const account=result.data;const conflict=!result.error && account && account.revision>(state.cloudRevision||0) && state.revision!==(state.cloudRevision||0) ? preview(account):null;
  return {state,available:!result.error,cloud:!result.error && !!account && account.revision===state.revision && state.cloudRevision===state.revision,conflict};
 }
 async function load(id) {return serial(id,async()=>{let local=await readLocal(id);const result=await readRemote(id);const account=result.data;
  if(!result.error && account && account.revision>(local.cloudRevision||0) && local.revision===(local.cloudRevision||0)) {
   valid(account.payload);local={...account.payload,revision:account.revision,cloudRevision:account.revision};await storage.setItem(key(id),JSON.stringify(local));
  }
  return view(local,result);
 });}
 async function saveCore(id,state,expectedCloud=state.cloudRevision||0) {
  valid(state);const current=await readLocal(id);if(current.revision>state.revision)throw Error('This device changed in another view. Reopen before saving.');
  const next={...state,revision:Math.max(state.revision,expectedCloud)+1,updatedAt:now()};
  await storage.setItem(key(id),JSON.stringify(next));
  let result;try{result=await remote.write(id,expectedCloud,payload(next));}catch{result={error:true};}
  if(!result.error){next.cloudRevision=next.revision;await storage.setItem(key(id),JSON.stringify(next));return {state:next,cloud:true,available:true,conflict:null};}
  return view(next,await readRemote(id));
 }
 async function save(id,state) {return serial(id,()=>saveCore(id,state));}
 async function resolve(id,state,choice,seenRevision) {return serial(id,async()=>{
  if(!['device','account'].includes(choice))throw Error('Choose which progress to use.');
  valid(state);const current=await readLocal(id);if(current.revision>state.revision)throw Error('This device changed. Refresh the conflict choices.');
  const result=await readRemote(id);if(result.error||!result.data)throw Error('Account progress is unavailable. Both versions are unchanged. Retry later.');
  const account=result.data;valid(account.payload);
  if(account.revision!==seenRevision)throw Error('Account progress changed again. Refresh the choices before resolving.');
  await backup(id,state,account.payload);
  if(choice==='account') {const adopted={...account.payload,revision:account.revision,cloudRevision:account.revision};await storage.setItem(key(id),JSON.stringify(adopted));return {state:adopted,cloud:true,available:true,conflict:null};}
  return saveCore(id,{...state,revision:Math.max(state.revision,account.revision),cloudRevision:account.revision},account.revision);
 });}
 return {load,save,resolve};
}
