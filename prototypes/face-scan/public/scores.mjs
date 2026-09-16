// Range alignment only; provider scores are not empirically calibrated to one another.
export function concernScore(run, provider, concern) {
  if (run?.status !== 'success') return null;
  if (provider === 'youcam') {
    const rows = (run.rows || []).filter(row => row.type === 'hd_' + concern || row.type === concern);
    const row = rows.find(row => ['whole', 'all'].includes(row.region)) || rows.find(row => !row.region);
    const raw = row?.raw_score;
    return Number.isFinite(raw) && raw >= 1 && raw <= 100 ? (100 - raw) * 100 / 99 : null;
  }
  const value = run.analysis?.[concern];
  return run.analysis?.faceDetected && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

// Standard USD rates verified 2026-09-16; historical runs are estimates at these rates.
export const youcamCost = 12 * 24 / 500;
export function openaiCost(run) {
  const model = run?.raw?.model || run?.model;
  const tier = /^gpt-6-astra(?:-\d{4}-\d{2}-\d{2})?$/.test(model || '') ? 'astra' : /^gpt-5\.6-(sol|terra|luna)(?:-\d{4}-\d{2}-\d{2})?$/.exec(model || '')?.[1];
  const rates = { astra: [10, 1, 50], sol: [4, .4, 20], terra: [2, .2, 12], luna: [.2, .02, 1.2] }[tier];
  if (!rates) return null;
  if (run?.raw?.service_tier && !['default', 'auto'].includes(run.raw.service_tier)) return null;
  const usage = run?.usage;
  const input = usage?.input_tokens, output = usage?.output_tokens;
  const cached = usage?.input_tokens_details?.cached_tokens ?? 0;
  if (![input, output, cached].every(n => Number.isFinite(n) && n >= 0) || cached > input || input > 272000) return null;
  // Output already includes reasoning tokens; do not add them again.
  return { usd: ((input - cached) * rates[0] + cached * rates[1] + output * rates[2]) / 1e6, input, output, cached };
}
