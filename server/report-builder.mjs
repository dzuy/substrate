import { clarifyReport } from "../shared/report-clarifications.mjs";
import { randomUUID } from "node:crypto";
import knowledge from "../prototypes/face-scan/knowledge/active.json" with { type: "json" };
import { evaluate } from "../packages/ingredient-engine/dist/engine.js";
import {
  matchReportProducts,
  refreshReportProducts,
} from "./report-products.mjs";
import {
  engineAnswers,
  validateReportAnswers,
} from "../shared/report-questions.mjs";

const title = (value) =>
  value.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
const item = (label, body, extra = {}) => ({ label, body, ...extra });
export function buildReport({
  scan,
  answers: input,
  catalog,
  wardrobe = [],
  mode = "optimize",
  now = new Date().toISOString(),
  id = randomUUID(),
}) {
  const answers = validateReportAnswers(input);
  const ageBand = ["Under 18", "Prefer not to say"].includes(answers.ageBand)
    ? undefined
    : answers.ageBand;
  const decision = evaluate(
    {
      analysis: scan.analysis,
      answers: engineAnswers(answers),
      now,
      assumedContext: ageBand
        ? { ageBand, source: "User-provided report questionnaire" }
        : undefined,
    },
    knowledge,
  );
  if (decision.status === "retake") throw Error(decision.message);
  const suggestions = matchReportProducts(decision, catalog, answers);
  // Never substitute demo examples for eligible database matches.
  const owned = new Set(wardrobe.map((p) => p.id));
  const products = suggestions.items.map((p) => ({
    ...p,
    owned: owned.has(p.id),
  }));
  const findings = scan.analysis.detailedFindings;
  const visible = findings.filter((f) => f.assessment === "visible");
  const name = String(answers.name || "Your");
  const section = (id, title, intro, items) => ({ id, title, intro, items });
  const profileContext = [
    item("Your priority", String(answers.goal)),
    item("Skin comfort", String(answers.feel)),
    item("Current routine", String(answers.routine)),
    item("Age range", String(answers.ageBand)),
    item("Sleep / stress", `${answers.sleep} sleep · ${answers.stress} stress`),
    item("Movement", String(answers.activity)),
    item(
      "Shopping preferences",
      `${answers.country} · ${answers.budget}. Availability and prices have not been verified for your location.`,
    ),
  ];
  if (answers.cycle)
    profileContext.push(
      item(
        "Cycle context",
        `${answers.cycle}. Supplied context, not an inferred cause of visible findings.`,
      ),
    );
  if (answers.lifeStage)
    profileContext.push(item("Life stage", String(answers.lifeStage)));
  const drivers = [
    item("What the photo can tell us", scan.analysis.summary, {
      evidence: "Photo observation",
    }),
    item(
      "What you told us",
      `${answers.feel}; ${answers.duration}. Your goal is ${String(answers.goal).toLowerCase()}. These answers provide context; they do not establish why a finding is present.`,
      { evidence: "Self-reported context" },
    ),
  ];
  if (answers.change !== "No changes")
    drivers.push(
      item(
        "Recent changes",
        `${answers.change}. Keep track of timing before attributing a change to a product.`,
        { evidence: "Self-reported context" },
      ),
    );
  if (answers.activity === "Often outdoors" || answers.activity === "Both")
    drivers.push(
      item(
        "Outdoor activity",
        "Build sun protection and a comfortable cleansing routine around your outdoor time. Choose protection using its labeled directions, including water resistance when relevant.",
        { evidence: "General routine guidance" },
      ),
    );
  const ingredientItems = decision.cards.map((c) =>
    item(
      c.name,
      c.explanation + (c.reasons.length ? " " + c.reasons.join(" ") : ""),
      {
        evidence:
          c.status === "candidate"
            ? "Provisional ingredient option"
            : title(c.status),
        sourceUrl: c.source,
        ingredientId: c.ingredientId,
        detail: `${c.job} · Linked to: ${c.conditionIds.map((id) => decision.states.find((s) => s.conditionId === id)?.name || id).join(", ")}`,
      },
    ),
  );
  const wardrobeItems = wardrobe.map((p) => {
    const mappedCards = (
      catalog.products.find((x) => x.id === p.id)?.expressions || []
    ).flatMap((e) =>
      decision.cards.filter(
        (c) => c.ingredientId === e.ingredientId && e.role === "primary",
      ),
    );
    const matched = mappedCards.some((c) =>
      ["candidate", "no_change"].includes(c.status),
    );
    const mapped = catalog.products.find((x) => x.id === p.id);
    const holds =
      mapped?.expressions.flatMap((e) =>
        decision.cards.filter(
          (c) =>
            c.ingredientId === e.ingredientId &&
            ["withheld", "clinician_review"].includes(c.status),
        ),
      ) || [];
    const verdict = holds.length
      ? "REVIEW BEFORE USE"
      : matched && answers.routine === "Yes, comfortable and working"
        ? "KEEP IF TOLERATED"
        : matched
          ? "COVERS AN INGREDIENT OPTION"
          : "NEEDS REVIEW";
    return item(
      `${p.brand ? p.brand + " " : ""}${p.name}`,
      holds.length
        ? holds.map((c) => c.reasons.join(" ")).join(" ")
        : matched
          ? "This product already covers a matched ingredient. There is no need to buy it again. Follow its directions and your existing clinician advice."
          : "The available evidence does not establish a personalized verdict for this formula. Its presence in your wardrobe is not proof of suitability; keep existing prescribed instructions.",
      { evidence: verdict, productId: p.id || null },
    );
  });
  const routine = [
    item(
      "Morning · a simple foundation",
      "Cleanse as needed for comfort, moisturize as needed, and use sun protection according to its label. Keep products you already tolerate; a missing catalog match is not a reason to replace them.",
    ),
    item(
      "Evening · consistency first",
      "Cleanse and moisturize according to comfort. Keep prescribed treatment directions with your clinician. Avoid adding several new active products at once.",
    ),
    item(
      "When skin feels reactive",
      "Keep the routine simple. New treatment options remain on hold when the ingredient assessment calls for review. Persistent or worsening symptoms warrant professional assessment.",
    ),
  ];
  if (products.length)
    routine.push(
      item(
        mode === "optimize"
          ? "Fill a gap, not a shelf"
          : "Choose one change at a time",
        "The matched products below are alternatives to consider, not a combined regimen. Ingredient matching does not determine a finished product’s frequency, layering order, or suitability. Follow the exact product label.",
      ),
    );
  const productItems = products.map((p) =>
    item(
      `${p.brand} ${p.name}`,
      p.matches.map((m) => `${m.ingredientName}: ${m.reason}`).join(" "),
      {
        productId: p.id,
        sourceUrl: p.sourceUrl,
        evidence: p.owned ? "Already owned" : "Published catalog match",
        detail: p.note || p.format,
      },
    ),
  );
  const contextNotes = [
    item(
      "Sleep and stress",
      `You reported ${String(answers.sleep).toLowerCase()} sleep and ${String(answers.stress).toLowerCase()} stress. Track these alongside comfort and photos to look for your own repeat patterns; one scan cannot establish a cause.`,
    ),
    item(
      "Food and hydration",
      "No dietary history or laboratory results were supplied. This report does not infer deficiencies, prescribe a diet, or recommend a supplement stack from a photograph.",
    ),
  ];
  if (answers.supplements)
    contextNotes.push(
      item(
        "Your supplement notes",
        `${answers.supplements}. Recorded for context only. Ingredients, doses, interactions, and relevance have not been reviewed; discuss these with your clinician or pharmacist.`,
      ),
    );
  if (answers.notes)
    contextNotes.push(
      item(
        "Your additional notes",
        `${answers.notes}. Preserved as self-reported context; not independently verified.`,
      ),
    );
  const safety = decision.cards
    .filter((c) => ["clinician_review", "withheld"].includes(c.status))
    .map((c) => item(c.name, c.reasons.join(" ")));
  safety.push(
    item(
      "Observation, not diagnosis",
      "This photo-based report describes visible cosmetic signals. It cannot diagnose a condition, establish a deficiency, or replace clinical evaluation. Ingredient evidence remains provisional and a catalog match does not prove finished-formula efficacy.",
    ),
  );
  if (answers.change === "Recent or planned procedure")
    safety.push(
      item(
        "Procedure planning",
        "Follow the treating clinician’s preparation and recovery protocol. No stop/restart schedule is inferred here.",
      ),
    );
  if (answers.ageBand === "Under 18" || answers.ageBand === "Prefer not to say")
    safety.push(
      item(
        "Age context",
        "Personalized active-ingredient options remain pending. No adult age is assumed.",
      ),
    );
  const sections = [
    section(
      "signature",
      "Your skin, in focus",
      "A baseline for your own skin. No population ranking or arbitrary overall grade.",
      visible.length
        ? visible.map((f) =>
            item(title(f.concern), f.evidence, {
              evidence: "Visible in this photo",
              detail: f.uncertainty,
            }),
          )
        : [item("No clear priority finding", scan.analysis.summary)],
    ),
    section(
      "context",
      "The context behind your skin",
      "Your answers are kept separate from what the photo shows.",
      profileContext,
    ),
    section(
      "observations",
      "What we observed",
      "Every observed concern includes the limits of this image.",
      findings.map((f) =>
        item(title(f.concern), f.evidence, {
          evidence: title(f.assessment),
          detail: f.uncertainty,
        }),
      ),
    ),
    section(
      "drivers",
      "What may matter",
      "Context to investigate, not a claim of causation.",
      drivers,
    ),
    section(
      "ingredients",
      "The ingredient connection",
      "Your findings and answers connect to the versioned condition → pathway → ingredient library. Review states are preserved.",
      ingredientItems.length
        ? ingredientItems
        : [
            item(
              "No supported ingredient connection yet",
              decision.message ||
                "The available knowledge does not establish a match for this assessment.",
            ),
          ],
    ),
    section(
      "wardrobe",
      "What you already own",
      mode === "optimize"
        ? "Keep useful coverage. Make a change only for a clear reason."
        : "Your existing products remain here for reference while you consider a fresh routine.",
      wardrobeItems.length
        ? wardrobeItems
        : [
            item(
              "No products supplied",
              "We have not assumed what you use. Add your products to a new assessment for an ingredient-based wardrobe review.",
            ),
          ],
    ),
    section(
      "routine",
      "Your routine, considered",
      mode === "optimize"
        ? "Optimize what you own."
        : "Build a simple routine.",
      routine,
    ),
    section(
      "products",
      "Products with a reason",
      "Real published catalog records, matched to eligible ingredient options. These are alternatives, not a shopping list.",
      productItems.length
        ? productItems
        : [
            item(
              "No eligible product match",
              suggestions.message +
                " We have not substituted unreviewed catalog records or demo products.",
            ),
          ],
    ),
    section(
      "safety",
      "Pause, protect, plan",
      "The limits are part of the recommendation.",
      safety,
    ),
    section(
      "lifestyle",
      "Beyond the bathroom shelf",
      "Your everyday context, with missing inputs left missing.",
      contextNotes,
    ),
    section(
      "biology",
      "Your biology: what is still unknown",
      "Biomarkers are not connected.",
      [
        item(
          "No laboratory conclusions",
          "No bloodwork was supplied. Testing should be individualized with a clinician; this report does not generate a lab panel from a face photo.",
        ),
      ],
    ),
    section(
      "next",
      "Your next eight weeks",
      "Compare you with you, using similar lighting and a consistent routine.",
      [
        item(
          "Now",
          "Save this baseline and choose one priority. Review any held ingredients before making changes.",
        ),
        item(
          "Week 2",
          "Notice comfort, stinging, dryness, or irritation. Record changes in products and daily context.",
        ),
        item(
          "Week 4",
          "Repeat a makeup-free photo in similar lighting. Compare visible patterns without treating image scores as clinical measurements.",
        ),
        item(
          "Week 8",
          "Review your original goal and what changed. Consider a new report with updated photos and product context.",
        ),
      ],
    ),
  ];
  return clarifyReport(
    refreshReportProducts(
      {
        id,
        version: "skin-report-v1",
        createdAt: now,
        name,
        title: "Your Skin Intelligence Report",
        summary: scan.analysis.summary,
        mode,
        answers,
        sections,
        concerns: visible.map((f) => title(f.concern)),
        photoLimitations: scan.analysis.photoLimitations || [],
        provenance: {
          model: scan.model,
          promptVersion: scan.promptVersion,
          imageHash: scan.imageHash,
          knowledgeVersion: decision.knowledgeVersion,
          ruleVersion: decision.ruleVersion,
          catalogVersion: catalog.version,
        },
        decision,
        products,
        unlocked: false,
        price: 79,
        currency: "USD",
        paymentMode: "simulation",
      },
      catalog,
    ),
  );
}
