export const stages = ['welcome', 'profile', 'photos', 'wardrobe', 'subscription', 'summary', 'wellness', 'complete'];
export function localDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function stableInput(value) {
    if (Array.isArray(value))
        return '[' + value.map(stableInput).join(',') + ']';
    if (value && typeof value === 'object')
        return '{' + Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => JSON.stringify(k) + ':' + stableInput(value[k])).join(',') + '}';
    return JSON.stringify(value) ?? 'null';
}
export function nextStage(stage) { return stages[Math.min(stages.length - 1, Math.max(0, stages.indexOf(stage)) + 1)]; }
export function summaryCards(report, profile = {}, wardrobe = []) {
    if (!report)
        return [];
    return [
        { title: 'Your context', body: [profile.displayName, ...(profile.skinGoals || []), profile.skinType].filter(Boolean).join(' · ') || 'Profile context has not been supplied.', source: 'Self-reported profile' },
        { title: 'What your photo suggests', body: report.summary || 'No photo observation available.', source: 'Dated photo analysis — not a diagnosis' },
        ...report.sections.filter(s => ['ingredients', 'products', 'wardrobe'].includes(s.id)).slice(0, 3).map(s => ({ title: s.title, body: s.items.slice(0, 2).map(i => `${i.label}: ${i.body}`).join(' ') || s.intro, source: 'Saved ingredient decision and catalog evidence' })),
        { title: 'Your current wardrobe', body: wardrobe.length ? `${wardrobe.filter(w => w.status === 'active').length} active owned products. Ownership does not establish suitability.` : 'No wardrobe records were supplied to this view.', source: 'Current saved wardrobe; may differ from this dated assessment' },
        { title: 'What remains uncertain', body: report.photoLimitations?.join(' ') || 'A photograph cannot establish allergies, diagnoses or product suitability.', source: 'Analysis limitations' }
    ];
}
export function ownedRoutine(wardrobe, checkIn = {}) {
    const irritated = !checkIn.skinFeelToday || ['Itchy', 'Dry'].includes(checkIn.skinFeelToday);
    const active = wardrobe.filter(w => w.status === 'active' && w.product);
    const items = [];
    for (const [moment, timing] of [['morning', 'am'], ['evening', 'pm']]) {
        for (const role of ['cleanser', 'moisturizer', 'spf']) {
            if (role === 'spf' && timing === 'pm')
                continue;
            const w = active.find(w => w.routine_role === role && [timing, 'either'].includes(w.routine_timing) && w.frequency === 'daily' && !(irritated && w.avoid_when_irritated));
            if (w)
                items.push({ id: `owned:${moment}:${w.id}`, moment, label: `${w.product.brand?.name || ''} ${w.product.name}`.trim(), reason: `Your saved ${role}, ${timing.toUpperCase()} routine. Follow the label and your existing instructions; suitability has not been established.`, completed: false });
        }
    }
    if (checkIn.movementPlan?.length || checkIn.movementPlanNote)
        items.push({ id: 'activity:review', moment: 'day', label: 'Around your activity', reason: 'Review your usual cleansing and sun-protection needs around the activity you recorded. No new treatment is inferred.', completed: false });
    return items;
}
