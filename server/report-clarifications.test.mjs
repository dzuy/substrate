import test from "node:test";
import assert from "node:assert/strict";
import { clarifyReport } from "../shared/report-clarifications.mjs";

test("saved reports separate context from evidence gaps without changing eligibility or findings", () => {
  const card = {
    ingredientId: "I_AZA",
    name: "Azelaic acid",
    status: "needs_context",
    job: "Ingredient role",
    conditionIds: ["C_ROSACEA"],
    reasons: [
      "Review exact ingredient/formula allergy context.",
      "Relationship is represented; missing or mismatched evidence is not treated as approval.",
      "Includes a proposed link derived from workbook descriptions.",
    ],
    trace: [{ origin: "proposed narrative mapping" }],
  };
  const report = {
    decision: {
      cards: [card],
      states: [
        {
          conditionId: "C_ROSACEA",
          name: "Rosacea / persistent redness",
          source: "photo + questionnaire",
        },
      ],
    },
    products: [],
    sections: [
      {
        id: "observations",
        items: [{ label: "Redness", body: "Original photo finding." }],
      },
      {
        id: "ingredients",
        intro: "Old copy",
        items: [
          {
            label: "Azelaic acid",
            ingredientId: "I_AZA",
            body: "Old technical text",
          },
        ],
      },
    ],
  };
  const clarified = clarifyReport(report);
  const ingredient = clarified.sections[1].items[0];
  assert.equal(ingredient.evidence, "More information needed");
  assert.match(
    ingredient.clarifications.find((n) => n.label === "Why this is linked")
      .body,
    /Redness context \(photo finding \+ your answers\)/,
  );
  assert.match(
    ingredient.clarifications.find(
      (n) => n.label === "What needs clarification",
    ).body,
    /allergies/,
  );
  assert.match(
    ingredient.clarifications.find(
      (n) => n.label === "Evidence still under review",
    ).body,
    /inferred/,
  );
  assert.match(clarified.sections[1].intro, /does not diagnose/);
  assert.equal(clarified.decision, report.decision);
  assert.equal(clarified.products, report.products);
  assert.equal(clarified.sections[0], report.sections[0]);
  assert.equal(report.sections[1].items[0].body, "Old technical text");
  assert.deepEqual(clarifyReport(clarified), clarified);
});

test("legacy reports without stored decisions retain their contents and gain the section explanation", () => {
  const report = {
    sections: [
      {
        id: "ingredients",
        intro: "Old copy",
        items: [{ label: "Ingredient", body: "Preserved content" }],
      },
    ],
  };
  const clarified = clarifyReport(report);
  assert.deepEqual(clarified.sections[0].items, report.sections[0].items);
  assert.match(clarified.sections[0].intro, /provisional or inferred/);
});
