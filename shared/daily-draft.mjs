export const dailyOptions = { sleepQuality: ['Poor', 'Okay', 'Rested'], stressLevel: ['Low', 'Medium', 'High'], cyclePhase: ['Follicular', 'Ovulatory', 'Luteal', 'Menstrual', 'Not tracking'], skinFeelToday: ['Dry', 'Itchy', 'Oily', 'Normal'] };
export function cleanDailyDraft(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw Error('Invalid daily draft');
    const out = {};
    for (const [key, values] of Object.entries(dailyOptions)) {
        if (input[key] != null && input[key] !== '') {
            if (!values.includes(input[key]))
                throw Error('Invalid ' + key);
            out[key] = input[key];
        }
    }
    for (const key of ['movementPlanNote', 'yesterdayNote'])
        if (input[key] != null && input[key] !== '') {
            if (typeof input[key] !== 'string' || input[key].length > 2000)
                throw Error('Invalid note');
            out[key] = input[key].trim();
        }
    if (input.movementPlan != null) {
        if (!Array.isArray(input.movementPlan) || input.movementPlan.some(v => !['Yoga', 'Pilates', 'Indoors', 'Outdoors'].includes(v)))
            throw Error('Invalid activity');
        out.movementPlan = [...new Set(input.movementPlan)];
    }
    if (input.dailyActivities != null) {
        if (!Array.isArray(input.dailyActivities) || input.dailyActivities.length > 20 || input.dailyActivities.some(value => typeof value !== 'string' || value.length > 300))
            throw Error('Invalid daily activities');
        out.dailyActivities = [...new Set(input.dailyActivities.map(value => value.trim()).filter(Boolean))];
    }
    return out;
}

// Older check-ins retain their reviewed activity note without inventing a schedule.
export function savedDailyActivities(checkIn = {}) {
    const activities = checkIn.dailyActivities?.filter(value => typeof value === 'string' && value.trim()).map(value => value.trim());
    if (activities?.length) return activities;
    if (checkIn.movementPlanNote?.trim()) return checkIn.movementPlanNote.split(/\n|;/).map(value => value.trim()).filter(Boolean);
    return checkIn.movementPlan || [];
}
