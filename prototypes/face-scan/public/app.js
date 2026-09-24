import { questions, defaultTestAnswers, shuffledTestAnswers, configureConditions, visibleQuestions, scenarioAnswers } from './questions.mjs';
import { concernScore, openaiCost } from './scores.mjs';
const $ = id => document.getElementById(id);
const definitions = [
  { id: 'detail', title: 'Detailed OpenAI', tag: 'A CLOSER LOOK', description: 'Eight visible concerns · high image detail' },
];
let config, experiment, stream, busy = false, password = '';
let noticeTimer;
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
    const previousVersion = config?.knowledge?.version;
    config = await api('config'); $('access').hidden = true;
    configureConditions(config.conditionOptions || []);
    if(answers.conditions){answers.conditions=answers.conditions.filter(id=>config.conditionOptions.some(c=>c.id===id));if(!answers.conditions.length)delete answers.conditions;}
    renderQuestions();
    if (previousVersion !== config.knowledge?.version) {
      const selector=$('test-scenario'); selector.replaceChildren(el('option','Choose a synthetic scenario…'));
      selector.firstChild.value='';
      for(const condition of config.conditionOptions || []) { const option=el('option',condition.name);option.value=condition.id;selector.append(option); }
      $('knowledge-version').textContent = `${config.knowledge?.version} · ${config.knowledge?.ruleVersion}`;
      $('knowledge-coverage').textContent = JSON.stringify(config.knowledge?.coverage, null, 2);
    }
    $('setup').textContent = ''; $('setup').hidden = true;
    updateControls();
    return true;
  } catch (error) { config = null; $('setup').textContent = error.message; $('setup').hidden = false; updateControls(); return false; }
}
window.addEventListener('focus', () => { if (!busy) connect(); });
$('access').onsubmit = event => { event.preventDefault(); password = $('password').value; connect(); };
function updateControls() {
  $('analysis-progress').hidden = !busy;
  $('run').setAttribute('aria-busy', String(busy));
  $('run').textContent = busy ? 'Analyzing…' : 'Analyze photo ↗';
  $('new-experiment').disabled = busy;
  $('model-select').disabled = busy;
  $('run').disabled = busy || !experiment?.image || experiment?.synthetic || !config?.openai;
  $('load-scenario').disabled = busy;
  $('reevaluate').disabled = busy || !experiment?.runs?.detail?.analysis;
  $('upload').disabled = busy; $('take-photo').disabled = busy;
}
function stopCamera() {
  stream?.getTracks().forEach(track => track.stop()); stream = null;
  $('camera').srcObject = null; $('camera').hidden = true;
  $('shutter').hidden = true; $('close-camera').hidden = true;
  $('preview').hidden = !experiment?.image; $('photo-empty').hidden = Boolean(experiment?.image);
}
window.addEventListener('pagehide', stopCamera);
window.addEventListener('beforeunload', event => {
  if (busy) { event.preventDefault(); event.returnValue = ''; }
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
$('new-experiment').onclick = async () => {
  if (busy) return;

  experiment = null; answers = defaultTestAnswers(); answerRevision++; renderQuestions();
  stopCamera();
  $('preview').removeAttribute('src');
   $('file').value = '';
  $('run-status').textContent = 'New experiment · add a photo';
  render();
  $('upload').focus();
  notice('New experiment ready. Add a photo to begin.');
};
async function prepare(source, width, height) {
  if (Math.min(width, height) < 512) throw new Error('Photo analysis needs at least 512 px on the short side. Choose a larger photo or a higher-resolution camera.');
  const scale = Math.min(1, 2560 / Math.max(width, height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
  if (Math.min(canvas.width, canvas.height) < 512) throw new Error('This photo is too narrow for analysis. Use a standard portrait or landscape photo.');
  const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  let quality = .94; let image = canvas.toDataURL('image/jpeg', quality);
  while (image.length > 3_730_000 && quality > .6) { quality -= .08; image = canvas.toDataURL('image/jpeg', quality); }
  if (image.length > 3_730_000) throw new Error('This photo is too large. Use a smaller image.');

  experiment = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), image, width: canvas.width, height: canvas.height,
    preparation: { format: 'jpeg', quality, maxSide: 2560 }, runs: {}, answers: { ...answers } };

  stopCamera(); $('run-status').textContent = 'Ready when you are'; render();
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
  const cost = openaiCost(run);
  card.append(el('p', cost ? `$${cost.usd.toFixed(6)} / scan · estimated` : 'Cost estimate available after analysis', 'cost'));
  if (cost) {
    card.append(el('p', `${cost.input.toLocaleString()} input (${cost.cached.toLocaleString()} cached) + ${cost.output.toLocaleString()} output tokens`, 'small muted'));
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
  $('image-meta').textContent = experiment?.image ? experiment.synthetic ? 'Synthetic fixture · no photo analysis' : `${experiment.width} × ${experiment.height} · JPEG` : 'No photo selected';
  $('engines').replaceChildren();
  for (const def of definitions) {
    const run = experiment?.runs?.[def.id];
    const card = el('article', undefined, 'engine ' + def.id);
    card.append(el('p', def.tag, 'eyebrow'), el('h2', def.title), el('p', def.description, 'description'));
    let state = 'Awaiting a photo';
    if (experiment?.image) state = 'Ready to analyze';
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
      row.append(cell);
    }
    $('scores').append(row);
  }
  renderOpenAIRegions(); renderIngredients();
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
    button.onclick = () => { selectedConcern = key; showOpenAIRegions(key); renderIngredients(); };
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
    card.append(el('h3', concernLabels[finding.concern] || finding.concern));
    const related = experiment?.ingredients?.cards?.filter(ingredient => ingredient.concerns.includes(finding.concern)) || [];
    if (related.length) {
      const pills = el('div', undefined, 'finding-ingredients');
      pills.setAttribute('role', 'group'); pills.setAttribute('aria-label', 'Related ingredients');
      const statuses = { needs_context: 'Needs context', withheld: 'On hold', clinician_review: 'Clinician review', evidence_review: 'Evidence review', research_only: 'Research only', no_change: 'Already covered' };
      for (const ingredient of related) {
        const status = statuses[ingredient.status];
        const pill = el('span', ingredient.name + (status ? ` · ${status}` : ''), 'product-chip' + (ingredient.status === 'withheld' ? ' on-hold' : ''));
        pills.append(pill);
      }
      card.append(pills);
    }
    card.append(el('p', finding.assessment.replaceAll('_', ' '), 'small muted'));
    for (const [key, label] of [['evidence', 'Observation'], ['distribution', 'Where'], ['uncertainty', 'Uncertainty'], ['followUpQuestion', 'Ask next']]) {
      if (finding[key]) { const p = el('p', undefined, 'small'); p.append(el('strong', label + ': '), document.createTextNode(finding[key])); card.append(p); }
    }
    grid.append(card);
  }
  container.append(grid);
}
$('run').onclick = async () => {
  if (busy || !experiment?.image || experiment?.synthetic) return;
  busy = true; stopCamera(); updateControls();
  if (!await connect() || !config.openai) { busy = false; updateControls(); return notice('OpenAI is not configured on the server.'); }

  experiment = { ...experiment, id: crypto.randomUUID(), createdAt: new Date().toISOString(), runs: { detail: { status: 'running' } }, ingredients: null, answers: structuredClone(answers) };
  const current = experiment;
  $('run-status').textContent = 'Analyzing visible findings…'; render();
  try {
    const result = await api('openai', { image: current.image, mode: 'detail', model: $('model-select').value });
    if (experiment !== current) return;
    current.runs.detail = { ...result, status: 'success' };
    await refreshIngredients();
    $('run-status').textContent = 'Analysis complete';
  } catch (error) { current.runs.detail = { status: 'error', error: error.message }; $('run-status').textContent = 'Analysis unavailable'; }
  finally { busy = false; render();  }
};

let answers = defaultTestAnswers(), answerRevision = 0, resolveSequence = 0, questionTimer;
$('reevaluate').onclick = () => refreshIngredients();
$('load-scenario').onclick = async () => {
  const conditionId=$('test-scenario').value;
  if(!conditionId || busy)return;
   busy=true;updateControls();
  try {
    answers=scenarioAnswers(conditionId); answerRevision++;const requestedRevision=answerRevision;renderQuestions();
    const response=await api('test-scenario',{conditionId,answers});
    const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="720"><rect width="600" height="720" fill="#f1e3e8"/><text x="300" y="335" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#78204e">Synthetic test scenario</text><text x="300" y="375" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#78204e">No photo was analyzed</text></svg>');
    experiment={id:crypto.randomUUID(),createdAt:new Date().toISOString(),image,width:600,height:720,synthetic:true,scenarioId:conditionId,answers:structuredClone(answers),ingredients:response.ingredients,decisionHistory:[response.ingredients],runs:{detail:{status:'success',analysis:response.analysis,model:'Synthetic fixture',promptVersion:'synthetic-v1',durationMs:0}}};
    $('run-status').textContent='Synthetic scenario · no paid scan';
    if(answerRevision!==requestedRevision)await refreshIngredients();
  } catch(error){notice(error.message);}finally{busy=false;render();}
};
for (const [buttonId, bodyId, label] of [['toggle-quiz', 'quiz-body', 'quiz'], ['toggle-signals', 'signals-body', 'concern signals']]) {
  const button = $(buttonId), body = $(bodyId);
  button.onclick = () => {
    body.hidden = !body.hidden;
    button.setAttribute('aria-expanded', String(!body.hidden));
    button.textContent = body.hidden ? '↓' : '↑';
    const action = `${body.hidden ? 'Expand' : 'Collapse'} ${label}`;
    button.setAttribute('aria-label', action);
    button.title = action;
  };
}
$('shuffle-answers').onclick = () => {
  answers = shuffledTestAnswers();
  answerRevision++;
  if (experiment) { experiment.answers = structuredClone(answers); experiment.ingredients = null; }
  clearTimeout(questionTimer);
  renderQuestions(); renderIngredients();
  refreshIngredients();
};
function renderQuestions() {
  const root = $('questions'); root.replaceChildren();
  const displayed=visibleQuestions(answers);
  for (const question of displayed) {
    const field = el('fieldset'); field.append(el('legend', question.title));
    const options = el('div', undefined, 'choice-options');
    for (const option of question.options) {
      const selected = question.multi ? answers[question.id]?.includes(option) : answers[question.id] === option;
      const button = el('button', question.labels?.[option] || option, 'choice'); button.type = 'button'; button.setAttribute('aria-pressed', String(Boolean(selected)));
      button.onclick = () => {
        if (question.multi) {
          let values = [...(answers[question.id] || [])];
          if (values.includes(option)) values = values.filter(v => v !== option);
          else if (['None', 'Unsure'].includes(option)) values = [option];
          else values = [...values.filter(v => !['None','Unsure'].includes(v)), option];
          if (values.length) answers[question.id] = values; else delete answers[question.id];
        } else if (selected) delete answers[question.id]; else answers[question.id] = option;
        answerRevision++;
        if (experiment) { experiment.answers = structuredClone(answers); experiment.ingredients = null; }
        renderQuestions(); renderIngredients();
        // Restore keyboard focus after rebuilding the choice group.
        const index = visibleQuestions(answers).indexOf(question); if(index >= 0) $('questions').children[index].querySelectorAll('button')[question.options.indexOf(option)].focus();
        clearTimeout(questionTimer); questionTimer = setTimeout(refreshIngredients, 180);
      };
      options.append(button);
    }
    field.append(options); root.append(field);
  }
  $('question-progress').textContent = `${displayed.filter(q=>answers[q.id]).length} of ${displayed.length} answered · answers stay in this session`;
}
async function refreshIngredients() {
  const current = experiment, revision = answerRevision, sequence = ++resolveSequence;
  if (!current?.runs?.detail?.analysisToken && !current?.synthetic) return;
  current.ingredients = null; current.ingredientMessage = 'Updating ingredient links…'; renderIngredients();
  try {
    const response = current.synthetic ? await api('test-scenario',{conditionId:current.scenarioId,answers}) : await api('ingredients', { analysisToken: current.runs.detail.analysisToken, answers });
    const result = current.synthetic ? response.ingredients : response;
    if (current !== experiment || revision !== answerRevision || sequence !== resolveSequence) return;
    current.ingredients = result; current.ingredientMessage = ''; current.answerRevision = revision;
    current.decisionHistory ||= []; current.decisionHistory.push(structuredClone(result));
  } catch (error) {
    if (current !== experiment || revision !== answerRevision || sequence !== resolveSequence) return;
    current.ingredientMessage = error.message;
  }
  renderIngredients();
}
function renderProducts() {
  const root = $('product-results'); root.replaceChildren();
  const decision = experiment?.ingredients;
  const result = decision?.productSuggestions;
  if (!result) {
    root.append(el('p', experiment?.ingredientMessage || (decision ? 'Re-evaluate ingredients to see product suggestions.' : 'Analyze a photo to discover products matched to your ingredients.'), 'muted'));
    return;
  }
  if (result.items.length || !result.demoItems?.length) root.append(el('p', result.message, 'small muted'));
  if (result.demoItems?.length) root.append(el('p', 'Demo examples show products containing linked ingredients. Pending evidence or context means these are not personalized recommendations.', 'small muted'));
  const grid = el('div', undefined, 'product-grid'); root.append(grid);
  for (const product of [...result.items, ...(result.demoItems || []).map(p => ({...p, demo: true}))]) {
    const card = el('article', undefined, 'product-card');
    if (product.demo) card.append(el('span', 'Demo example', 'badge'));
    card.append(el('p', product.brand, 'product-brand'), el('h3', product.name), el('p', product.format, 'small muted'));
    const chips = el('div', undefined, 'product-chips');
    for (const match of product.matches) chips.append(el('span', match.label, 'product-chip'));
    card.append(chips, el('p', (product.demo ? 'Related ingredient links: ' : 'Matched for: ') + [...new Set(product.matches.map(m => m.reason))].join(' · '), 'small'));
    const link = el('a', 'View product ↗', 'product-link');
    link.href = product.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
    card.append(link);
    const details = el('details'); details.append(el('summary', 'Match details'));
    details.append(el('p', product.demo ? 'Catalog example only. Ingredient evidence or personal context is unresolved; this is not approval to use the product.' : 'Matches eligible ingredients, not a finished-formula assessment. Check the current label before use.', 'small muted'));
    if (product.note) details.append(el('p', product.note, 'small muted'));
    details.append(el('p', `${result.region} formula · Brand details checked ${result.verifiedAt}`, 'small muted'));
    card.append(details); grid.append(card);
  }
  if (result.items.length || result.demoItems?.length) root.append(el('p', 'A curated selection · Ingredient matches from brand product details.', 'small muted product-footnote'));
}
function renderIngredients() {
  renderDetailedAnalysis();
  renderProducts();
  const root = $('ingredient-results'); root.replaceChildren();
  const result = experiment?.ingredients;
  if (!result) {
    root.append(el('p', experiment?.ingredientMessage || (experiment?.runs?.detail?.status === 'success' ? 'Update a context answer to link ingredients. Older saved analyses may need a new scan.' : 'Analyze a photo to connect visible findings with ingredient options.'), 'muted'));
    return;
  }
  if (!result.cards.length) root.append(el('p', result.message, 'ingredient-intro'));
  const labels = { candidate: 'Option to explore', needs_context: 'More context needed', withheld: 'Hold for now', clinician_review: 'Clinician review', evidence_review: 'Evidence review pending', research_only: 'Research only', no_change: 'Already covered / no change' };
  const chips = el('div', undefined, 'ingredient-chips');
  chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', 'Ingredients');
  if (result.cards.length) root.append(chips);
  const otherChips=el('section',undefined,'other-ingredients');
  const otherGroup=el('div',undefined,'ingredient-chips');
  otherChips.append(el('p','Other linked ingredients · review / context required','small muted'),otherGroup);
  if(result.cards.some(c=>c.status!=='candidate'))root.append(otherChips);
  if(result.cards.length && !result.cards.some(c=>c.status==='candidate'))chips.append(el('p','No eligible options yet. Other linked ingredients are shown below.','small muted'));
  for (const card of result.cards) {
    const chip = el('span', card.name, 'ingredient-chip');
    chip.title = labels[card.status];
    chip.setAttribute('aria-label', `${card.name}: ${labels[card.status]}`);
    (card.status === 'candidate' ? chips : otherGroup).append(chip);
  }
}
renderQuestions(); render(); connect();
