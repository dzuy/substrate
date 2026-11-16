import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function setup(pick, upload=async()=>({data:{id:'photo'}})) {
 let cursor=0;const slots=[],calls=[];
 const react={useEffect:()=>{},useRef:v=>{const i=cursor++;return slots[i]||=( {current:v});},useState:v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return [slots[i],x=>{slots[i]=typeof x==='function'?x(slots[i]):x;}];}};
 const jsx=(type,props)=>({type,props});
 const modules={react,'react/jsx-runtime':{jsx,jsxs:jsx},'expo-image':{Image:'Image'},'react-native':{useWindowDimensions:()=>({height:800}),Animated:{Value:class{interpolate(){return 0;}},View:'AnimatedView',timing:()=>({start:cb=>cb?.({finished:true})})},Easing:{in:x=>x,cubic:1},Keyboard:{dismiss:()=>{}},Platform:{OS:'web'},View:'View',Modal:'Modal',Pressable:'Pressable',ScrollView:'ScrollView',KeyboardAvoidingView:'KeyboardAvoidingView'},'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'lucide-react-native':{},'@/report/ui':{Copy:'Copy',Notice:'Notice',ReportButton:'ReportButton'},'@/report/theme':{useReportTheme:()=>({theme:{}})},'@/hooks/use-onboarding-photo':{useOnboardingPhoto:()=>({pickPhoto:async c=>{calls.push(['pick',c]);return pick();},cameraDialog:null})},'@/services/daily-entries':{getOrCreateDailyEntry:async()=>{calls.push(['entry']);return {data:{id:'entry'}};}},'@/services/photos':{uploadDailyPhoto:async args=>{calls.push(['upload',args.dailyEntryId]);return upload();}},'../../shared/journey.mjs':{localDate:()=> '2026-11-16'}};
 const exports={};vm.runInNewContext(ts.transpileModule(readFileSync('src/components/day-metric-drawer.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Error,require:n=>modules[n]||{}});
 return {calls,render:()=>{cursor=0;return exports.DayMetricDrawer({metric:'Photo',data:{},userId:'user',onClose:()=>calls.push(['closed']),onSaved:()=>calls.push(['saved'])});}};
}
function nodes(t){return !t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(nodes):[t,...nodes(t.props?.children)];}
const click=(h,label)=>nodes(h.render()).find(n=>n.props?.label===label).props.onPress();
const tick=()=>new Promise(r=>setImmediate(r));
test('cancel picker stays in sheet and does not create entry',async()=>{const h=setup(async()=>null);click(h,'Take Photo');await tick();assert.deepEqual(h.calls,[['pick',true]]);});
test('library saves then dismisses to same screen; repeated press locked',async()=>{let resolve;const h=setup(()=>new Promise(r=>resolve=r));click(h,'Choose from Library');click(h,'Choose from Library');resolve('data:image/jpeg;base64,test');await tick();assert.deepEqual(h.calls,[['pick',false],['entry'],['upload','entry'],['saved']]);});
test('permission or upload error remains actionable, close works after failure',async()=>{const h=setup(async()=>{throw Error('Allow camera access');});click(h,'Take Photo');await tick();assert.ok(JSON.stringify(h.render()).includes('Allow camera access'));nodes(h.render()).find(n=>n.props?.accessibilityLabel==='Close metric drawer').props.onPress();assert.deepEqual(h.calls.at(-1),['closed']);});
test('failed upload does not dismiss or mark photo added',async()=>{const h=setup(async()=> 'data:image/jpeg;base64,test',async()=>({error:'offline'}));click(h,'Take Photo');await tick();assert.ok(!h.calls.some(c=>c[0]==='saved'));assert.ok(JSON.stringify(h.render()).includes('could not be saved'));});
