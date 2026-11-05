import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const productDetectionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    detections: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          detectedBrand: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          detectedProductName: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          matchedProductId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          status: { type: 'string', enum: ['needs_confirmation', 'unknown'] },
          rationale: { type: 'string' },
        },
        required: ['detectedBrand', 'detectedProductName', 'matchedProductId', 'confidence', 'status', 'rationale'],
      },
    },
  },
  required: ['detections'],
};

type CatalogProduct = {
  id: string;
  brand?: string | null;
  name: string;
  category?: string | null;
  aliases?: string[];
};

type OpenAiDetection = {
  detectedBrand: string | null;
  detectedProductName: string | null;
  matchedProductId: string | null;
  confidence: number;
  status: 'needs_confirmation' | 'unknown';
  rationale: string;
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
  const supabaseAnonKey = request.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = request.headers.get('Authorization') ?? '';

  if (!supabaseUrl || !supabaseAnonKey || !authorization) {
    return jsonResponse({ error: 'Missing Supabase auth context' }, 401);
  }

  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return jsonResponse({ error: 'Unauthorized' }, 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const user = await supabase.auth.getUser(token);

  if (user.error || !user.data.user) {
    console.warn('Product scan authentication failed', user.error?.code, user.error?.message);
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let body;
  try {
    const text = await request.text();
    if (text.length > 12_000_000) return jsonResponse({ error: 'Image is too large. Choose a smaller photo.' }, 413);
    body = JSON.parse(text);
  } catch {
    return jsonResponse({ error: 'Invalid JSON request' }, 400);
  }
  if (!body || typeof body !== 'object') return jsonResponse({ error: 'Invalid request' }, 400);
  const imageDataUrl = typeof body.imageDataUrl === 'string' ? body.imageDataUrl : null;
  const catalogProducts = Array.isArray(body.catalogProducts)
    ? (body.catalogProducts as CatalogProduct[]).slice(0, 80)
    : [];

  if (!imageDataUrl || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(imageDataUrl)) {
    return jsonResponse({ error: 'imageDataUrl is required' }, 400);
  }

  const model = Deno.env.get('OPENAI_VISION_MODEL') ?? Deno.env.get('OPENAI_MODEL') ?? 'gpt-5.6-luna';

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      signal: AbortSignal.timeout(45_000),
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        store: false,
        instructions: buildInstructions(),
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: JSON.stringify({
                  task: 'Identify visible skincare products in this image and match them to the provided canonical catalog when confident.',
                  catalogProducts,
                }),
              },
              {
                type: 'input_image',
                image_url: imageDataUrl,
                detail: 'high',
              },
            ],
          },
        ],
        reasoning: { effort: 'low' },
        text: {
          verbosity: 'low',
          format: {
            type: 'json_schema',
            name: 'substrate_product_detections',
            strict: true,
            schema: productDetectionSchema,
          },
        },
      }),
    });

    const rawResponse = await response.json();

    if (!response.ok) {
      return jsonResponse(
        {
          error: 'Product analysis is unavailable. Please try again.',
          provider: 'openai',
          model,
        },
        502
      );
    }

    const outputText = extractOutputText(rawResponse);

    if (!outputText) {
      return jsonResponse({ error: 'No readable product detections returned. Try another photo.', provider: 'openai', model }, 502);
    }

    const parsed = JSON.parse(outputText) as { detections: OpenAiDetection[] };
    if (!Array.isArray(parsed.detections) || parsed.detections.length > 8 || parsed.detections.some(detection =>
      !detection ||
      (detection.detectedBrand !== null && typeof detection.detectedBrand !== 'string') ||
      (detection.detectedProductName !== null && typeof detection.detectedProductName !== 'string') ||
      typeof detection.confidence !== 'number' || typeof detection.rationale !== 'string'
    )) throw new Error('Invalid detection response');
    const catalogIds = new Set(catalogProducts.map((product) => product.id));
    const detections = parsed.detections.map((detection) => {
      const matchedProductId =
        detection.matchedProductId && catalogIds.has(detection.matchedProductId) ? detection.matchedProductId : null;

      return {
        detectedBrand: detection.detectedBrand,
        detectedProductName: detection.detectedProductName,
        matchedProductId,
        confidence: clampConfidence(detection.confidence),
        status: matchedProductId ? 'needs_confirmation' : 'unknown',
        rawResponse: {
          provider: 'openai',
          model,
          rationale: detection.rationale,
        },
      };
    });

    return jsonResponse({
      detections,
      provider: 'openai',
      model,
    });
  } catch {
    return jsonResponse({ error: 'Product analysis could not finish. Please try again or enter the product manually.' }, 502);
  }
});

function buildInstructions() {
  return [
    'You identify skincare, sunscreen, cosmetic, and aesthetic-care product packaging from a user-submitted image.',
    'Transcribe visible brand and product-name text exactly. Do not expand, paraphrase, normalize, or invent words (for example, do not change Cell to Cellular).',
    'Use visible label text and brand marks. Multiple products may be visible. If the name is not readable, return null rather than infer it from package shape or descriptive marketing copy.',
    'Match to the supplied canonical catalog only when the brand/product clearly corresponds to a catalog item or alias.',
    'Never create new catalog records. Unknown products should have matchedProductId null and status unknown.',
    'Confidence is 0 to 1 and should reflect visual/OCR certainty, not product quality.',
    'If text is unclear, be conservative. A possible product should still require user confirmation.',
    'Do not make medical, efficacy, safety, or ingredient claims. Return JSON matching the schema only.',
  ].join('\n');
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
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
