// Shared by the browser and server: values outside these options are rejected.
export const questions = [
  { id: 'goal', title: 'What would you most like to improve?', options: ['Breakouts', 'Redness', 'Dark marks', 'Texture / pores', 'Dryness', 'Fine lines', 'Maintain my skin'] },
  { id: 'feel', title: 'How does your skin feel today?', options: ['Comfortable', 'Dry / tight', 'Stinging / burning', 'Itchy', 'Unsure'] },
  { id: 'duration', title: 'How long has this concern been present?', options: ['Just today', 'Several days', 'Recurring', 'Persistent for weeks', 'No current concern', 'Unsure'] },
  { id: 'blemishes', title: 'Which best describes your breakouts?', options: ['No breakouts', 'Clogged pores / blackheads', 'Small raised pimples', 'Both clogged pores and pimples', 'Deep painful bumps / scarring', 'Unsure'] },
  { id: 'treatments', multi: true, title: 'What treatments are you using?', options: ['Retinoid', 'Exfoliating acid', 'Benzoyl peroxide', 'Azelaic acid', 'Other prescription', 'None', 'Unsure'] },
  { id: 'change', title: 'Any recent changes?', options: ['No changes', 'New product / increased actives', 'Shaving / waxing', 'Recent or planned procedure', 'Unsure'] },
  { id: 'sensitivity', title: 'How easily does your skin react?', options: ['Usually tolerates products', 'Easily irritated', 'Unsure'] },
  { id: 'allergy', title: 'Any known skincare ingredient allergies?', options: ['None known', 'Yes', 'Unsure'] },
  { id: 'reproductive', title: 'Any pregnancy or breastfeeding considerations?', options: ['None / not applicable', 'Pregnant / trying to conceive', 'Breastfeeding', 'Prefer not to say'] },
  { id: 'photo', multi: true, title: 'What might affect this photo?', options: ['Makeup / tinted SPF', 'Recent exercise / heat', 'Just cleansed / rubbed skin', 'None', 'Unsure'] },
  { id: 'routine', title: 'Does your current routine already help?', options: ['Yes, comfortable and working', 'Not enough', 'No consistent routine', 'Unsure'] },
];

// Synthetic testing context, never inferred from the uploaded photo.
export function defaultTestAnswers() {
  return {
    conditions: ['C_ACNE'], oil: 'Usually balanced', goal: 'Breakouts', feel: 'Comfortable', duration: 'Recurring',
    blemishes: 'Both clogged pores and pimples', treatments: ['None'],
    change: 'No changes', sensitivity: 'Usually tolerates products',
    allergy: 'None known', reproductive: 'None / not applicable',
    photo: ['None'], routine: 'Not enough',
  };
}

export function shuffledTestAnswers() {
  const result = {};
  for (const question of questions) {
    if (question.when && !question.when(result)) continue;
    if (!question.options.length) continue;
    const option = question.options[Math.floor(Math.random() * question.options.length)];
    result[question.id] = question.multi ? [option] : option;
  }
  return result;
}

export function validateAnswers(input = {}, conditionIds = questions.find(q => q.id === 'conditions')?.options || []) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid questionnaire.');
  const output = {};
  for (const key of Object.keys(input)) {
    // Older saved experiments may still carry the retired fields.
    if (key === 'age' && ['Under 18', '18–29', '30–49', '50+', 'Prefer not to say'].includes(input[key])) continue;
    if (key === 'feel' && input[key] === 'Tender / painful') { output.feel = 'Unsure'; continue; }
    const question = key === 'conditions' ? {multi:true,options:conditionIds} : questions.find(q => q.id === key);
    if (!question) throw new Error('Unknown questionnaire field.');
    const values = question.multi ? input[key] : [input[key]];
    if (!Array.isArray(values) || !values.length || values.length > question.options.length || values.some(v => !question.options.includes(v))) throw new Error('Invalid questionnaire option.');
    if (values.length > 1 && values.some(v => ['None', 'Unsure'].includes(v))) throw new Error('None or unsure must be selected alone.');
    output[key] = question.multi ? [...new Set(values)] : values[0];
  }
  return output;
}

