import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function setup(prepare){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync('src/services/routine-events.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:()=>({prepareDayWithTate:prepare}),AbortController,setTimeout,clearTimeout});return exports.extractRoutineEvents;}
test('existing secure model extraction consumed without save or review',async()=>{let called;const run=setup(async(...args)=>{called=args;return {activities:['Breakfast','Pickleball','Dinner']};});const r=await run('Breakfast then pickleball then dinner');assert.equal(r.source,'model');assert.equal(r.activities.length,3);assert.equal(called[1],false);assert.ok(called[2] instanceof AbortSignal);});
test('model failure returns conservative fallback without inventing activities',async()=>{const r=await setup(async()=>{throw Error('offline');})('Dinner');assert.equal(r.source,'fallback');assert.equal(r.activities.length,0);});
