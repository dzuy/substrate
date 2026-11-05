import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync(new URL('../src/components/daily-microphone.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function setup(){
 const effects=[],cleanups=[],states=[],calls=[];let resolve,reject,listener;
 const bridge={start:()=>{calls.push('start');return new Promise((a,b)=>{resolve=a;reject=b})},stop:()=>calls.push('stop'),cancel:()=>calls.push('cancel'),addListener:(_,fn)=>{listener=fn;return{remove(){}}}};
 const jsx=(type,props)=>({type,props});const exports={};
 vm.runInNewContext(code,{exports,require:name=>name==='react'?{useCallback:f=>f,useEffect:f=>effects.push(f),useRef:v=>({current:v}),useState:v=>[v,x=>states.push(x)]}:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='react-native'?{Platform:{OS:'ios'},Pressable:'button',View:'view'}:name==='expo-router'?{useFocusEffect:f=>cleanups.push(f())}:name==='../../modules/substrate-speech'?{default:bridge}:name==='@/report/theme'?{useReportTheme:()=>({theme:{}})}:name==='@/report/ui'?{Copy:'text'}:{Mic:'mic',Square:'square'},Error});
 const texts=[];const tree=exports.DailyMicrophone({disabled:false,compact:true,onTranscript:t=>texts.push(t)});effects.forEach(f=>f());
 return{press:tree.props.children[0].props.onPress,calls,texts,states,resolve:v=>resolve(v),reject:e=>reject(e),cleanup:()=>cleanups.forEach(f=>f?.()),event:s=>listener({state:s})};
}
test('native microphone single session, stop, and reviewable transcript',async()=>{const s=setup();const pending=s.press();assert.deepEqual(s.calls,['start']);await s.press();assert.deepEqual(s.calls,['start','stop']);s.resolve({text:' swimming at 4 ',incomplete:false});await pending;assert.deepEqual(s.texts,['swimming at 4']);assert.ok(s.states.includes('Transcript added. Review your text before sending.'));});
test('native permission failure preserves text and allows retry',async()=>{const s=setup();let p=s.press();s.reject(new Error('Permission denied'));await p;assert.deepEqual(s.texts,[]);p=s.press();s.resolve({text:'walk',incomplete:true});await p;assert.deepEqual(s.texts,['walk']);assert.ok(s.states.includes('Partial transcript added. Review and correct it before sending.'));});
test('leaving microphone screen cancels and ignores late transcript',async()=>{const s=setup();const p=s.press();s.cleanup();s.resolve({text:'late result',incomplete:false});await p;assert.deepEqual(s.calls,['start','cancel']);assert.deepEqual(s.texts,[]);});
