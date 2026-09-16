import test from 'node:test';
import assert from 'node:assert/strict';
import { concernScore } from './public/scores.mjs';
const score = rows => concernScore({ status: 'success', rows }, 'youcam', 'pore');
test('aligns YouCam endpoints and midpoint to increasing concern without using UI scores', () => {
  assert.equal(score([{type: 'hd_pore', raw_score: 100, ui_score: 90}]), 0);
  assert.equal(score([{type: 'hd_pore', raw_score: 1}]), 100);
  assert.equal(score([{type: 'hd_pore', raw_score: 50.5}]), 50);
});
test('does not substitute regional, missing, or invalid scores for whole-face scores', () => {
  assert.equal(score([{type: 'hd_pore', region: 'nose', raw_score: 1}]), null);
  assert.equal(score([{type: 'hd_pore', region: 'nose', raw_score: 1}, {type: 'hd_pore', region: 'whole', raw_score: 100}]), 0);
  for (const raw_score of [null, undefined, 0, 101, NaN, '72']) assert.equal(score([{type: 'hd_pore', raw_score}]), null);
});
test('OpenAI missing or unassessable concerns remain unavailable, including face detection failure', () => {
  const run = analysis => concernScore({status: 'success', analysis}, 'detail', 'redness');
  assert.equal(run({faceDetected: true, redness: 0}), 0);
  assert.equal(run({faceDetected: true, redness: 75}), 75);
  assert.equal(run({faceDetected: false, redness: 75}), null);
  assert.equal(run({faceDetected: true, redness: null}), null);
  assert.equal(run({faceDetected: true, redness: 101}), null);
});

import { openaiCost, youcamCost } from './public/scores.mjs';
test('estimates costs using uncached, cached, and output tokens without double counting reasoning', () => {
  const cost = openaiCost({model:'gpt-5.6-luna', usage:{input_tokens:2000,input_tokens_details:{cached_tokens:1000},output_tokens:500,output_tokens_details:{reasoning_tokens:200}}});
  assert.equal(cost.usd, .00082);
  assert.equal(youcamCost, .576);
  assert.equal(openaiCost({model:'unknown',usage:{input_tokens:1,output_tokens:1}}),null);
  assert.equal(openaiCost({model:'gpt-5.6-luna',usage:{total_tokens:1000}}),null);
  assert.equal(openaiCost({model:'gpt-5.6-luna',usage:{input_tokens:1,output_tokens:1,input_tokens_details:{cached_tokens:2}}}),null);
});
test('prices selected Sol and Terra models at their own rates', () => {
  const usage = {input_tokens:2000,input_tokens_details:{cached_tokens:1000},output_tokens:500};
  assert.equal(openaiCost({model:'gpt-5.6-sol',usage}).usd,.0144);
  assert.equal(openaiCost({model:'gpt-5.6-terra',usage}).usd,.0082);
});

test('estimates Astra input, cached input and output at Astra rates', () => {
  assert.equal(openaiCost({model:'gpt-6-astra',usage:{input_tokens:2000,input_tokens_details:{cached_tokens:1000},output_tokens:500}}).usd,.036);
});
