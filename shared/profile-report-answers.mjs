export function profileReportAnswers(profile) {
  const answers = {};
  const name = profile?.displayName?.trim();
  if (name) answers.name = name;
  const age = String(profile?.age || profile?.ageRange || '').trim().replace(/[–—]/g, '-');
  if (/^prefer not to say$/i.test(age)) answers.ageBand = 'Prefer not to say';
  else if (/^under 18$/i.test(age)) answers.ageBand = 'Under 18';
  else {
    const match = /^(\d{1,3})(?:\s*-\s*(\d{1,3})|(\+))?$/.exec(age);
    if (match) {
      const low = Number(match[1]);
      const high = match[3] ? Infinity : Number(match[2] ?? match[1]);
      if (low <= high && low >= 0) {
        if (high < 18) answers.ageBand = 'Under 18';
        else if (low >= 18 && high < 30) answers.ageBand = '18–29';
        else if (low >= 30 && high < 50) answers.ageBand = '30–49';
        else if (low >= 50) answers.ageBand = '50+';
      }
    }
  }
  if (['None known','Yes','Unsure'].includes(profile?.ingredientAllergy)) answers.allergy=profile.ingredientAllergy;
  if(profile?.ingredientAllergy==='Prefer not to say') answers.allergy='Unsure'; // Original declined state remains in the profile; engine receives unresolved context.
  const sensitivity={'Low':'Usually tolerates products','High':'Easily irritated','Sensitive':'Easily irritated','Very high':'Easily irritated'};
  if(sensitivity[profile?.sensitivityLevel]) answers.sensitivity=sensitivity[profile.sensitivityLevel];
  const goals={'Acne':'Breakouts','Redness':'Redness','Pigmentation':'Dark marks','Texture':'Texture / pores','Large pores':'Texture / pores','Dryness':'Dryness','Fine lines':'Fine lines'};
  const mapped=[...new Set((profile?.skinGoals||[]).map(g=>goals[g]).filter(Boolean))];
  if(mapped.length===1)answers.goal=mapped[0]; // Multiple goals require the user to choose a priority.
  // Exact questionnaire values only; do not infer pregnancy, allergies or treatments from notes.
  return {...(profile?.assessmentAnswers || {}),...answers};
}
