import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(initial, options = {}) {
  let cursor = 0; const slots = []; const calls = [];
  const react = { useEffect:()=>{}, useCallback: fn => fn, useState: value => { const i = cursor++; if (!(i in slots)) slots[i] = i === 1 ? initial : value; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; }, useRef: value => { const i = cursor++; return slots[i] ||= {current:value}; } };
  const jsx = (type, props) => ({type, props});
  const modules = {
    '@react-native-async-storage/async-storage':{default:{getItem:async()=>null,setItem:async(key,value)=>{if(options.saveFails)throw Error('offline');calls.push(['draft',JSON.parse(value).note]);}}},
    '../../shared/daily-input-status.mjs':{dailyInputStatus:()=>({})},
    react, 'react/jsx-runtime':{jsx,jsxs:jsx},
    'expo-router':{useRouter:()=>({push:path=>calls.push(['route',path])}),useFocusEffect:()=>{}},
    'react-native':{Platform:{OS:'web'},View:'View',Pressable:'Pressable'},
    '@/components/tate-drawer':{useTate:()=>({openDayEditor:()=>{},planDay:note=>calls.push(['review',note]),dayVersion:0})},
    '@/report/theme':{useReportTheme:()=>({theme:{}})},
    '@/report/ui':Object.fromEntries(['Copy','Notice','Panel','ReportButton','ReportFrame'].map(x=>[x,x])),
    '@/components/daily-note-input':{DailyNoteInput:'DailyNoteInput'},
    '@/components/day-metric-drawer':{DayMetricDrawer:'DayMetricDrawer'},
    'expo-image':{Image:'Image'}, 'lucide-react-native':{},
    '../../shared/daily-draft.mjs':{savedDailyActivities:()=>[],cleanDailyDraft:x=>x},
    '../../shared/journey.mjs':{localDate:()=> '2026-11-16'},
    '@/services/create-day-routine':{createDayRoutine:async(...args)=>{calls.push(['create',...args]);if(options.saveFails)throw Error('Your note could not be saved.');const result=options.generate?await options.generate():{data:{}};if(result.error)throw Error('Please try again');return result.data;}},
  };
  const exports={};
  const source=readFileSync('src/app/your-day.tsx','utf8').replace('function Dashboard(', 'export function Dashboard(');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Error,require:name=>modules[name]||{}});
  const render=()=>{cursor=0;return exports.Dashboard({userId:'user'});};
  return {render,calls};
}
function nodes(tree) { return !tree || typeof tree!=='object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree,...nodes(tree.props?.children)]; }
const day={profile:{},entry:null,photo:null,recommendation:null};
const button=tree=>nodes(tree).find(n=>n.type==='ReportButton'&&/my routine/.test(n.props.label));
const tick=()=>new Promise(r=>setImmediate(r));
test('five optional inputs, no skin card or stock photo, one create action without an entry',async()=>{
 const h=harness(day); const tree=h.render(); const all=nodes(tree);
 assert.equal(all.filter(n=>n.type==='Pressable'&&/^Enter|^Add or take/.test(n.props.accessibilityLabel)).length,5);
 assert.ok(all.some(n=>n.type==='DailyNoteInput'));
 assert.ok(!JSON.stringify(tree).includes('Your Skin Today'));
 assert.ok(!all.some(n=>n.type==='Image'));
 assert.equal(h.calls.length,0);
 assert.equal(button(tree).props.label,'Create my routine'); button(tree).props.onPress(); await tick();
 assert.deepEqual(h.calls,[['create','user','','2026-11-16'],['route','/routine']]);
});
test('existing routine is Update; editing and photo route never generate',()=>{
 const h=harness({...day,photo:{id:'photo'},entry:{id:'entry',entry_date:'2026-11-16'},recommendation:{},stale:true});const tree=h.render();
 assert.equal(button(tree).props.label,'Update my routine');
 nodes(tree).find(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='Enter sleep').props.onPress();
 assert.equal(h.calls.length,0);
 nodes(tree).find(n=>n.type==='Pressable'&&n.props.accessibilityLabel?.startsWith('Photo added')).props.onPress();
 assert.deepEqual(h.calls,[]);
 assert.equal(nodes(h.render()).find(n=>n.type==='DayMetricDrawer').props.metric,'Photo');
 assert.ok(JSON.stringify(tree).includes('Added'));
});
test('repeated taps are locked and failure preserves retry without navigation',async()=>{
 let resolve;const h=harness({...day,entry:{id:'entry',entry_date:'2026-11-16'}},{generate:()=>new Promise(r=>resolve=r)});
 const action=button(h.render()).props.onPress;action();action();
 assert.equal(h.calls.length,1);resolve({error:'failed'});await tick();
 assert.ok(JSON.stringify(h.render()).includes('Please try again'));
 assert.ok(!h.calls.some(x=>x[0]==='route'));
 action();assert.equal(h.calls.length,2);resolve({data:{}});await tick();
 assert.deepEqual(h.calls.at(-1),['route','/routine']);
});

test('single primary action sends exact note directly to routine creation without review',async()=>{
 const h=harness(day);nodes(h.render()).find(n=>n.type==='DailyNoteInput').props.onChange('Gym then dinner');
 const tree=h.render();assert.ok(!nodes(tree).some(n=>n.props?.label==='Continue'));
 button(tree).props.onPress();button(tree).props.onPress();await tick();
 assert.deepEqual(h.calls,[['create','user','Gym then dinner','2026-11-16'],['route','/routine']]);
 assert.equal(nodes(h.render()).find(n=>n.type==='DailyNoteInput').props.value,'');
});
test('draft save failure keeps note and never generates without it',async()=>{
 const h=harness(day,{saveFails:true});nodes(h.render()).find(n=>n.type==='DailyNoteInput').props.onChange('Gym');button(h.render()).props.onPress();await tick();
 assert.deepEqual(h.calls,[['create','user','Gym','2026-11-16']]);assert.equal(nodes(h.render()).find(n=>n.type==='DailyNoteInput').props.value,'Gym');assert.ok(JSON.stringify(h.render()).includes('note could not be saved'));
});
