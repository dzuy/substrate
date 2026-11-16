import { prepareDayWithTate } from '@/services/tate-day';
/** Existing authenticated server-side model extraction, never a second review step. */
export async function extractRoutineEvents(note: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const proposal = await prepareDayWithTate(note, false, controller.signal);
    return { activities: proposal?.activities || [], source: 'model' as const };
  } catch (error) {
    console.warn('Routine event planning used fallback:', error instanceof Error ? error.message : 'unknown planning failure');
    return { activities: [], source: 'fallback' as const };
  } finally { clearTimeout(timeout); }
}
