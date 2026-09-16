import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const YOUCAM = 'https://yce-api-01.makeupar.com';
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
    instructions: analysisInstructions + '\nAlso assess pigmentation (visible dark spots or uneven pigmentation), flaking (visible scales or peeling only), fine_lines (visible fine lines; account for expression), and residual_marks (flat-looking discoloration that may remain after blemishes; cause unconfirmed). Pigmentation and residual marks can overlap; do not add them into a combined severity. Acne means active-looking raised or inflamed blemishes, not flat marks. Do not infer hydration, barrier damage, sensitivity, melasma, sun damage, age, or deficiencies from these signals. Use the same higher-is-more-visible scoring direction for every concern. Provide exactly one detailedFindings entry for each of the eight concerns, including those absent or unassessable, with 1-3 specific sentences of evidence, distribution, uncertainty and one useful optional follow-up question. Do not invent questionnaire answers; questionnaire context is not supplied in this prototype. Separate active-looking blemishes from residual-looking marks and explain when a 2D photo cannot distinguish them. Give a 3-5 sentence overall summary prioritizing visible findings and limitations. Include relevant photo limitations. If no face is detected, use not_assessable for all findings and null scores. Do not prescribe ingredients or products from the photo alone.' + '\nAssess whole-face redness, acne (visible blemish activity), texture irregularity, and pore visibility independently. Use fixed 0-100 visibility anchors: 0 absent, 25 mild/localized, 50 moderate, 75 marked/widespread, 100 extreme throughout the visible face; interpolate conservatively. Do not score only the worst patch or confuse pores with acne. Return null for any concern that is not assessable, including when no face is detected. Inspect each facial region and ground concise observations in visible evidence. Do not infer hydration, causes, or ingredient suitability; do not invent exact lesion counts. These are visual estimates, not validated measurements. Return one regions entry per visible region, no duplicates. Score each region independently using the same concern anchors. For each, give a conservative approximate polygon around visible skin in that region, excluding eyes, lips, hair, glasses and background. Coordinates are fractions of the full input image width and height, origin top-left; left/right refer to the image, not the subject. Use 3-12 ordered vertices without crossing edges; return an empty polygon if uncertain or occluded. These polygons describe broad anatomical areas, not detected lesion boundaries. Do not fabricate segmentation masks. If no face is visible return regions: [].',
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

export function sign(value, secret) {
  const payload = Buffer.from(JSON.stringify({ ...value, expires: Date.now() + 30 * 86400_000 })).toString('base64url');
  return payload + '.' + createHmac('sha256', secret).update(payload).digest('base64url');
}