export function configureConditions(options) {
 const existing=questions.find(q=>q.id==='conditions');
 const question={id:'conditions',title:'Which concerns or goals would you like to explore?',multi:true,options:options.map(c=>c.id),labels:Object.fromEntries(options.map(c=>[c.id,c.name]))};
 if(existing)Object.assign(existing,question);else questions.unshift(question);
}
export function visibleQuestions(answers) {
 return questions.filter(q=>!q.when||q.when(answers));
}
const selected=(a,values)=>values.some(v=>(a.conditions||[]).includes(v));
questions.push(
 {id:'diagnoses',title:'Has a clinician confirmed any of these?',multi:true,options:['C_ROSACEA','C_MELASMA','None','Unsure'],labels:{C_ROSACEA:'Rosacea',C_MELASMA:'Melasma'},when:a=>selected(a,['C_ROSACEA','C_MELASMA'])||a.goal==='Redness'},
 {id:'marks',title:'What preceded the darker marks?',options:['After a breakout / irritation','Longstanding / unsure','Clinician-confirmed melasma'],when:a=>selected(a,['C_PIH','C_MELASMA'])||a.goal==='Dark marks'},
 {id:'oil',title:'How oily does your skin feel?',options:['Often oily / shiny','Usually balanced','Unsure'],when:a=>selected(a,['C_OIL','C_ACNE','C_TEXTURE'])||['Breakouts','Texture / pores'].includes(a.goal)},
 {id:'sun',title:'What is your sun-protection context?',options:['Consistent protection','Often outdoors / inconsistent protection','Unsure'],when:a=>selected(a,['C_PIH','C_MELASMA','C_PHOTOAGING','C_WRINKLE','C_GLOW'])||['Dark marks','Fine lines','Maintain my skin'].includes(a.goal)},
 {id:'climate',title:'Any dry-climate or travel context?',options:['No recent change','Dry climate / recent travel','Unsure'],when:a=>selected(a,['C_DEHYDRATION','C_BARRIER','C_GLOW'])||a.feel==='Dry / tight'},
 {id:'lifeStage',title:'Any life-stage context you want to include?',options:['None provided','Perimenopause / menopause','Prefer not to say'],when:a=>selected(a,['C_LAXITY','C_VOLUME','C_WRINKLE','C_DEHYDRATION'])||a.goal==='Fine lines'},
 {id:'retinoidForm',title:'Which retinoid type are you using?',options:['Prescription retinoid','Cosmetic retinol / retinal','Unsure'],when:a=>(a.treatments||[]).includes('Retinoid')},
 {id:'frequency',title:'How often are current treatments used?',options:['Occasionally','Several times weekly','Daily as directed','Unsure'],when:a=>(a.treatments||[]).some(x=>!['None','Unsure'].includes(x))},
 {id:'procedure',title:'Which procedure context applies?',options:['Planned procedure','Recovering with clinician protocol','Recovering without clear protocol','Unsure'],when:a=>a.change==='Recent or planned procedure'||selected(a,['C_POSTPROC'])},
 {id:'scar',title:'What scar context applies?',options:['Old acne-related texture','Raised or surgical scar','Recent wound / unsure'],when:a=>selected(a,['C_SCAR'])},
);
export function scenarioAnswers(id) {
 const base=defaultTestAnswers(); delete base.goal;base.conditions=[id];base.sun='Consistent protection';base.oil='Usually balanced';
 if(['C_BARRIER','C_DEHYDRATION'].includes(id))base.feel='Dry / tight';
 if(id==='C_ROSACEA'){base.diagnoses=['C_ROSACEA'];base.duration='Persistent for weeks';}
 if(id==='C_MELASMA')base.diagnoses=['C_MELASMA'];
 if(id==='C_PIH')base.marks='After a breakout / irritation';
 if(id==='C_OIL')base.oil='Often oily / shiny';
 if(id==='C_POSTPROC'){base.change='Recent or planned procedure';base.procedure='Recovering with clinician protocol';}
 if(id==='C_SCAR')base.scar='Old acne-related texture';
 return base;
}
