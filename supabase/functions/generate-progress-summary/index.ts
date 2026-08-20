import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const summarySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
  },
  required: ['summary'],
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
      instructions: [
        'You write concise progress summaries for Substrate, a skincare and aesthetic-health tracking prototype.',
        'Use only the supplied scored entries. Do not invent missing data.',
        'Summarize the current trend in 1-2 calm, useful sentences.',
        'Mention the latest score and whether the recent pattern is improving, steady, or under pressure.',
        'Do not make medical claims or diagnosis.',
        'Return JSON that exactly matches the schema.',
      ].join('\n'),
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify({
                task: 'Summarize recent Substrate progress from Skin Scores.',
                entries: body.entries,
              }),
            },
          ],
        },
      ],
      reasoning: { effort: 'low' },
      text: {
        verbosity: 'low',
        format: {
          type: 'json_schema',
          name: 'substrate_progress_summary',
          strict: true,
          schema: summarySchema,
        },
      },
    }),
  });

  const rawResponse = await response.json();

  if (!response.ok) {
    return jsonResponse({ error: rawResponse?.error?.message ?? 'OpenAI request failed', provider: 'openai', model, rawResponse }, 502);
  }

  const outputText = extractOutputText(rawResponse);

  if (!outputText) {
    return jsonResponse({ error: 'OpenAI returned no structured output', provider: 'openai', model, rawResponse }, 502);
  }

  return jsonResponse({ ...JSON.parse(outputText), provider: 'openai', model, rawResponse });
});

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
    const content = item && typeof item === 'object' ? (item as { content?: unknown }).content : null;

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
