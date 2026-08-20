import { supabase } from '@/lib/supabase';
import type { AnalysisSignals } from '@/types/database';

export type ProgressSummaryEntry = {
  entryDate: string;
  score?: number;
  scoreBand?: AnalysisSignals['scoreBand'];
  scoreDelta?: number;
};

export async function generateProgressSummary(entries: ProgressSummaryEntry[]) {
  const fallback = buildFallbackProgressSummary(entries);

  if (entries.length === 0) {
    return { data: fallback, error: null };
  }

  try {
    const response = await supabase.functions.invoke('generate-progress-summary', {
      body: { entries },
    });

    if (response.error || !response.data || typeof response.data.summary !== 'string') {
      return { data: fallback, error: null };
    }

    return { data: response.data.summary as string, error: null };
  } catch {
    return { data: fallback, error: null };
  }
}

function buildFallbackProgressSummary(entries: ProgressSummaryEntry[]) {
  const scored = entries.filter((entry): entry is ProgressSummaryEntry & { score: number } => typeof entry.score === 'number');

  if (scored.length === 0) {
    return 'Complete a few scored check-ins to start seeing a meaningful progress pattern.';
  }

  const latest = scored[scored.length - 1];
  const first = scored[0];
  const delta = latest.score - first.score;
  const direction = delta > 2 ? 'improving' : delta < -2 ? 'under more pressure' : 'fairly steady';

  return `Your Skin Score is ${direction} across the saved check-ins. The latest score is ${latest.score}, so keep watching which daily inputs line up with stronger or weaker days.`;
}
