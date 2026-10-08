import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import reviewed from "../data/catalog/reviewed-routine-products.json" with { type: "json" };
import { engineIdentity, mappingSql } from "../scripts/catalog-engine-map.mjs";
import {
  matchReportProducts,
  refreshReportProducts,
} from "./report-products.mjs";
const r = reviewed[0];
const product = {
  ...r,
  formulaHash: createHash("md5").update(r.formula).digest("hex"),
  expressions: [{ ingredientId: "I_GLY", label: "Glycerin", role: "primary" }],
  requiredEligibleIds: ["I_GLY"],
};
const catalog = { version: "test", products: [product] };
const answers = {
  ageBand: "30–49",
  allergy: "Unsure",
  feel: "Dry / tight",
  routine: "Unsure",
  change: "Unsure",
};
const decision = {
  status: "ready",
  answers,
  states: [{ conditionId: "C_DEHYDRATION" }],
  cards: [{ ingredientId: "I_GLY", name: "Glycerin", status: "needs_context" }],
};
test("exact identities exclude similar names and unsupported derivatives", () => {
  assert.equal(engineIdentity(" Glycerin "), "I_GLY");
  assert.equal(engineIdentity("Ceramide NP"), "I_CER");
  for (const name of [
    "Ethylhexylglycerin",
    "Glyceryl Stearate",
    "Butyloctyl Salicylate",
    "Panthenyl Triacetate",
    "Potassium Azeloyl Diglycinate",
  ])
    assert.equal(engineIdentity(name), undefined);
});
test("mapping drafts preserve existing reviewed links", () => {
  const sql = mappingSql({
    products: [{ id: "p" }],
    ingredients: [{ id: "i", name: "Glycerin" }],
    links: [{ product_id: "p", ingredient_id: "i" }],
  });
  assert.match(sql, /true,false/);
  assert.match(sql, /on conflict do nothing/);
});
test("reviewed real formula supplies explicitly labeled support without promoting ingredient status", () => {
  const result = matchReportProducts(decision, catalog, answers);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].matchType, "routine_support");
  assert.match(result.items[0].note, /allergy history is unresolved/);
  assert.equal(decision.cards[0].status, "needs_context");
});
test("stale formula, unpublished/absent catalog and demo never create support matches", () => {
  for (const products of [
    [],
    [{ ...product, formulaHash: "changed" }],
    [{ ...product, demoOnly: true }],
  ])
    assert.equal(
      matchReportProducts(decision, { ...catalog, products }, answers).items
        .length,
      0,
    );
});
test("known allergy, procedure, age uncertainty and active irritation remain blocked", () => {
  for (const change of [
    { allergy: "Known allergy" },
    { change: "Recent or planned procedure" },
    { ageBand: "Under 18" },
    { ageBand: "Prefer not to say" },
    { feel: "Stinging / burning" },
    { routine: "Yes, comfortable and working" },
  ])
    assert.equal(
      matchReportProducts(decision, catalog, { ...answers, ...change }).items
        .length,
      0,
    );
  for (const status of [
    "withheld",
    "clinician_review",
    "research_only",
    "no_change",
  ])
    assert.equal(
      matchReportProducts(
        { ...decision, cards: [{ ...decision.cards[0], status }] },
        catalog,
        answers,
      ).items.length,
      0,
    );
});
test("saved report refresh preserves findings and unlock and is idempotent", () => {
  const original = {
    answers,
    decision,
    unlocked: true,
    provenance: { model: "original" },
    sections: [
      { id: "observations", items: [{ body: "original photo findings" }] },
      { id: "products", items: [] },
    ],
  };
  const refreshed = refreshReportProducts(original, catalog);
  assert.equal(refreshed.products.length, 1);
  assert.equal(refreshed.unlocked, true);
  assert.equal(refreshed.decision, decision);
  assert.equal(refreshed.sections[0], original.sections[0]);
  assert.equal(refreshReportProducts(refreshed, catalog), refreshed);
  assert.equal(
    refreshReportProducts(original, {
      version: "database-unavailable",
      products: [],
    }),
    original,
  );
});
