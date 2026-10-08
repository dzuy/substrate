export const ingredientIntro =
  "These connections use visible findings from your photo and your questionnaire answers, matched through our ingredient knowledge library. A connection is not a confirmed recommendation. Library categories such as rosacea or post-inflammatory hyperpigmentation describe research topics; your photo does not diagnose those conditions. Some links are provisional or inferred and still need evidence review.";

const statusCopy = {
  candidate: [
    "Provisional ingredient option",
    "This ingredient has a relevant library connection and passes the current context checks. The recommendation remains provisional; ingredient evidence does not establish the suitability of a finished product.",
  ],
  needs_context: [
    "More information needed",
    "This ingredient may be relevant, but the information below needs clarification before it can become a personalized recommendation. Answering more questions may resolve context gaps; it does not resolve evidence gaps.",
  ],
  evidence_review: [
    "Evidence needs review",
    "This relationship is recorded in the library, but its supporting evidence or exact ingredient form has not been established for this use. More questionnaire answers alone will not resolve this.",
  ],
  withheld: [
    "New option on hold",
    "The current assessment does not support adding this ingredient. The limits below explain why.",
  ],
  clinician_review: [
    "Clinician review needed",
    "This connection needs clinical review before it can become a personalized recommendation.",
  ],
  research_only: [
    "Research connection only",
    "This is an emerging research relationship, not an ingredient recommendation.",
  ],
  no_change: [
    "No new addition established",
    "Your existing routine may already cover this role, or is reported to be working. A library connection alone is not a reason to add another product.",
  ],
};
const contextReasons = new Map([
  [
    "Review exact ingredient/formula allergy context.",
    "Clarify known allergies and the exact formula involved.",
  ],
  [
    "Confirm current skin comfort.",
    "Clarify whether your skin currently feels comfortable, dry, itchy, or irritated.",
  ],
  [
    "Photo conditions need confirmation for these visual links.",
    "Confirm photo conditions, such as makeup, filters, recent exercise, or sun exposure, that may affect what is visible.",
  ],
  [
    "Confirm recent product/procedure changes.",
    "Clarify recent product changes or procedures and when they happened.",
  ],
  [
    "Confirm tolerance before exploring treatment actives.",
    "Clarify how easily your skin becomes irritated and which products you tolerate.",
  ],
  [
    "Clarify existing treatment exposure.",
    "Identify the active treatments you already use.",
  ],
  [
    "Treatment frequency is unknown; do not infer total exposure.",
    "Clarify how often you use your existing active treatments.",
  ],
  [
    "Check overlap and total active load with the existing treatment.",
    "Review possible overlap with the active treatments already in your routine.",
  ],
  [
    "Prescription care remains the anchor; review overlap without changing prescribed use.",
    "Review overlap with your prescription treatment; keep its prescribed instructions.",
  ],
  [
    "Clarify breakout pattern; the scan does not confirm acne.",
    "Clarify your breakout pattern; the photo does not confirm acne.",
  ],
  [
    "Clarify persistence before treatment exploration.",
    "Clarify how long the concern has persisted.",
  ],
  [
    "Clarify photoprotection before corrective care.",
    "Clarify your sun-protection routine.",
  ],
  [
    "Age context is missing; the product adapter must supply real profile context.",
    "An appropriate age range has not been established for personalized active-ingredient options.",
  ],
]);
const evidenceReasons = new Map([
  [
    "Relationship is represented; missing or mismatched evidence is not treated as approval.",
    "The library link does not yet have evidence confirmed for the relevant concern and ingredient form.",
  ],
  [
    "Includes a proposed link derived from workbook descriptions.",
    "Part of this connection is inferred from library descriptions and still needs review.",
  ],
  [
    "Resolve the exact form and exposure; family-level evidence cannot cover every variant.",
    "Evidence for an ingredient family does not establish the evidence for every form, concentration, or use.",
  ],
]);
const friendlyConcern = (s) =>
  ({
    C_ROSACEA: "Redness context",
    C_PIH: "Uneven pigmentation context",
    C_DEHYDRATION: "Reported dryness / hydration context",
  })[s.conditionId] || s.name;
const friendlyReason = (s) =>
  s
    .replace(
      "Retinoid reproductive handling is unresolved (CR-002); no safety determination.",
      "Retinoid suitability in your reproductive context requires clinician review; this report does not establish safety.",
    )
    .replace(
      "Procedure protocol governs; no hold/restart timing is inferred (CR-003).",
      "Your clinician’s procedure protocol governs; this report does not set stop or restart dates.",
    );

export function clarifyReport(report) {
  return {
    ...report,
    sections: report.sections.map((section) => {
      if (section.id !== "ingredients") return section;
      return {
        ...section,
        intro: ingredientIntro,
        items: section.items.map((entry) => {
          const card = report.decision?.cards?.find((c) =>
            entry.ingredientId
              ? c.ingredientId === entry.ingredientId
              : c.name === entry.label,
          );
          if (!card) return entry;
          const reasons = card.reasons || [];
          const context = reasons
            .filter((r) => contextReasons.has(r))
            .map((r) => contextReasons.get(r));
          const evidence = reasons
            .filter((r) => evidenceReasons.has(r))
            .map((r) => evidenceReasons.get(r));
          if (
            card.trace?.some(
              (t) => t.origin === "proposed narrative mapping",
            ) &&
            !reasons.includes(
              "Includes a proposed link derived from workbook descriptions.",
            )
          )
            evidence.push(
              "Part of this connection is inferred from library descriptions and still needs review.",
            );
          const other = reasons
            .filter((r) => !contextReasons.has(r) && !evidenceReasons.has(r))
            .map(friendlyReason);
          const states = (report.decision.states || []).filter((s) =>
            card.conditionIds.includes(s.conditionId),
          );
          const links = states.map(
            (s) =>
              `${friendlyConcern(s)} (${s.source === "photo" ? "photo finding" : s.source === "photo + questionnaire" ? "photo finding + your answers" : "your answers"})`,
          );
          const [evidenceLabel, body] = statusCopy[card.status] || [
            entry.evidence,
            entry.body,
          ];
          return {
            ...entry,
            evidence: evidenceLabel,
            body,
            detail: card.job,
            clarifications: [
              ...(links.length
                ? [
                    {
                      label: "Why this is linked",
                      body: links.join("; ") + ".",
                    },
                  ]
                : []),
              ...(context.length
                ? [
                    {
                      label: "What needs clarification",
                      body: context.join(" "),
                    },
                  ]
                : []),
              ...(evidence.length
                ? [
                    {
                      label: "Evidence still under review",
                      body: [...new Set(evidence)].join(" "),
                    },
                  ]
                : []),
              ...(other.length
                ? [{ label: "Other limits", body: other.join(" ") }]
                : []),
            ],
          };
        }),
      };
    }),
  };
}
