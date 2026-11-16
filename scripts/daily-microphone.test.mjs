import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(os, result) {
  const states = [], transcripts = [];
  let cursor = 0, recognition;
  const jsx = (type, props) => ({ type, props });
  const native = { start: async () => { if (result instanceof Error) throw result; return result; }, stop() {}, cancel() {}, addListener: () => ({ remove() {} }) };
  class Recognition { constructor() { recognition = this; } start() {} stop() {} abort() {} }
  const modules = {
    react: { useState: initial => { const i = cursor++; states[i] = initial; return [initial, value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; }, useRef: current => ({ current }), useCallback: fn => fn, useEffect: () => {} },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Platform: { OS: os }, Pressable: 'Pressable', View: 'View' },
    'expo-router': { useFocusEffect: () => {} },
    'lucide-react-native': { Mic: 'Mic', Square: 'Square' },
    '../../modules/substrate-speech': { default: native },
    '@/report/ui': { Copy: 'Copy' },
    '@/report/theme': { useReportTheme: () => ({ theme: {} }) },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('src/components/daily-microphone.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => modules[name], window: { SpeechRecognition: Recognition }, navigator: { language: 'en-US' }, Error });
  const tree = exports.DailyMicrophone({ disabled: false, compact: true, onTranscript: text => transcripts.push(text) });
  return { states, transcripts, toggle: tree.props.children.props.onPress, get recognition() { return recognition; } };
}

test('native success appends editable text without a success banner', async () => {
  const h = harness('ios', { text: '  My day  ', incomplete: false });
  await h.toggle();
  assert.deepEqual(h.transcripts, ['My day']);
  assert.equal(h.states[3], '');
  assert.equal(h.states[1], false);
});
test('native partial transcript warning and errors remain', async () => {
  const partial = harness('ios', { text: 'Partial day', incomplete: true });
  await partial.toggle();
  assert.deepEqual(partial.transcripts, ['Partial day']);
  assert.match(partial.states[3], /Partial transcript/);
  const denied = harness('ios', new Error('Microphone permission denied'));
  await denied.toggle();
  assert.match(denied.states[2], /permission denied/);
  assert.equal(denied.states[3], '');
});
test('web success stays quiet even after recognition ends', async () => {
  const h = harness('web');
  await h.toggle();
  h.recognition.onresult({ results: [{ isFinal: true, 0: { transcript: 'My day' } }] });
  h.recognition.onend();
  assert.deepEqual(h.transcripts, ['My day']);
  assert.equal(h.states[3], '');
});
test('web no-transcript and permission failures remain actionable', async () => {
  const empty = harness('web'); await empty.toggle(); empty.recognition.onend();
  assert.match(empty.states[3], /No transcript/);
  const denied = harness('web'); await denied.toggle(); denied.recognition.onerror({ error: 'not-allowed' });
  assert.match(denied.states[2], /denied/);
});

test('compact mic renders no absolute status/error overlay; input places feedback below',()=>{
 const mic=readFileSync('src/components/daily-microphone.tsx','utf8');
 const compact=mic.slice(mic.indexOf(' if(compact)return'),mic.indexOf('\n return <View'));
 assert.doesNotMatch(compact,/absolute|zIndex|\{status\}|\{error\}/);
 const input=readFileSync('src/components/daily-note-input.tsx','utf8');
 assert.match(input,/onFeedback=\{setFeedback\}/);
 assert.match(input,/<\/View>\{feedback \?/);
 assert.doesNotMatch(input,/position:.*absolute/);
});
