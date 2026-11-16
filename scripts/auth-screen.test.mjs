import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness(){const slots=[];let cursor=0;const calls=[];const jsx=(type,props)=>({type,props});const modules={
 react:{useState:v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return [slots[i],x=>slots[i]=x];},useRef:v=>{const i=cursor++;return slots[i]||={current:v};}},
 'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':Object.fromEntries(['View','Pressable','TextInput','KeyboardAvoidingView'].map(x=>[x,x])),
 '@/lib/env':{isSupabaseConfigured:true},'@/lib/auth-context':{useAuth:()=>({beginSignIn:()=>calls.push('begin'),cancelSignIn:()=>calls.push('cancel'),completeSignIn:async id=>calls.push(['complete',id])})},
 '@/services/auth':{signInWithEmailPassword:async(email,password)=>{calls.push(['sign-in',email,password]);return {data:{session:{user:{id:'user'}}}};}},
 '@/report/ui':Object.fromEntries(['Copy','Notice','Panel','ReportButton','ReportFrame'].map(x=>[x,x])),
 '@/report/theme':{fontFamily:()=>'',useReportTheme:()=>({theme:{}})},
 };modules['react-native'].Platform={OS:'web'};
 const exports={};vm.runInNewContext(ts.transpileModule(readFileSync('src/components/auth-screen.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Error,require:n=>modules[n]||{}});
 return {calls,render:()=>{cursor=0;return exports.AuthScreen({});}};
}
function nodes(t){return !t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(nodes):[t,...nodes(t.props?.children)];}
const button=(tree,label)=>nodes(tree).find(n=>n.props?.label===label);
test('clean responsive login retains fields/actions without marketing/footer',()=>{
 const h=harness(),tree=h.render(),all=nodes(tree);assert.equal(tree.props.footer,false);assert.equal(tree.props.showStyleGuide,false);
 assert.ok(all.some(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='Email'));assert.ok(all.some(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='Password'&&n.props.secureTextEntry));
 assert.ok(button(tree,'Sign in'));assert.ok(JSON.stringify(tree).includes('Forgot password?'));assert.ok(JSON.stringify(tree).includes('Create an account'));
 assert.doesNotMatch(JSON.stringify(tree),/SCIENCE FOR|Understand your skin|Find your direction|subscription|simulated|Welcome back/);
 assert.ok(all.some(n=>n.props?.style?.maxWidth===440&&n.props.style.width==='100%'));
});
test('invalid login retains actionable error and does not submit',async()=>{const h=harness();await button(h.render(),'Sign in').props.onPress();await new Promise(r=>setImmediate(r));assert.ok(JSON.stringify(h.render()).includes('Enter a valid email'));assert.deepEqual(h.calls,[]);});
test('valid login retains saved-progress routing and clears password',async()=>{const h=harness();nodes(h.render()).find(n=>n.props?.accessibilityLabel==='Email').props.onChangeText('user@example.com');nodes(h.render()).find(n=>n.props?.accessibilityLabel==='Password').props.onChangeText('example-password');button(h.render(),'Sign in').props.onPress();await new Promise(r=>setImmediate(r));assert.deepEqual(h.calls,['begin',['sign-in','user@example.com','example-password'],['complete','user']]);assert.equal(nodes(h.render()).find(n=>n.props?.accessibilityLabel==='Password').props.value,'');});
test('forgot and create account navigation stay available',()=>{const h=harness();const action=nodes(h.render()).find(n=>n.type==='Pressable'&&JSON.stringify(n).includes('Forgot password?'));action.props.onPress();assert.ok(button(h.render(),'Send reset link'));assert.ok(!nodes(h.render()).some(n=>n.props?.accessibilityLabel==='Password'));nodes(h.render()).find(n=>n.type==='Pressable'&&JSON.stringify(n).includes('Back to sign in')).props.onPress();nodes(h.render()).find(n=>n.type==='Pressable'&&JSON.stringify(n).includes('Create an account')).props.onPress();assert.ok(button(h.render(),'Create my account'));});
