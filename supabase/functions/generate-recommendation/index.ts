import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type GeneratedRecommendation = {
  skinStory: {
    headline: string;
    summary: string;
    contributors: Array<{ label: string; detail: string }>;
    priority: string;
  };
  dailyPlan: {
    priorities: Array<{ title: string; detail: string; actions: string[] }>;
    avoid: string[];
  };
  safetyNotes: string[];
};

const recommendationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    skinStory: {
      type: 'object',
      additionalProperties: false,
      properties: {
        headline: { type: 'string' },
        summary: { type: 'string' },
        contributors: {
          type: 'array',
          minItems: 1,
          maxItems: 4,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              label: { type: 'string' },
              detail: { type: 'string' },
            },
            required: ['label', 'detail'],
          },
        },
        priority: { type: 'string' },
      },
      required: ['headline', 'summary', 'contributors', 'priority'],
    },
    dailyPlan: {
      type: 'object',
      additionalProperties: false,
      properties: {
        priorities: {
          type: 'array',
          minItems: 2,
          maxItems: 3,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              detail: { type: 'string' },
              actions: {
                type: 'array',
                minItems: 2,
                maxItems: 3,
                items: { type: 'string' },
              },
            },
            required: ['title', 'detail', 'actions'],
          },
        },
        avoid: {
          type: 'array',
          minItems: 2,
          maxItems: 4,
          items: { type: 'string' },
        },
      },
      required: ['priorities', 'avoid'],
    },
    safetyNotes: {
      type: 'array',
      minItems: 1,
      maxItems: 2,
      items: { type: 'string' },
    },
  },
  required: ['skinStory', 'dailyPlan', 'safetyNotes'],
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
  const authorization = request.headers.get('Authorization') ?? '';

  if (!supabaseUrl || !supabaseAnonKey || !authorization) {
    return jsonResponse({ error: 'Missing Supabase auth context' }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const user = await supabase.auth.getUser();

  if (user.error || !user.data.user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const body = await request.json();
  const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-5.6-luna';

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
              text: JSON.stringify({
                task: 'Generate JSON skin story and daily plan copy from saved Substrate prototype signals.',
                dailyEntryId: body.dailyEntryId,
                profileContext: body.profileContext,
                checkIn: body.checkIn,
                analysis: body.analysis,
                fallback: body.fallback,
              }),
            },
          ],
        },
      ],
      reasoning: { effort: 'low' },
      text: {
        verbosity: 'medium',
        format: {
          type: 'json_schema',
          name: 'substrate_recommendation',
          strict: true,
          schema: recommendationSchema,
        },
      },
    }),
  });

  const rawResponse = await response.json();

  if (!response.ok) {
    return jsonResponse(
      {
        error: rawResponse?.error?.message ?? 'OpenAI request failed',
        provider: 'openai',
        model,
        rawResponse,
      },
      502
    );
  }

  const outputText = extractOutputText(rawResponse);

  if (!outputText) {
    return jsonResponse({ error: 'OpenAI returned no structured output', provider: 'openai', model, rawResponse }, 502);
  }

  const generated = JSON.parse(outputText) as GeneratedRecommendation;

  return jsonResponse({
    ...generated,
    provider: 'openai',
    model,
    rawResponse,
  });
});

function buildInstructions() {
  return [
    'You generate concise JSON only for Substrate, a premium skincare and aesthetic-health prototype.',
    'Use the provided Skin Score, score band, score delta, drivers, check-in, and environment data.',
    'Always consider profileContext when it is provided. It is part of the analysis context, not optional decoration.',
    'Use profile context such as age range, skin type, sensitivity, goals, known triggers, and open-ended notes to personalize tone and recommendations.',
    'When profileContext contains non-empty goals, triggers, sensitivity, skin type, or notes, reference at least one relevant profile detail across the contributors, priority, or daily plan.',
    'Do not mention profile fields that are empty. Do not overstate profile context as a diagnosis.',
    'Do not change or invent the score. Do not claim medical diagnosis or clinical certainty.',
    'Do not identify diseases, prescribe medication, or recommend aggressive treatment.',
    'Use calm, personal, modern language for women interested in skincare and aesthetic health.',
    'Keep recommendations conservative: barrier support, SPF consistency, hydration, reduced actives, and routine consistency.',
    'Write copy that feels specific to the supplied signals but does not overstate image analysis.',
    'Return JSON that exactly matches the schema.',
  ].join('\n');
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
