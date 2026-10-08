import test from 'node:test';
import assert from 'node:assert/strict';
import { photoQualityIssue } from '../shared/photo-quality.mjs';
const valid = { faceDetected: true, lighting: 80, sharpness: 80, framing: 80, confidence: 80, retakeReasons: [] };
test('accepts usable photos at the existing threshold', () => {
 assert.equal(photoQualityIssue(valid), '');
 assert.equal(photoQualityIssue({...valid, confidence:40}), '');
});
test('low confidence is not misreported as a lighting failure', () => {
 const issue = photoQualityIssue({...valid, confidence:39});
 assert.match(issue, /not confident/);
 assert.doesNotMatch(issue, /lighting/);
});
test('identifies individual failed checks and preserves model reasons', () => {
 for (const [key, expected] of [['lighting',/lighting/],['sharpness',/blurry/],['framing',/full face/]]) {
  assert.match(photoQualityIssue({...valid,[key]:20}), expected);
 }
 assert.match(photoQualityIssue({...valid,faceDetected:false}), /detect a face/);
 assert.match(photoQualityIssue({...valid,retakeReasons:['Face is obscured.']}), /Face is obscured/);
 assert.notEqual(photoQualityIssue({...valid,confidence:NaN}), '');
});
