import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const theme={paper:'#FFFAF2',ink:'#031723',line:'#DDD',scale:1};
function ui(){
 const contexts=[];const jsx=(type,props)=>({type,props});
 const modules={react:{createContext:value=>{const c={value,Provider:'Provider'};contexts.push(c);return c;},useContext:c=>c.value},'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{Pressable:'Pressable',View:'View',Text:'Text',ActivityIndicator:'ActivityIndicator',Platform:{OS:'web'}},'./theme':{useReportTheme:()=>({theme}),fontFamily:()=>''},'lucide-react-native':{ArrowRight:'ArrowRight'}};
 const exports={};vm.runInNewContext(ts.transpileModule(readFileSync('src/report/ui.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>modules[n]||{}});
 return {exports,contexts};
}
function nodes(t){return !t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(nodes):[t,...nodes(t.props?.children)];}
test('light surface resets inherited dark labels; regular dark buttons remain light',()=>{
 const {exports:u,contexts}=ui();contexts[0].value=true;
 assert.equal(nodes(u.ReportButton({label:'Cancel',secondary:true,onPress(){}})).find(n=>n.type===u.Copy).props.style.color,theme.paper);
 const surface=u.ReportSurface({children:null});assert.equal(surface.props.value,false);contexts[0].value=surface.props.value;
 for(const label of ['Cancel','Retake','Try camera again','Choose from Library']) for(const state of [{},{disabled:true},{busy:true}]){
  const button=u.ReportButton({label,secondary:true,onPress(){},...state});
  assert.equal(nodes(button).find(n=>n.type===u.Copy).props.style.color,theme.ink);
  if(state.busy) assert.equal(nodes(button).find(n=>n.type==='ActivityIndicator').props.color,theme.ink);
 }
 assert.equal(u.Copy({children:'Take a photo',kind:'heading'}).props.style.color,theme.ink);
 for(const state of [{},{disabled:true},{busy:true}]){
  const button=u.ReportButton({label:'Capture photo',onPress(){},...state});
  assert.equal(nodes(button).find(n=>n.type===u.Copy).props.style.color,theme.paper);
  if(!state.busy) assert.equal(nodes(button).find(n=>n.type==='ArrowRight').props.color,theme.paper);
 }
});
test('both light camera modal and light metric sheet establish their own surface',()=>{
 for(const path of ['src/hooks/use-onboarding-photo.web.tsx','src/components/day-metric-drawer.tsx']){
  const source=readFileSync(path,'utf8');assert.match(source,/<ReportSurface>/);assert.match(source,/<\/ReportSurface>/);
 }
});
