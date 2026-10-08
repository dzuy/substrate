import {
  questions as scanQuestions,
  validateAnswers,
} from "../prototypes/face-scan/public/questions.mjs";

// One definition is consumed by the report UI and server. Retain the scan engine's
// vocabulary; daily check-in supplies the context that a photograph cannot show.
export const reportQuestions = [
  {
    id: "name",
    title: "What should we call you?",
    group: "About you",
    input: "text",
    optional: true,
  },
  {
    id: "ageBand",
    title: "Your age range",
    group: "About you",
    options: ["Under 18", "18–29", "30–49", "50+", "Prefer not to say"],
  },
  ...scanQuestions
    .filter((q) => q.id !== "conditions")
    .map((q) => ({
      ...q,
      group: ["goal", "feel", "duration", "blemishes", "oil", "marks"].includes(
        q.id,
      )
        ? "Your skin"
        : "Your routine & context",
    })),
  {
    id: "sleep",
    title: "How has your sleep been recently?",
    group: "Your everyday",
    options: ["Poor", "Okay", "Rested", "Prefer not to say"],
  },
  {
    id: "stress",
    title: "Your recent stress level",
    group: "Your everyday",
    options: ["Low", "Medium", "High", "Prefer not to say"],
  },
  {
    id: "activity",
    title: "Where do you usually exercise or spend active time?",
    group: "Your everyday",
    options: [
      "Mostly indoors",
      "Often outdoors",
      "Both",
      "No regular activity",
      "Prefer not to say",
    ],
  },
  {
    id: "cycle",
    title: "Cycle context, if relevant",
    group: "Your everyday",
    options: [
      "Menstrual",
      "Follicular",
      "Ovulatory",
      "Luteal",
      "Not tracking / not applicable",
      "Prefer not to say",
    ],
    optional: true,
  },
  {
    id: "country",
    title: "Where do you shop for skincare?",
    optional: true,
    group: "Your everyday",
    input: "text",
    placeholder: "Country or region",
  },
  {
    id: "budget",
    title: "Your product budget",
    group: "Your everyday",
    options: ["Keep spending minimal", "Mid-range", "Flexible"],
  },
  {
    id: "supplements",
    title: "Supplements you currently take",
    group: "Your everyday",
    input: "text",
    optional: true,
    placeholder: "Optional — names only; leave blank if none",
  },
  {
    id: "notes",
    title: "Anything else we should know?",
    group: "Your everyday",
    input: "text",
    optional: true,
    placeholder:
      "Allergies, procedures, lifestyle, or a question for your report",
  },
];
export const questionGroups = [
  "About you",
  "Your skin",
  "Your routine & context",
  "Your everyday",
];
export function visibleReportQuestions(answers, group) {
  return reportQuestions.filter(
    (q) => (!group || q.group === group) && (!q.when || q.when(answers)),
  );
}
export function validateReportAnswers(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Complete your questionnaire.");
  const clean = {};
  for (const q of visibleReportQuestions(input)) {
    const v = input[q.id];
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) {
      if (!q.optional) throw Error(`Please answer: ${q.title}`);
      continue;
    }
    if (q.input) {
      if (
        typeof v !== "string" ||
        v.trim().length > 1200 ||
        (!q.optional && !v.trim())
      )
        throw Error(`Check your answer: ${q.title}`);
      clean[q.id] = v.trim();
    } else {
      const values = q.multi ? v : [v];
      if (
        !Array.isArray(values) ||
        !values.length ||
        values.some((x) => !q.options.includes(x))
      )
        throw Error(`Check your answer: ${q.title}`);
      if (
        values.length > 1 &&
        values.some((x) => ["None", "Unsure"].includes(x))
      )
        throw Error("Choose None or Unsure on its own.");
      clean[q.id] = q.multi ? [...new Set(values)] : values[0];
    }
  }
  return clean;
}
export function engineAnswers(answers) {
  const keys = new Set(scanQuestions.map((q) => q.id));
  return validateAnswers(
    Object.fromEntries(Object.entries(answers).filter(([k]) => keys.has(k))),
  );
}
