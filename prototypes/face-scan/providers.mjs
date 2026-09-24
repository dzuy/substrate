import { createHash } from 'node:crypto';

export const concerns = ['redness', 'acne', 'texture', 'pore'];
export const openaiConcerns = [...concerns, 'pigmentation', 'flaking', 'fine_lines', 'residual_marks'];
export const scanModels = ['gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna'];
const number = { type: 'number', minimum: 0, maximum: 100 };
const analysisProperties = {
  faceDetected: { type: 'boolean' }, lighting: number, sharpness: number, framing: number,
  redness: { type: ['number', 'null'], minimum: 0, maximum: 100 },
  confidence: number, summary: { type: 'string' },
  retakeReasons: { type: 'array', maxItems: 3, items: { type: 'string' } },
};
const analysisInstructions = [
  'You analyze a user-submitted daily face photo for a skincare wellness prototype.',
  'Return structured JSON only. Scores are 0-100 where higher means stronger presence or better quality, depending on the field.',
  'For lighting, sharpness, and framing, higher is better. For redness, acne, texture, and pore, higher means more visibly present.',
  'Do not diagnose disease, identify medical conditions, identify the person, estimate age, infer sensitive attributes, or make treatment claims.',
  'If the face is not clearly visible, set faceDetected false, keep confidence low, and use retakeReasons.',
  'Use conservative language in summary. Describe visible cosmetic signals only.',
].join('\n');

export function openAIRequest(image, env, model = 'gpt-5.6-sol') {
  if (!scanModels.includes(model)) throw new Error('Unsupported analysis model.');
  const nullableScore = { type: ['number', 'null'], minimum: 0, maximum: 100 };
  const properties = {
    ...Object.fromEntries(openaiConcerns.map(key => [key, nullableScore])),
    ...analysisProperties, acne: { type: ['number', 'null'], minimum: 0, maximum: 100 },
    texture: { type: ['number', 'null'], minimum: 0, maximum: 100 },
    pore: { type: ['number', 'null'], minimum: 0, maximum: 100 },
    regions: { type: 'array', maxItems: 6, items: { type: 'object', additionalProperties: false,
      properties: {
        name: { type: 'string', enum: ['forehead', 'image_left_cheek', 'image_right_cheek', 'nose', 'chin', 'between_brows'] },
        ...Object.fromEntries(openaiConcerns.map(key => [key, nullableScore])),
        evidence: { type: 'string' },
        polygon: { type: 'array', maxItems: 12, items: { type: 'object', additionalProperties: false,
          properties: { x: { type: 'number', minimum: 0, maximum: 1 }, y: { type: 'number', minimum: 0, maximum: 1 } }, required: ['x', 'y'] } },
      }, required: ['name', ...openaiConcerns, 'evidence', 'polygon'] } },
    detailedFindings: { type: 'array', minItems: 8, maxItems: 8, items: { type: 'object', additionalProperties: false,
      properties: {
        concern: { type: 'string', enum: openaiConcerns },
        assessment: { type: 'string', enum: ['visible', 'not_visible', 'uncertain', 'not_assessable'] },
        evidence: { type: 'string' }, distribution: { type: 'string' },
        uncertainty: { type: 'string' }, followUpQuestion: { type: ['string', 'null'] },
      }, required: ['concern', 'assessment', 'evidence', 'distribution', 'uncertainty', 'followUpQuestion'] } },
    blemishAssessment: { type: 'object', additionalProperties: false, properties: {
      activeLooking: { type: 'string' }, residualLooking: { type: 'string' }, limitations: { type: 'string' },
    }, required: ['activeLooking', 'residualLooking', 'limitations'] },
    photoLimitations: { type: 'array', maxItems: 5, items: { type: 'string' } },
    observations: { type: 'array', items: { type: 'object', additionalProperties: false,
      properties: { concern: { type: 'string', enum: openaiConcerns }, region: { type: 'string' }, observation: { type: 'string' } },
      required: ['concern', 'region', 'observation'] } },
  };
  return {
    model, store: false,
    instructions: analysisInstructions + '\nAlso assess pigmentation (visible dark spots or uneven pigmentation), flaking (visible scales or peeling only), fine_lines (visible fine lines; account for expression), and residual_marks (flat-looking discoloration that may remain after blemishes; cause unconfirmed). Pigmentation and residual marks can overlap; do not add them into a combined severity. Acne means active-looking raised or inflamed blemishes, not flat marks. Do not infer hydration, barrier damage, sensitivity, melasma, sun damage, age, or deficiencies from these signals. Use the same higher-is-more-visible scoring direction for every concern. Provide exactly one detailedFindings entry for each of the eight concerns, including those absent or unassessable, with 1-3 specific sentences of evidence, distribution, uncertainty and one useful optional follow-up question. Do not invent questionnaire answers; questionnaire context is evaluated separately after visual analysis. Separate active-looking blemishes from residual-looking marks and explain when a 2D photo cannot distinguish them. Give a 3-5 sentence overall summary prioritizing visible findings and limitations. Include relevant photo limitations. If no face is detected, use not_assessable for all findings and null scores. Do not prescribe ingredients or products from the photo alone.' + '\nAssess whole-face redness, acne (visible blemish activity), texture irregularity, and pore visibility independently. Use fixed 0-100 visibility anchors: 0 absent, 25 mild/localized, 50 moderate, 75 marked/widespread, 100 extreme throughout the visible face; interpolate conservatively. Do not score only the worst patch or confuse pores with acne. Return null for any concern that is not assessable, including when no face is detected. Inspect each facial region and ground concise observations in visible evidence. Do not infer hydration, causes, or ingredient suitability; do not invent exact lesion counts. These are visual estimates, not validated measurements. Return one regions entry per visible region, no duplicates. Score each region independently using the same concern anchors. For each, give a conservative approximate polygon around visible skin in that region, excluding eyes, lips, hair, glasses and background. Coordinates are fractions of the full input image width and height, origin top-left; left/right refer to the image, not the subject. Use 3-12 ordered vertices without crossing edges; return an empty polygon if uncertain or occluded. These polygons describe broad anatomical areas, not detected lesion boundaries. Do not fabricate segmentation masks. If no face is visible return regions: [].',
    input: [{ role: 'user', content: [
      { type: 'input_text', text: 'Analyze this daily skincare check-in image and return JSON only. Evaluate photo quality and visible non-diagnostic cosmetic skin signals.' },
      { type: 'input_image', image_url: image, detail: 'high' },
    ] }],
    reasoning: { effort: 'low' },
    text: { verbosity: 'medium', format: { type: 'json_schema', name: 'substrate_photo_analysis', strict: true,
      schema: { type: 'object', additionalProperties: false, properties, required: Object.keys(properties) } } },
  };
}

