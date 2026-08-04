import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const photoAnalysisSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    faceDetected: { type: 'boolean' },
    lighting: { type: 'number', minimum: 0, maximum: 100 },
    sharpness: { type: 'number', minimum: 0, maximum: 100 },
    framing: { type: 'number', minimum: 0, maximum: 100 },
    redness: { type: 'number', minimum: 0, maximum: 100 },
    dryness: { type: 'number', minimum: 0, maximum: 100 },
    congestion: { type: 'number', minimum: 0, maximum: 100 },
    fatigue: { type: 'number', minimum: 0, maximum: 100 },
    toneUnevenness: { type: 'number', minimum: 0, maximum: 100 },
    confidence: { type: 'number', minimum: 0, maximum: 100 },
    summary: { type: 'string' },
    retakeReasons: {
      type: 'array',
      maxItems: 3,
      items: { type: 'string' },
    },
  },
  required: [
    'faceDetected',
    'lighting',
    'sharpness',
    'framing',
    'redness',
    'dryness',
    'congestion',
    'fatigue',
    'toneUnevenness',
    'confidence',
    'summary',
    'retakeReasons',
  ],
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const openAiKey = Deno.env.get('OPENAI_API_KEY');

  if (!openAiKey) {
    return jsonResponse({ error: 'OPENAI_API_KEY is not configured' }, 500);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization') ?? '';

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !authorization) {
    return jsonResponse({ error: 'Missing Supabase auth context' }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
  const user = await supabase.auth.getUser();

  if (user.error || !user.data.user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const body = await request.json();
  const photoId = typeof body.photoId === 'string' ? body.photoId : null;

  if (!photoId) {
    return jsonResponse({ error: 'photoId is required' }, 400);
  }

  const photo = await supabase
    .from('photos')
    .select('*')
    .eq('id', photoId)
    .eq('user_id', user.data.user.id)
    .single();

  if (photo.error || !photo.data) {
    return jsonResponse({ error: photo.error?.message ?? 'Photo not found' }, 404);
  }

  const downloaded = await supabase.storage.from(photo.data.storage_bucket).download(photo.data.storage_path);

  if (downloaded.error || !downloaded.data) {
    return jsonResponse({ error: downloaded.error?.message ?? 'Unable to download photo' }, 500);
  }

  const imageDataUrl = await blobToDataUrl(downloaded.data, photo.data.content_type ?? 'image/jpeg');
  const model = Deno.env.get('OPENAI_VISION_MODEL') ?? Deno.env.get('OPENAI_MODEL') ?? 'gpt-5.6-luna';

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      instructions: buildInstructions(),
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'Analyze this daily skincare check-in image and return JSON only. Evaluate photo quality and visible non-diagnostic cosmetic skin signals.',
            },
            {
              type: 'input_image',
              image_url: imageDataUrl,
              detail: 'low',
            },
          ],
        },
      ],
      reasoning: { effort: 'low' },
      text: {
        verbosity: 'low',
        format: {
          type: 'json_schema',
          name: 'substrate_photo_analysis',
          strict: true,
          schema: photoAnalysisSchema,
        },
      },
    }),
  });

  const rawResponse = await response.json();

  if (!response.ok) {
    return jsonResponse(
      {
        error: rawResponse?.error?.message ?? 'OpenAI photo analysis failed',
        provider: 'openai',
        model,
        rawResponse,
      },
      502
    );
  }

  const outputText = extractOutputText(rawResponse);

  if (!outputText) {
    return jsonResponse({ error: 'OpenAI returned no photo analysis', provider: 'openai', model, rawResponse }, 502);
  }

  const analysis = JSON.parse(outputText);
  const qualityChecks = {
    provider: 'openai',
    model,
    analyzedAt: new Date().toISOString(),
    ...analysis,
    rawResponse,
  };

  const updated = await adminSupabase
    .from('photos')
    .update({ quality_checks: qualityChecks })
    .eq('id', photo.data.id)
    .eq('user_id', user.data.user.id)
    .select('*')
    .single();

  if (updated.error) {
    return jsonResponse({ error: updated.error.message }, 500);
  }

  return jsonResponse({ qualityChecks, provider: 'openai', model });
});

function buildInstructions() {
  return [
    'You analyze a user-submitted daily face photo for a skincare wellness prototype.',
    'Return structured JSON only. Scores are 0-100 where higher means stronger presence or better quality, depending on the field.',
    'For lighting, sharpness, and framing, higher is better. For redness, dryness, congestion, fatigue, and toneUnevenness, higher means more visibly present.',
    'Do not diagnose disease, identify medical conditions, identify the person, estimate age, infer sensitive attributes, or make treatment claims.',
    'If the face is not clearly visible, set faceDetected false, keep confidence low, and use retakeReasons.',
    'Use conservative language in summary. Describe visible cosmetic signals only.',
  ].join('\n');
}

async function blobToDataUrl(blob: Blob, contentType: string) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return `data:${contentType};base64,${btoa(binary)}`;
}

function extractOutputText(response: unknown) {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const maybeOutputText = (response as { output_text?: unknown }).output_text;

  if (typeof maybeOutputText === 'string') {
    return maybeOutputText;
  }

  const output = (response as { output?: unknown }).output;

  if (!Array.isArray(output)) {
    return null;
  }

  for (const item of output) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const content = (item as { content?: unknown }).content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
        return (part as { text: string }).text;
      }
    }
  }

  return null;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
