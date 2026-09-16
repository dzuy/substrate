import { concernScore, openaiCost, youcamCost } from './scores.mjs';
const $ = id => document.getElementById(id);
const definitions = [
  { id: 'detail', title: 'Detailed OpenAI', tag: 'A CLOSER LOOK', description: 'Eight visible concerns · high image detail' },
  { id: 'youcam', title: 'YouCam HD', tag: 'SPECIALIST ENGINE', description: 'Skin Analysis v2.1 · four concerns + overlays' },
];
let config, experiment, stream, busy = false, password = '', db;
// Preserve unfinished work when browsing experiments, without silently saving photos to disk.
const sessionExperiments = new Map();
let noticeTimer;
let overlayExperimentId, selectedOverlay = null;
function notice(message) {
  $('notice').textContent = message; $('notice').hidden = false;
  clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 8000);
}
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
async function api(action, data = {}) {
  const response = await fetch('/api/face-scan-prototype', { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(password ? { 'X-Prototype-Password': password } : {}) },
    body: JSON.stringify({ action, ...data }) });
  const result = await response.json();
  if (response.status === 401) $('access').hidden = false;
  if (!response.ok) throw new Error(result.error || 'Server request failed.');
  return result;
}
async function connect() {
  try {
    config = await api('config'); $('access').hidden = true;
    $('setup').textContent = ''; $('setup').hidden = true;
    updateControls();
    return true;
  } catch (error) { config = null; $('setup').textContent = error.message; $('setup').hidden = false; updateControls(); return false; }
}
window.addEventListener('focus', () => { if (!busy) connect(); });
$('access').onsubmit = event => { event.preventDefault(); password = $('password').value; connect(); };
function updateControls() {
  $('new-experiment').disabled = busy;
  $('model-select').disabled = busy; $('include-youcam').disabled = busy;
  $('run').disabled = busy || !experiment?.image || (!config?.openai && !($('include-youcam').checked && config?.youcam));
  $('upload').disabled = busy; $('take-photo').disabled = busy;
  $('save').disabled = busy || !experiment?.runs || !Object.keys(experiment.runs).length;
  $('export').disabled = $('save').disabled;
  $('retry-cleanup').hidden = !experiment?.taskToken || experiment?.cleanup?.deleted === true || busy;
  const retryOverlays = Boolean(experiment?.runs?.youcam?.assetErrors?.length);
  $('resume-youcam').hidden = !experiment?.taskToken || experiment?.cleanup?.deleted || (experiment?.runs?.youcam?.status !== 'pending' && !retryOverlays) || busy;
  $('resume-youcam').textContent = retryOverlays ? 'Retry overlay retrieval (no new analysis)' : 'Resume YouCam result retrieval';
}
function stopCamera() {
  stream?.getTracks().forEach(track => track.stop()); stream = null;
  $('camera').srcObject = null; $('camera').hidden = true;
  $('shutter').hidden = true; $('close-camera').hidden = true;
  $('preview').hidden = !experiment?.image; $('photo-empty').hidden = Boolean(experiment?.image);
}
window.addEventListener('pagehide', stopCamera);
window.addEventListener('beforeunload', event => {
  if (busy || (experiment?.taskToken && !experiment?.cleanup?.deleted) ||
      [...sessionExperiments.values()].some(item => item.taskToken && !item.cleanup?.deleted)) { event.preventDefault(); event.returnValue = ''; }
});
$('take-photo').onclick = async () => {
  try {
    stopCamera();
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
    $('camera').srcObject = stream; $('camera').hidden = false; $('preview').hidden = true; $('photo-empty').hidden = true;
    $('shutter').hidden = false; $('close-camera').hidden = false;
  } catch { notice('Camera unavailable. Allow camera access or upload a photo instead.'); }
};
$('close-camera').onclick = stopCamera;
$('upload').onclick = () => $('file').click();
function retainCurrentExperiment() {
  if (experiment?.image) sessionExperiments.set(experiment.id, snapshot());
}
$('new-experiment').onclick = async () => {
  if (busy) return;
  retainCurrentExperiment();
  experiment = null;
  stopCamera();
  $('preview').removeAttribute('src'); $('overlay-image').removeAttribute('src');
  $('experiment-name').value = ''; $('notes').value = ''; $('file').value = '';
  $('run-status').textContent = 'New experiment · add a photo';
  render(); await listSaved();
  $('upload').focus();
  notice('New experiment ready. Add a photo to begin.');
};
async function prepare(source, width, height) {
  if (Math.min(width, height) < 1080) throw new Error('HD analysis needs at least 1080 px on the short side. Choose a larger photo or a higher-resolution camera.');
  const scale = Math.min(1, 2560 / Math.max(width, height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
  if (Math.min(canvas.width, canvas.height) < 1080) throw new Error('This photo is too narrow for HD analysis. Use a standard portrait or landscape photo.');
  const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  let quality = .94; let image = canvas.toDataURL('image/jpeg', quality);
  while (image.length > 3_730_000 && quality > .6) { quality -= .08; image = canvas.toDataURL('image/jpeg', quality); }
  if (image.length > 3_730_000) throw new Error('This photo is too large. Use a smaller image.');
  retainCurrentExperiment();
  experiment = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), image, width: canvas.width, height: canvas.height,
    preparation: { format: 'jpeg', quality, maxSide: 2560 }, runs: {}, overlays: [], cleanup: null };
  $('experiment-name').value = ''; $('notes').value = '';
  stopCamera(); $('run-status').textContent = 'Ready when you are'; render(); await listSaved();
}
$('file').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP photo.');
    if (file.size > 30_000_000) throw new Error('Choose an image under 30 MB.');
    const image = await createImageBitmap(file);
    try { await prepare(image, image.width, image.height); } finally { image.close(); }
  } catch (error) { notice(error.message); }
  event.target.value = '';
};
$('shutter').onclick = async () => {
  try { await prepare($('camera'), $('camera').videoWidth, $('camera').videoHeight); }
  catch (error) { notice(error.message); }
};
function fmt(value) { return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : '—'; }
function scoreFor(id, concern) {
  const run = experiment?.runs?.[id];
  return concernScore(run, id, concern);
}
function renderCost(card, provider, run) {
  if (provider === 'youcam') {
    card.append(el('p', `$${youcamCost.toFixed(3)} / successful scan · estimated`, 'cost'));
    card.append(el('p', '12 units × $0.048/unit · based on $24 for 500 units', 'small muted'));
    return;
  }
  const cost = openaiCost(run);
  card.append(el('p', cost ? `$${cost.usd.toFixed(6)} / scan · estimated` : 'Cost estimate available after analysis', 'cost'));
  if (cost) {
    card.append(el('p', `${cost.input.toLocaleString()} input (${cost.cached.toLocaleString()} cached) + ${cost.output.toLocaleString()} output tokens`, 'small muted'));
    if (cost.usd > 0) card.append(el('p', `YouCam is ~${Math.round(youcamCost / cost.usd).toLocaleString()}× this scan’s estimated OpenAI cost.`, 'small muted'));
  } else if (run?.status === 'success') {
    card.lastChild.textContent = 'Cost estimate unavailable for this model, service tier, or usage data';
  }
  const rates = el('details'); rates.append(el('summary', 'Pricing assumptions'));
  rates.append(el('p', 'Standard USD / 1M tokens (input / cached / output): Astra $10 / $1 / $50; Sol $4 / $0.40 / $20; Terra $2 / $0.20 / $12; Luna $0.20 / $0.02 / $1.20. Output includes reasoning. Cache-write surcharges are not included; Astra cache writes cost $12.50/M tokens. Sol promotional pricing is listed through at least November 21, 2026. Estimates use reported usage, exclude taxes and account-specific adjustments, and are not invoices. Saved runs use these same rates. Verified September 16, 2026.', 'small muted'));
  const source = el('a', 'OpenAI model pricing'); source.href = 'https://developers.openai.com/api/docs/models/' + (run?.model || $('model-select').value); source.target = '_blank'; source.rel = 'noopener noreferrer'; rates.append(source); card.append(rates);
}
function render() {
  $('preview').hidden = !experiment?.image;
  if (experiment?.image) $('preview').src = experiment.image;
  $('photo-empty').hidden = Boolean(experiment?.image);
  $('image-meta').textContent = experiment?.image ? `${experiment.width} × ${experiment.height} · JPEG` : 'No photo selected';
  const youcamToggle = $('youcam-toggle');
  youcamToggle.remove();
  $('engines').replaceChildren();
  for (const def of definitions) {
    const run = experiment?.runs?.[def.id];
    const card = el('article', undefined, 'engine ' + def.id);
    card.append(el('p', def.tag, 'eyebrow'), el('h2', def.title), el('p', def.description, 'description'));
    if (def.id === 'youcam') card.append(youcamToggle);
    let state = 'Awaiting a photo';
    if (experiment?.image) state = 'Ready to compare';
    if (run) state = { running: 'Analyzing…', pending: 'Awaiting completion · resume available', success: 'Analysis complete', error: 'Analysis unavailable', skipped: 'API key not configured' }[run.status];
    if (run?.disabledByUser) state = 'Not included in this run';
    card.append(el('p', state, 'state' + (run?.status === 'error' ? ' error' : '')));
    if (run?.error) card.append(el('p', run.error, 'small error'));
    renderCost(card, def.id, run);
    if (run?.status === 'success') {
      card.append(el('p', `${(run.durationMs / 1000).toFixed(1)}s · ${run.model}`, 'small muted'));
      if (run.analysis) {
        if (!['four-concern-anchors-v2', 'regional-concerns-v3', 'expanded-regional-concerns-v4'].includes(run.promptVersion)) card.append(el('p', 'Earlier scoring prompt · rerun to use fixed visibility anchors.', 'small muted'));
        card.append(el('p', run.analysis.summary, 'summary'));
        if (!run.analysis.faceDetected) card.append(el('p', 'Face not detected. Scores excluded.', 'error small'));
        if (run.analysis.retakeReasons?.length) card.append(el('p', run.analysis.retakeReasons.join(' · '), 'small'));
        for (const observation of run.analysis.observations || []) card.append(el('p', `${observation.concern} / ${observation.region}: ${observation.observation}`, 'small'));
      }
      const details = el('details'); details.append(el('summary', 'Inspect raw response'), el('pre', JSON.stringify(run.raw, null, 2))); card.append(details);
    }
    $('engines').append(card);
  }
  $('scores').replaceChildren();
  for (const [key, name] of Object.entries(concernLabels)) {
    const row = el('tr'); row.append(el('td', name));
    for (const def of definitions) {
      const value = scoreFor(def.id, key); const cell = el('td', fmt(value));
      if (def.id === 'youcam' && !['redness', 'acne', 'texture', 'pore'].includes(key)) cell.append(el('small', 'Not requested'));
      row.append(cell);
    }
    $('scores').append(row);
  }
  renderOverlays(); renderOpenAIRegions(); renderDetailedAnalysis();
  $('cleanup').textContent = experiment?.cleanup?.message || 'Outputs are retrieved before an automatic YouCam task deletion attempt. Keep this tab open until it finishes.';
  updateControls();
}
let regionExperimentId, selectedConcern = null;
const concernLabels = { redness: 'Redness', acne: 'Acne', texture: 'Texture', pore: 'Pores', pigmentation: 'Pigmentation', flaking: 'Visible flaking', fine_lines: 'Fine lines', residual_marks: 'Residual marks' };
const regionLabels = { forehead: 'Forehead', image_left_cheek: 'Left cheek (image)', image_right_cheek: 'Right cheek (image)', nose: 'Nose', chin: 'Chin', between_brows: 'Between brows' };
function svgElement(tag, attributes = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}
function renderOpenAIRegions() {
  if (regionExperimentId !== experiment?.id) { regionExperimentId = experiment?.id; selectedConcern = null; }
  const analysis = experiment?.runs?.detail?.analysis;
  const available = experiment?.runs?.detail?.status === 'success' && analysis?.faceDetected && Array.isArray(analysis.regions) && analysis.regions.length;
  const list = $('openai-overlay-list'); list.replaceChildren();
  for (const [key, label] of [[null, 'Original'], ...Object.entries(concernLabels)]) {
    const button = el('button', label, 'overlay-option'); button.type = 'button'; button.dataset.concern = key || '';
    button.disabled = !experiment?.image || (key !== null && !available);
    button.onmouseenter = () => showOpenAIRegions(key);
    button.onmouseleave = () => showOpenAIRegions(selectedConcern);
    button.onfocus = () => showOpenAIRegions(key);
    button.onblur = () => showOpenAIRegions(selectedConcern);
    button.onclick = () => { selectedConcern = key; showOpenAIRegions(key); };
    list.append(button);
  }
  if (!available) list.append(el('p', analysis ? 'Run a new analysis to get regional evidence.' : 'Regional evidence appears after analysis.', 'small muted'));
  showOpenAIRegions(selectedConcern);
}
// Quadratic curves stay inside adjacent vertices, avoiding spline overshoot.
function smoothRegionPath(points, width, height) {
  const scaled = points.map(p => ({ x: p.x * width, y: p.y * height }));
  const midpoint = (a, b) => `${(a.x + b.x) / 2},${(a.y + b.y) / 2}`;
  let path = `M ${midpoint(scaled.at(-1), scaled[0])}`;
  scaled.forEach((point, i) => {
    path += ` Q ${point.x},${point.y} ${midpoint(point, scaled[(i + 1) % scaled.length])}`;
  });
  return path + ' Z';
}
const concernMeanings = {
  redness: 'Redness is visible pink or red coloration',
  acne: 'Acne here means active-looking raised or inflamed blemishes',
  texture: 'Texture describes visible unevenness of the skin surface',
  pore: 'Pores measures how noticeable pore openings appear',
  pigmentation: 'Pigmentation describes dark spots or uneven skin coloring',
  flaking: 'Flaking means visible peeling or loose skin flakes, not a hydration measurement',
  fine_lines: 'Fine lines are small visible creases in the skin',
  residual_marks: 'Residual marks are flat-looking discoloration that may remain after blemishes; the cause is unconfirmed',
};
function explainConcern(concern, provider, region) {
  if (!concern || !concernMeanings[concern]) return 'Original photo without concern highlights.';
  let value = scoreFor(provider, concern);
  let location = '';
  if (provider === 'detail') {
    const regions = experiment?.runs?.detail?.analysis?.regions || [];
    const ranked = regions.filter(item => Number.isFinite(item[concern]) && item[concern] > 0 && item[concern] <= 100).sort((a, b) => b[concern] - a[concern]);
    if (ranked.length) location = `; highest regional score: ${regionLabels[ranked[0].name] || ranked[0].name} (${Math.round(ranked[0][concern])}/100)`;
  } else if (region && !['whole', 'all'].includes(region)) {
    const row = experiment?.runs?.youcam?.rows?.find(item => item.type === 'hd_' + concern && item.region === region);
    value = Number.isFinite(row?.raw_score) && row.raw_score >= 1 && row.raw_score <= 100 ? (100 - row.raw_score) * 100 / 99 : null;
    location = ` for ${region}`;
  }
  const result = Number.isFinite(value) ? `your estimated concern score is ${Math.round(value)}/100${location} (higher = more visible)` : 'this photo has no assessable score for it';
  return `${concernMeanings[concern]} — ${result}.`;
}
function showOpenAIRegions(concern) {
  const map = $('openai-map'); map.replaceChildren();
  $('concern-explanation').textContent = explainConcern(concern, 'detail');
  $('openai-map-caption').textContent = concern ? `${concernLabels[concern]} · regional scores / 100` : 'Original photo';
  map.toggleAttribute('hidden', !experiment?.image); $('openai-empty').hidden = Boolean(experiment?.image);
  const scores = $('regional-scores'); scores.replaceChildren();
  for (const button of $('openai-overlay-list').querySelectorAll('button')) {
    button.classList.toggle('previewing', button.dataset.concern === (concern || ''));
    button.setAttribute('aria-pressed', String(button.dataset.concern === (selectedConcern || '')));
  }
  if (!experiment?.image) return;
  const width = experiment.width, height = experiment.height;
  map.setAttribute('viewBox', `0 0 ${width} ${height}`);
  map.append(svgElement('image', { href: experiment.image, width, height }));
  if (!concern) return;
  const analysis = experiment.runs?.detail?.analysis;
  if (!analysis?.faceDetected) return;
  const regions = analysis.regions || [];
  scores.append(el('p', `${concernLabels[concern]} by region · 0–100 visible concern`, 'small muted'));
  const labels = [];
  for (const region of regions) {
    const value = region[concern]; const valid = Number.isFinite(value) && value >= 0 && value <= 100;
    const points = region.polygon;
    const drawable = Array.isArray(points) && points.length >= 3 && points.length <= 12 && points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
    const label = regionLabels[region.name] || region.name;
    const row = el('div', undefined, 'regional-row'); row.append(el('span', label), el('strong', valid ? String(Math.round(value)) : 'Not assessable'));
    row.title = region.evidence || ''; scores.append(row);
    if (valid && drawable) {
      const polygon = svgElement('path', { d: smoothRegionPath(points, width, height), fill: `hsl(25 85% ${96 - value * .65}%)`, 'fill-opacity': .55, stroke: '#ffffff', 'stroke-opacity': .45, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' });
      const title = svgElement('title'); title.textContent = `${label}: ${Math.round(value)} — ${region.evidence}`; polygon.append(title); map.append(polygon);
      const x = points.reduce((sum, p) => sum + p.x, 0) / points.length * width;
      const y = points.reduce((sum, p) => sum + p.y, 0) / points.length * height;
      const badge = svgElement('g');
      badge.append(svgElement('rect', { x: x - width * .036, y: y - width * .023, width: width * .072, height: width * .046, rx: width * .012, fill: '#21352c', 'fill-opacity': .92 }));
      const text = svgElement('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'white', 'font-size': width * .03, 'font-family': 'sans-serif', 'font-weight': 700 });
      text.textContent = Math.round(value); badge.append(text); labels.push(badge);
    }
    if (valid && !drawable) row.append(el('small', 'Outline unavailable'));
  }
  map.append(...labels);
}
function renderDetailedAnalysis() {
  const container = $('detailed-analysis'); container.replaceChildren();
  const analysis = experiment?.runs?.detail?.analysis;
  if (!analysis) { container.append(el('p', 'Run OpenAI analysis to see detailed findings and follow-up questions.', 'small muted')); return; }
  if (!analysis.detailedFindings?.length) { container.append(el('p', 'This result uses the earlier analysis format. Run a new analysis for the additional concerns and detailed findings.', 'small muted')); return; }
  if (analysis.photoLimitations?.length) {
    container.append(el('h3', 'Photo limitations'));
    for (const item of analysis.photoLimitations) container.append(el('p', item, 'small'));
  }
  if (analysis.blemishAssessment) {
    container.append(el('h3', 'Active-looking blemishes and residual marks'));
    for (const [key, label] of [['activeLooking', 'Active-looking'], ['residualLooking', 'Residual-looking'], ['limitations', 'Uncertainty']]) container.append(el('p', `${label}: ${analysis.blemishAssessment[key]}`, 'small'));
  }
  const grid = el('div', undefined, 'findings-grid');
  for (const finding of analysis.detailedFindings) {
    const card = el('article', undefined, 'finding');
    card.append(el('h3', concernLabels[finding.concern] || finding.concern), el('p', finding.assessment.replaceAll('_', ' '), 'small muted'));
    for (const [key, label] of [['evidence', 'Observation'], ['distribution', 'Where'], ['uncertainty', 'Uncertainty'], ['followUpQuestion', 'Ask next']]) {
      if (finding[key]) { const p = el('p', undefined, 'small'); p.append(el('strong', label + ': '), document.createTextNode(finding[key])); card.append(p); }
    }
    grid.append(card);
  }
  container.append(grid);
}
function overlayName(label) {
  const [type, region, index] = label.split(' · ');
  const name = { hd_redness: 'Redness', hd_acne: 'Acne', hd_texture: 'Texture', hd_pore: 'Pores', resize_image: 'Original' }[type] || type.replace(/^hd_/, '').replaceAll('_', ' ');
  return name + (region && !['whole', 'all'].includes(region) ? ' · ' + region : '') + (Number(index) > 1 ? ' · ' + index : '');
}
function renderOverlays() {
  if (overlayExperimentId !== experiment?.id) { overlayExperimentId = experiment?.id; selectedOverlay = null; }
  const overlays = experiment?.overlays || [];
  if (selectedOverlay !== null && !overlays[selectedOverlay]) selectedOverlay = null;
  const list = $('overlay-list'); list.replaceChildren();
  const add = (label, index) => {
    const button = el('button', label, 'overlay-option');
    button.type = 'button'; button.dataset.overlay = index === null ? 'original' : String(index);
    button.disabled = !experiment?.image;
    button.onmouseenter = () => showOverlay(index);
    button.onmouseleave = () => showOverlay(selectedOverlay);
    button.onfocus = () => showOverlay(index);
    button.onblur = () => showOverlay(selectedOverlay);
    button.onclick = () => { selectedOverlay = index; showOverlay(index); };
    list.append(button);
  };
  add('Original', null);
  overlays.forEach((overlay, i) => { if (!overlay.label.startsWith('resize_image')) add(overlayName(overlay.label), i); });
  if (!overlays.length) list.append(el('p', 'Overlays appear after YouCam analysis.', 'small muted'));
  showOverlay(selectedOverlay);
}
function showOverlay(index) {
  const overlays = experiment?.overlays || [];
  const overlay = index === null ? null : overlays[index];
  const [type, region] = (overlay?.label || '').split(' · ');
  $('youcam-explanation').textContent = explainConcern(type.replace(/^hd_/, ''), 'youcam', region);
  const source = overlay?.dataUrl || overlays.find(item => item.label.startsWith('resize_image'))?.dataUrl || experiment?.image;
  $('overlay-image').hidden = !source; $('overlay-empty').hidden = Boolean(source);
  if (source) { $('overlay-image').src = source; $('overlay-image').alt = overlay ? overlayName(overlay.label) + ' overlay' : 'Original photo'; }
  for (const button of $('overlay-list').querySelectorAll('button')) {
    const key = index === null ? 'original' : String(index);
    button.classList.toggle('previewing', button.dataset.overlay === key);
    button.setAttribute('aria-pressed', String(button.dataset.overlay === (selectedOverlay === null ? 'original' : String(selectedOverlay))));
  }
}
async function cleanup() {
  if (!experiment?.taskToken) return;
  try {
    const result = await api('youcam-delete', { token: experiment.taskToken });
    experiment.cleanup = { ...result, message: 'YouCam confirmed deletion of this task and its associated files. This is an API confirmation, not a backup-deletion guarantee.' };
  } catch (error) { experiment.cleanup = { deleted: false, message: 'YouCam deletion not confirmed: ' + error.message + ' Save this experiment to retain the task reference for retry.' }; }
  render();
}
async function collectYouCam() {
  const start = Date.now();
  while (Date.now() - start < 5 * 60_000) {
    let result;
    try { result = await api('youcam-status', { token: experiment.taskToken }); }
    catch (error) { experiment.runs.youcam = { status: 'pending', error: error.message }; render(); return; }
    if (result.status === 'running') { await new Promise(resolve => setTimeout(resolve, 10_000)); continue; }
    experiment.runs.youcam = result;
    if (result.status === 'success') {
      experiment.overlays = [];
      for (const asset of result.assets) {
        try {
          const data = await api('youcam-asset', { token: asset.token });
          experiment.overlays.push({ label: asset.label, dataUrl: data.dataUrl });
        } catch (error) { result.assetErrors = [...(result.assetErrors || []), `${asset.label}: ${error.message}`]; }
      }
      if (result.assetErrors?.length) {
        result.error = `${result.assetErrors.length} overlays could not be retrieved. Raw scores are available.`;
        experiment.cleanup = { deleted: false, message: 'Some overlays could not be retrieved. Retry overlay retrieval without a new paid analysis, or retry deletion to discard the remaining provider files.' };
      } else await cleanup();
    } else await cleanup();
    render(); return;
  }
  experiment.runs.youcam = { status: 'pending', error: 'Still processing after five minutes. Resume retrieval without paying for a new task.' };
  experiment.cleanup = { deleted: false, message: 'Task is still pending. Save this experiment to retain its retrieval and deletion reference.' };
  render();
}
async function runYouCam() {
  try {
    const task = await api('youcam-start', { image: experiment.image });
    experiment.taskToken = task.token; experiment.taskId = task.taskId;
    await collectYouCam();
  } catch (error) { experiment.runs.youcam = { status: 'error', error: error.message }; render(); }
}
$('run').onclick = async () => {
  if (busy) return;
  busy = true; stopCamera();
  updateControls();
  if (!await connect() || (!config.openai && !($('include-youcam').checked && config.youcam))) {
    busy = false; updateControls(); return notice('Provider connections are unavailable. Check the server configuration.');
  }
  // A repeat creates a new experiment; previously saved runs are never overwritten implicitly.
  if (Object.keys(experiment.runs || {}).length) retainCurrentExperiment();
  experiment = { ...experiment, id: crypto.randomUUID(), createdAt: new Date().toISOString(), runs: {}, overlays: [], cleanup: null, taskToken: null, taskId: null };
  const jobs = [];
  for (const mode of ['detail']) {
    experiment.runs[mode] = { status: config.openai ? 'running' : 'skipped' };
    if (config.openai) jobs.push((async () => {
      try { experiment.runs[mode] = { ...await api('openai', { image: experiment.image, mode, model: $('model-select').value }), status: 'success' }; }
      catch (error) { experiment.runs[mode] = { status: 'error', error: error.message }; }
      render();
    })());
  }
  experiment.runs.youcam = { status: $('include-youcam').checked && config.youcam ? 'running' : 'skipped', disabledByUser: !$('include-youcam').checked };
  if ($('include-youcam').checked && config.youcam) jobs.push(runYouCam());
  $('run-status').textContent = 'Comparison in progress'; render();
  await Promise.allSettled(jobs);
  busy = false; $('run-status').textContent = 'Run finished · review each engine'; render(); await listSaved();
};
$('retry-cleanup').onclick = async () => { busy = true; updateControls(); await cleanup(); busy = false; updateControls(); };
$('resume-youcam').onclick = async () => { busy = true; updateControls(); await collectYouCam(); busy = false; updateControls(); };

async function database() {
  if (db) return db;
  db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('substrate-face-scan-lab', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('experiments', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  return db;
}
async function storage(method, value) {
  const databaseValue = await database();
  return new Promise((resolve, reject) => {
    const transaction = databaseValue.transaction('experiments', method === 'getAll' ? 'readonly' : 'readwrite');
    const request = transaction.objectStore('experiments')[method](value);
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
  });
}
function snapshot() {
  return { ...experiment, name: $('experiment-name').value.trim() || 'Untitled experiment', notes: $('notes').value, savedAt: new Date().toISOString(), schemaVersion: 1 };
}
$('save').onclick = async () => {
  try { experiment = snapshot(); await storage('put', experiment); sessionExperiments.delete(experiment.id); await listSaved(); notice('Saved in this browser, including photo and overlays.'); }
  catch { notice('Could not save. Browser storage may be unavailable or full. Export JSON to keep a copy.'); }
};
$('export').onclick = () => {
  const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const link = el('a'); link.href = url; link.download = `face-scan-${experiment.id}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  notice('Export includes the face photo, overlays, and provider responses.');
};
async function listSaved() {
  try {
    const persisted = await storage('getAll');
    const entries = new Map(persisted.map(item => [item.id, item]));
    for (const [id, item] of sessionExperiments) entries.set(id, item);
    const saved = [...entries.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    $('saved-count').textContent = saved.length; $('saved-list').replaceChildren();
    if (!saved.length) $('saved-list').append(el('p', 'No experiments saved yet. Your first comparison is a good place to start.', 'muted small'));
    for (const item of saved) {
      const row = el('article', undefined, 'saved-row'); const image = el('img'); image.src = item.image; image.alt = 'Saved experiment photo';
      const info = el('div', undefined, 'saved-info'); info.append(el('h3', item.name), el('p', new Date(item.createdAt).toLocaleString()));
      if (sessionExperiments.has(item.id)) info.append(el('p', 'Session changes · click Save experiment to keep after closing this page'));
      if (item.taskToken && !item.cleanup?.deleted) info.append(el('p', 'YouCam retrieval or cleanup pending'));
      const open = el('button', 'Open'); open.onclick = async () => {
        if (busy) return notice('Wait for the current request to finish before switching experiments.');
        if (experiment?.id !== item.id) {
          if (experiment?.image) sessionExperiments.set(experiment.id, snapshot());
          stopCamera(); experiment = structuredClone(sessionExperiments.get(item.id) || item);
          $('experiment-name').value = experiment.name; $('notes').value = experiment.notes;
        }
        $('run-status').textContent = 'Saved experiment'; render(); window.scrollTo({ top: 0, behavior: 'smooth' });
        await listSaved();
      };
      const remove = el('button', 'Delete'); remove.onclick = async () => {
        if (!confirm('Delete this saved experiment from this browser? This does not delete files still held by providers.')) return;
        try { await storage('delete', item.id); sessionExperiments.delete(item.id); await listSaved(); } catch { notice('Could not delete the saved experiment.'); }
      };
      row.append(image, info, open, remove); $('saved-list').append(row);
    }
  } catch { $('saved-list').textContent = 'Browser storage is unavailable. You can still run comparisons and export JSON.'; }
}
$('include-youcam').onchange = updateControls;
render(); connect(); listSaved();