export function parseImage(value) {
  const match = typeof value === 'string' && /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new Error('Use a JPEG image prepared by the capture screen.');
  const bytes = Buffer.from(match[1], 'base64');
  if (bytes.length > 2_800_000) throw new Error('Image exceeds the 2.8 MB upload limit.');
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw new Error('Invalid JPEG image.');
  return { bytes, hash: createHash('sha256').update(bytes).digest('hex') };
}

async function jsonRequest(fetcher, url, options = {}) {
  const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(110_000), redirect: 'error' });
  const raw = await response.json();
  if (!response.ok || (typeof raw.status === 'number' && raw.status >= 400)) {
    // Do not reflect provider messages: they may contain request data or credentials.
    const code = typeof raw.error_code === 'string' && /^[\w-]+$/.test(raw.error_code) ? ` (${raw.error_code})` : '';
    throw new Error(`Provider request failed: HTTP ${response.status}${code}. Check account access, model availability, and credits.`);
  }
  return raw;
}

export function createProviders(env, fetcher = fetch) {
  return {
    async openai(image, model = 'gpt-5.6-sol') {
      const { hash } = parseImage(image);
      if (!env.OPENAI_API_KEY) throw new Error('Set OPENAI_API_KEY in the server environment.');
      const request = openAIRequest(image, env, model);
      const started = Date.now();
      const raw = await jsonRequest(fetcher, 'https://api.openai.com/v1/responses', {
        method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(request),
      });
      const output = raw.output_text || raw.output?.flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('');
      if (raw.status === 'incomplete' || !output) throw new Error('OpenAI did not return a complete analysis.');
      const analysis = JSON.parse(output);
      validateAnalysis(analysis);
      return { provider: 'openai', mode: 'detail', model: request.model, detail: 'high',
        promptVersion: 'expanded-regional-concerns-v4',
        imageHash: hash, durationMs: Date.now() - started, analysis, usage: raw.usage, raw };
    },
  };
}

export function validateAnalysis(a) {
  if (!a || typeof a.faceDetected !== 'boolean' || typeof a.summary !== 'string' || !Array.isArray(a.retakeReasons) || a.retakeReasons.some(x => typeof x !== 'string')) throw new Error('Invalid photo analysis.');
  for (const key of ['lighting', 'sharpness', 'framing', 'confidence']) if (!Number.isFinite(a[key]) || a[key] < 0 || a[key] > 100) throw new Error('Invalid quality result.');
  for (const key of openaiConcerns) if (a[key] !== null && (!Number.isFinite(a[key]) || a[key] < 0 || a[key] > 100)) throw new Error('Invalid concern score.');
  if (!Array.isArray(a.detailedFindings) || a.detailedFindings.length !== 8 || new Set(a.detailedFindings.map(f => f.concern)).size !== 8) throw new Error('Incomplete findings.');
  for (const f of a.detailedFindings) if (!openaiConcerns.includes(f.concern) || !['visible','not_visible','uncertain','not_assessable'].includes(f.assessment) || ['evidence','distribution','uncertainty'].some(k => typeof f[k] !== 'string')) throw new Error('Invalid finding.');
  if (!Array.isArray(a.regions) || a.regions.length > 6 || new Set(a.regions.map(r => r.name)).size !== a.regions.length) throw new Error('Invalid regions.');
  for (const r of a.regions) {
    if (!['forehead','image_left_cheek','image_right_cheek','nose','chin','between_brows'].includes(r.name) || typeof r.evidence !== 'string') throw new Error('Invalid region.');
    for (const key of openaiConcerns) if (r[key] !== null && (!Number.isFinite(r[key]) || r[key] < 0 || r[key] > 100)) throw new Error('Invalid regional score.');
    if (!Array.isArray(r.polygon) || r.polygon.length > 12 || r.polygon.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) throw new Error('Invalid region outline.');
  }
}
