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
  return answers;
}
