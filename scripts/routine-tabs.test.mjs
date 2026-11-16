import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
function setup(wardrobe=[],status='loaded',service={}){let cursor=0;const slots=[];const jsx=(type,props)=>({type,props});const modules={
 react:{useState:v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return [slots[i],n=>slots[i]=typeof n==='function'?n(slots[i]):n];},useRef:v=>{const i=cursor++;return slots[i]||={current:v};},useEffect:()=>{},useCallback:f=>f},'react/jsx-runtime':{jsx,jsxs:jsx},
 'expo-router':{useRouter:()=>({}),useFocusEffect:()=>{}},'react-native':{Platform:{OS:'web'},View:'View',ScrollView:'ScrollView',Pressable:'Pressable'},'expo-image':{Image:'Image'},'lucide-react-native':{},
 '@/services/recommendations':{readPlanInputs:async()=>({data:{fingerprint:'current'}}),saveTodayRecommendationPlan:async(...args)=>{service.saved=args[2];return service.failure?{error:Error('Save failed. Please retry.')}:{data:{}};}},'../../shared/journey.mjs':{localDate:()=> '2026-11-16'},'@/components/tate-drawer':{useTate:()=>({})},'@/report/theme':{useReportTheme:()=>({theme:{}})},'@/report/ui':Object.fromEntries(['Copy','Panel','ReportButton','ReportFrame','Notice'].map(x=>[x,x]))};
 const plan={inputFingerprint:'current',catalogComparedCount:100,productMatches:[{id:'match',brand:'Brand',name:'Alternative',matchedIngredients:['water'],note:'Match note'}],items:[{id:'one',moment:'morning',label:'Breakfast product',reason:'Apply the saved amount after breakfast.',completed:false},{id:'two',moment:'day',label:'After sport care',completed:false}],sections:[{id:'breakfast',title:'Post-breakfast',itemIds:['one']},{id:'pickleball',title:'After Pickleball',itemIds:['two']}],eventPlanningSource:'fallback'};
 const source=readFileSync('src/app/routine.tsx','utf8').replace('function Day(', 'export function Day(').replace('useState<DailyPlan | null>(null)','useState<DailyPlan | null>(__plan)').replace('useState<UserWardrobeItem[]>([])','useState<UserWardrobeItem[]>(__wardrobe)').replace('const [refreshing, setRefreshing] = useState(true)',`const [refreshing, setRefreshing] = useState(${status==='loading'})`).replace("const [loadedKey,setLoadedKey] = useState('')",`const [loadedKey,setLoadedKey] = useState('${status==='new-version'?'old':'user:undefined:0'}')`).replace('const [regenerating,setRegenerating] = useState(false)',`const [regenerating,setRegenerating] = useState(${status==='regenerating'})`).replace('const [loadFailed,setLoadFailed] = useState(false)',`const [loadFailed,setLoadFailed] = useState(${status==='error'})`);const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Error,__plan:status==='empty'?null:plan,__wardrobe:wardrobe,require:n=>modules[n]||{}});return ()=>{cursor=0;return exports.Day({userId:'user'});};}
function nodes(t){return !t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(nodes):[t,...nodes(t.props?.children)];}
test('personalized tabs switch sections, preserve navigation and omit fallback banner',()=>{const render=setup();let tree=render();let all=nodes(tree);const tabs=all.filter(n=>n.props?.accessibilityRole==='tab');assert.equal(tabs.length,2);assert.equal(tabs[0].props.accessibilityState.selected,true);assert.ok(all.some(n=>n.props?.accessibilityLabel==='1. Breakfast product'));assert.ok(!all.some(n=>n.props?.accessibilityLabel==='1. After sport care'));tabs[1].props.onPress();tree=render();all=nodes(tree);assert.ok(all.some(n=>n.props?.accessibilityLabel==='1. After sport care'));assert.doesNotMatch(JSON.stringify(tree),/Tate is unavailable/);assert.ok(all.some(n=>n.type==='ScrollView'&&n.props.horizontal));});

