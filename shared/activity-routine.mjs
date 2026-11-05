import { savedDailyActivities } from './daily-draft.mjs';
// Keep the user's reviewed wording/timing; do not create a workout for every day.
export function activityRoutineItems(checkIn) {
  return savedDailyActivities(checkIn).flatMap((activity, index) => {
    if (/\b(no|not|skip|cancelled|canceled)\b/i.test(activity)) return [];
    const label = /\b(swim|swimming|pool)\b/i.test(activity) ? 'Rinse after swimming and moisturize if needed'
      : /\b(gym|workout|exercise|running|run|cycling|pilates|yoga)\b/i.test(activity) ? 'Gently cleanse after sweating; avoid extra scrubbing'
      : /\b(outdoors|outdoor|hike|hiking|beach)\b/i.test(activity) ? 'Plan sun protection for outdoor time' : null;
    return label ? [{id:`activity-${index}-${activity}`,moment:'day',label,reason:`For your reviewed plan: ${activity}`,completed:false}] : [];
  });
}
