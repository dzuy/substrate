import { createHash } from "node:crypto";
import { matchProducts } from "../packages/ingredient-engine/dist/products.js";
import reviewed from "../data/catalog/reviewed-routine-products.json" with { type: "json" };
export const productPolicyVersion = "reviewed-routine-support-v1";
const holds = new Set([
  "withheld",
  "clinician_review",
  "research_only",
  "no_change",
]);
const supportIds = new Set(["I_GLY", "I_CER", "I_HA", "I_PANTH"]);
export function matchReportProducts(decision, catalog, answers = {}) {
  const strict = matchProducts(decision, catalog);
  const a = { ...decision.answers, ...answers };
  const safeContext =
    decision.status === "ready" &&
    ["18–29", "30–49", "50+"].includes(
      a.ageBand || decision.assumedContext?.ageBand,
    ) &&
    ["None known", "Unsure"].includes(a.allergy) &&
    a.routine !== "Yes, comfortable and working" &&
    a.change !== "Recent or planned procedure" &&
    !["Stinging / burning", "Itchy"].includes(a.feel) &&
    !decision.states?.some((s) =>
      ["C_POSTPROC", "C_SCAR", "C_BRUISE"].includes(s.conditionId),
    );
  const linked = new Map(
    decision.cards
      .filter((c) => supportIds.has(c.ingredientId) && !holds.has(c.status))
      .map((c) => [c.ingredientId, c]),
  );
  const options = safeContext
    ? catalog.products.flatMap((p) => {
        const review = reviewed.find(
          (r) =>
            r.id === p.id &&
            r.sourceUrl === p.sourceUrl &&
            createHash("md5").update(r.formula).digest("hex") === p.formulaHash,
        );
        if (!review || p.demoOnly || strict.items.some((x) => x.id === p.id))
          return [];
        // Even reviewed routine formulas never bypass an explicit ingredient hold.
        if (
          p.expressions.some((e) =>
            decision.cards.some(
              (c) => c.ingredientId === e.ingredientId && holds.has(c.status),
            ),
          )
        )
          return [];
        const matches = p.expressions
          .filter(
            (e) =>
              review.ingredientIds.includes(e.ingredientId) &&
              linked.has(e.ingredientId),
          )
          .map((e) => ({
            ...e,
            ingredientName: linked.get(e.ingredientId).name,
            reason: `Your ${a.feel === "Dry / tight" ? "reported dry / tight skin" : "saved ingredient assessment"} connects to this routine-support ingredient. The manufacturer lists ${e.label} in this ${review.role.toLowerCase()}. This is an ingredient match, not a treatment recommendation for the condition suggested by your photo.`,
          }));
        if (!matches.length) return [];
        return [
          {
            ...p,
            matches,
            matchType: "routine_support",
            note: `${review.role} · Full ingredient list checked against the manufacturer. ${a.allergy === "Unsure" ? "Your allergy history is unresolved; review the full formula before trying it. " : ""}Suitability still needs review. Follow the label; these are alternatives, not a combined regimen.`,
          },
        ];
      })
    : [];
  return { ...strict, items: [...strict.items, ...options].slice(0, 4) };
}
export function refreshReportProducts(report, catalog) {
  if (
    !report.decision ||
    ["database-unavailable", "sign-in-required"].includes(catalog.version)
  )
    return report;
  if (
    report.provenance?.productPolicyVersion === productPolicyVersion &&
    report.provenance?.catalogVersion === catalog.version
  )
    return report;
  const result = matchReportProducts(report.decision, catalog, report.answers);
  const owned = new Set(
    report.sections
      .find((s) => s.id === "wardrobe")
      ?.items.map((i) => i.productId) || [],
  );
  const products = result.items.map((p) => ({ ...p, owned: owned.has(p.id) }));
  const items = products.length
    ? products.map((p) => ({
        label: `${p.brand} ${p.name}`,
        body: p.matches
          .map((m) => `${m.ingredientName}: ${m.reason}`)
          .join(" "),
        productId: p.id,
        sourceUrl: p.sourceUrl,
        evidence: p.owned
          ? "Already owned"
          : p.matchType === "routine_support"
            ? "Routine support · review suitability"
            : "Eligible ingredient match",
        detail: p.note || p.format,
      }))
    : [{ label: "No eligible product match", body: result.message }];
  return {
    ...report,
    products,
    sections: report.sections.map((s) =>
      s.id === "products"
        ? {
            ...s,
            intro:
              "Products from our verified catalog, connected to your ingredient assessment. Routine-support matches are labeled separately from eligible treatment options. Choose alternatives, not everything together.",
            items,
          }
        : s,
    ),
    provenance: {
      ...report.provenance,
      catalogVersion: catalog.version,
      productPolicyVersion,
      productsUpdatedAt: new Date().toISOString(),
    },
  };
}