export function verify(token, secret, kind) {
  if (typeof token !== 'string' || token.length > 16000) throw new Error('Invalid task reference.');
  const [payload, signature, extra] = token.split('.');
  const expected = createHmac('sha256', secret).update(payload || '').digest();
  const actual = Buffer.from(signature || '', 'base64url');
  if (extra || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Invalid task reference.');
  const value = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (value.expires < Date.now() || value.kind !== kind) throw new Error('Expired or invalid task reference.');
  return value;
}

// Only provider-issued, signed URLs are accepted by the asset endpoint. No arbitrary URL proxy.
export function providerURL(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !['amazonaws.com', 'cloudfront.net', 'makeupar.com', 'perfectcorp.com'].some(host => url.hostname.endsWith('.' + host))) {
    throw new Error('Unexpected YouCam file host.');
  }
  return url.toString();
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
  const secret = env.FACE_SCAN_SIGNING_SECRET || env.YOUCAM_API_KEY;
  const yc = (path, body) => {
    if (!env.YOUCAM_API_KEY) throw new Error('Set YOUCAM_API_KEY in the server environment.');
    return jsonRequest(fetcher, YOUCAM + path, { method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${env.YOUCAM_API_KEY}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}) });
  };
  const taskRef = token => {
    if (!secret) throw new Error('YouCam is not configured.');
    return verify(token, secret, 'task');
  };
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
      return { provider: 'openai', mode: 'detail', model: request.model, detail: 'high',
        promptVersion: 'expanded-regional-concerns-v4',
        imageHash: hash, durationMs: Date.now() - started, analysis, usage: raw.usage, raw };
    },
    async start(image) {
      const { bytes, hash } = parseImage(image);
      const upload = await yc('/s2s/v2.0/file', { files: [{ content_type: 'image/jpeg', file_name: 'face-scan.jpg', file_size: bytes.length }] });
      const file = upload.data?.files?.[0];
      if (!file?.file_id || !file.requests?.length) throw new Error('YouCam returned an unexpected upload response.');
      for (const request of file.requests) {
        const response = await fetcher(providerURL(request.url), { method: request.method, headers: request.headers, body: bytes,
          signal: AbortSignal.timeout(45_000), redirect: 'error' });
        if (!response.ok) throw new Error('YouCam image upload failed; no analysis task was started.');
      }
      let raw;
      try {
        raw = await yc('/s2s/v2.1/task/skin-analysis', { src_file_id: file.file_id,
          dst_actions: concerns.map(c => 'hd_' + c), format: 'json', pf_camera_kit: false,
          miniserver_args: { enable_mask_overlay: true } });
      } catch {
        throw new Error('YouCam task creation failed after upload. The uploaded image may remain under YouCam’s retention policy; check credits and API access.');
      }
      if (!raw.data?.task_id) throw new Error('YouCam did not return a task ID. The upload may remain under its retention policy.');
      return { token: sign({ kind: 'task', taskId: raw.data.task_id, imageHash: hash, started: Date.now() }, secret), taskId: raw.data.task_id };
    },
    async status(token) {
      const task = taskRef(token);
      const raw = await yc('/s2s/v2.1/task/skin-analysis/' + encodeURIComponent(task.taskId));
      const status = raw.data?.task_status;
      if (status === 'running') return { status };
      if (status === 'error') return { status, error: raw.data?.error || 'YouCam analysis failed.', taskId: task.taskId };
      if (status !== 'success' || !Array.isArray(raw.data?.results?.output)) throw new Error('Unexpected YouCam response; retain the task reference to retry or delete.');
      const rows = raw.data.results.output;
      const assets = rows.flatMap(row => (row.mask_urls || []).map((url, index) => ({
        label: `${row.type} · ${row.region || 'whole'} · ${index + 1}`,
        token: sign({ kind: 'asset', url: providerURL(url) }, secret),
      })));
      return { status, provider: 'youcam', model: 'Skin Analysis v2.1 HD', imageHash: task.imageHash,
        durationMs: Date.now() - task.started, units: 12, taskId: task.taskId, rows, assets, raw };
    },
    async asset(token) {
      if (!secret) throw new Error('YouCam is not configured.');
      const asset = verify(token, secret, 'asset');
      const response = await fetcher(providerURL(asset.url), { signal: AbortSignal.timeout(30_000), redirect: 'error' });
      if (!response.ok) throw new Error('Could not retrieve a YouCam overlay.');
      const reader = response.body.getReader();
      const chunks = []; let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 3_000_000) throw new Error('Overlay exceeds the download limit.');
          chunks.push(value);
        }
      } finally { await reader.cancel(); }
      const bytes = Buffer.concat(chunks);
      // YouCam's S3 outputs can use binary/octet-stream even for valid JPEGs.
      // Validate the actual bytes; never trust the extension or generic MIME header.
      const type = bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? 'image/jpeg'
        : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
        : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : null;
      if (!type) throw new Error('Unexpected overlay format: response is not a supported image.');
      return { dataUrl: `data:${type};base64,${bytes.toString('base64')}` };
    },
    async remove(token) {
      const task = taskRef(token);
      await yc('/s2s/v2.0/task/delete', { task_id: task.taskId });
      return { deleted: true, taskId: task.taskId, deletedAt: new Date().toISOString() };
    },
  };
}
