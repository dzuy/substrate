import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { signInDestination } from '../shared/sign-in-destination.mjs';

const progress = stage => ({ available: true, state: { stage }, conflict: null });
test('completed goes daily; incomplete and conflicts retain onboarding', () => {
  assert.equal(signInDestination(progress('complete')), '/your-day');
  for (const stage of ['welcome','profile','photos','wardrobe','subscription','summary','wellness']) assert.equal(signInDestination(progress(stage)), '/onboarding');
  assert.equal(signInDestination({ ...progress('complete'), conflict: { revision: 4 } }), '/onboarding');
});
test('unavailable progress cannot be mistaken for new or completed onboarding', () => {
  assert.throws(() => signInDestination({ ...progress('complete'), available: false }));
  assert.throws(() => signInDestination(null));
});
function harness(loadJourney) {
  const slots = []; let cursor = 0;
  const react = {
    createContext: () => ({ Provider: 'Provider' }), useContext: () => null, useEffect: () => {}, useMemo: fn => fn(), useCallback: fn => fn,
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef: initial => { const i = cursor++; return slots[i] ||= { current: initial }; },
  };
  const exports = {};
  const modules = { react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) }, '@/lib/supabase': { supabase: {} }, '@/services/journey': { loadJourney }, '../../shared/sign-in-destination.mjs': { signInDestination } };
  vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/auth-context.tsx','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: name => modules[name] });
  return () => { cursor = 0; return exports.AuthProvider({ children: null }).props.value; };
}
test('fresh sign-in holds navigation while reading, then routes once', async () => {
  let resolve; const render = harness(() => new Promise(r => { resolve = r; }));
  render().beginSignIn(); assert.equal(render().signInRouting, true);
  const run = render().completeSignIn('user');
  assert.equal(render().signInRoute, null);
  resolve(progress('complete')); await run;
  assert.equal(render().signInRouting, false); assert.equal(render().signInRoute, '/your-day');
  render().clearSignInRedirect(); assert.equal(render().signInRoute, null);
});
test('failed progress read offers retry and successful retry resumes', async () => {
  let fail = true; const render = harness(async () => { if(fail) throw Error('offline'); return progress('profile'); });
  await render().completeSignIn('user'); assert.match(render().signInRouteError, /Retry/); assert.equal(render().signInRoute, null);
  fail = false; await render().completeSignIn('user'); assert.equal(render().signInRouteError, ''); assert.equal(render().signInRoute, '/onboarding');
});
test('sign-out/cancel ignores late progress response', async () => {
  let resolve; const render = harness(() => new Promise(r => { resolve = r; }));
  const run = render().completeSignIn('user'); render().cancelSignIn(); resolve(progress('complete')); await run;
  assert.equal(render().signInRoute, null); assert.equal(render().signInRouting, false);
});