test('routine rows omit placeholders and show only real image URLs; broken images collapse',()=>{
 const noImage=setup([{product:{name:'Breakfast product',category:'moisturizer'}}]);
 assert.ok(!nodes(noImage()).some(n=>n.type==='Image'&&n.props.style?.width===42));
 const render=setup([{product:{name:'Breakfast product',image_url:'https://example.test/real-product.jpg'}}]);
 const image=nodes(render()).find(n=>n.type==='Image'&&n.props.source?.uri);
 assert.equal(image.props.source.uri,'https://example.test/real-product.jpg');image.props.onError();
 assert.ok(!nodes(render()).some(n=>n.type==='Image'&&n.props.style?.width===42));
 assert.doesNotMatch(readFileSync('src/app/routine.tsx','utf8'),/assets\/images\/products\//);
});

test('loading, regeneration and new data version show only accessible static skeleton, no generic tabs',()=>{
 for(const status of ['loading','regenerating','new-version']){
  const tree=setup([],status)();assert.equal(tree.type.name,'RoutineLoading');const skeleton=tree.type();
  assert.ok(nodes(skeleton).some(n=>n.props?.accessibilityRole==='progressbar'&&n.props.accessibilityState.busy));
  assert.ok(!nodes(skeleton).some(n=>n.props?.accessibilityRole==='tab'||n.props?.onPress));
  assert.doesNotMatch(JSON.stringify(skeleton),/Morning|Daytime|Evening/);
 }
});
test('load errors and empty day exit skeleton into meaningful recoverable states',()=>{
 const error=setup([],'error')();assert.ok(nodes(error).some(n=>n.props?.label==='Retry loading routine'));
 const empty=setup([],'empty')();assert.match(JSON.stringify(empty),/No routine saved for today yet/);assert.ok(nodes(empty).some(n=>n.props?.label==='Go to Your Day'));
 assert.doesNotMatch(JSON.stringify(empty),/Morning|Daytime|Evening/);
});


test('inline details and checkbox persist complete and reopen without disclosure controls',async()=>{
 const service={};const render=setup([],'loaded',service);
 const checkbox=()=>nodes(render()).find(n=>n.props?.accessibilityRole==='checkbox');
 assert.match(JSON.stringify(render()),/Apply the saved amount after breakfast/);
 assert.doesNotMatch(JSON.stringify(render()),/Tap for details|Mark complete|Completed · undo/);
 assert.equal(checkbox().props.accessibilityState.checked,false);
 const pending=checkbox().props.onPress();
 assert.equal(checkbox().props.accessibilityState.disabled,true);
 await pending;
 assert.equal(service.saved.items[0].completed,true);
 assert.equal(service.saved.items[1].completed,false);
 assert.equal(checkbox().props.accessibilityState.checked,true);
 await checkbox().props.onPress();
 assert.equal(service.saved.items[0].completed,false);
 assert.equal(checkbox().props.accessibilityState.checked,false);
});
test('checkbox save failure keeps completion unchanged and displays retryable error',async()=>{
 const render=setup([],'loaded',{failure:true});
 await nodes(render()).find(n=>n.props?.accessibilityRole==='checkbox').props.onPress();
 assert.equal(nodes(render()).find(n=>n.props?.accessibilityRole==='checkbox').props.accessibilityState.checked,false);
 assert.match(JSON.stringify(render()),/Save failed. Please retry/);
 assert.equal(nodes(render()).find(n=>n.props?.accessibilityRole==='checkbox').props.accessibilityState.disabled,false);
});

test('routine omits product match promotions and browse action even when matching data exists',()=>{
 const tree=setup()();assert.doesNotMatch(JSON.stringify(tree),/Product matches|Browse products|Alternative|Match note|Compared 100/);
 assert.ok(nodes(tree).some(n=>n.props?.accessibilityRole==='checkbox'));
});
