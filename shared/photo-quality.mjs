// Keep the acceptance threshold aligned with the ingredient engine's photo gate.
export function photoQualityIssue(analysis) {
  const reasons = [];
  if (!analysis.faceDetected) reasons.push('The scan could not clearly detect a face.');
  for (const [key, message] of Object.entries({
    lighting: 'The scan rated the lighting too low. Try soft, even light.',
    sharpness: 'The scan rated the photo too blurry. Try a sharper photo.',
    framing: 'The scan could not assess enough of the face. Include your full face.',
    confidence: 'The scan was not confident enough to assess this photo. Try analyzing it again; if this repeats, use another photo.',
  })) {
    if (!Number.isFinite(analysis[key]) || analysis[key] < 40) reasons.push(message);
  }
  reasons.push(...(analysis.retakeReasons ?? []).filter(reason => reason.trim()));
  if (!reasons.length && analysis.retakeReasons?.length) reasons.push('The scan requested another photo without a specific reason. Try analyzing it again.');
  return [...new Set(reasons)].join(' ');
}
