import test from "node:test";
import assert from "node:assert/strict";
import { createReportHandler } from "./skin-report.mjs";
import { buildReport } from "./report-builder.mjs";
import {
  reportQuestions,
  validateReportAnswers,
} from "../shared/report-questions.mjs";
import { renderReportPdf } from "./report-pdf.mjs";
const uid = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
import { fixtureAnswers, fixtureScan } from "./test-fixtures/report.mjs";
const catalog = {
  version: "database-test",
  region: "US",
  verifiedAt: "2026-10-07",
  products: [],
};
const env = {
  EXPO_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-public",
  OPENAI_API_KEY: "secret-test",
  OPENAI_VISION_MODEL: "gpt-5.6-sol",
};
const json = (v) =>
  new Response(JSON.stringify(v), {
    headers: { "content-type": "application/json" },
  });
async function invoke(handler, body, extra = {}) {
  let status, headers, bytes;
  await handler(
    {
      method: "POST",
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
        host: "example.test",
        ...extra,
      },
      body,
    },
    {
      writeHead: (s, h) => {
        status = s;
        headers = h;
      },
      end: (b) => {
        bytes = b;
      },
    },
  );
  return {
    status,
    headers,
    bytes,
    data:
      headers?.["Content-Type"] === "application/json"
        ? JSON.parse(bytes)
        : null,
  };
}
function setup() {
  let userId = uid,
    scans = 0,
    catalogOutage = false;
  const calls = [];
  const fetcher = async (url, options) => {
    const path = new URL(url).pathname;
    calls.push({ path, options });
    if (path === "/auth/v1/user") return json({ id: userId });
    if (path.endsWith("/get_recommendation_catalog"))
      return catalogOutage ? new Response("", { status: 503 }) : json(catalog);
    if (path.endsWith("/deleted_skin_reports")) return json([]);
    if (path.endsWith("/rpc/permanently_delete_skin_report")) return json(null);
    if (path.endsWith("/products")) return json([]);
    if (path.endsWith("/skin_reports")) return json([]);
    throw Error("Unexpected endpoint");
  };
  const handler = createReportHandler({
    env,
    fetcher,
    providers: {
      openai: async () => {
        scans++;
        return fixtureScan;
      },
    },
  });
  return {
    handler,
    calls,
    get scans() {
      return scans;
    },
    setUser: (id) => {
      userId = id;
    },
    outage: () => {
      catalogOutage = true;
    },
  };
}
test("combined questionnaire retains safety gates and daily context, removes hidden stale answers", () => {
  for (const id of [
    "allergy",
    "reproductive",
    "treatments",
    "sleep",
    "stress",
    "activity",
    "cycle",
    "ageBand",
  ])
    assert.ok(reportQuestions.some((q) => q.id === id));
  assert.throws(
    () => validateReportAnswers({ ...fixtureAnswers, allergy: undefined }),
    /allergies/,
  );
  assert.throws(
    () =>
      validateReportAnswers({
        ...fixtureAnswers,
        treatments: ["None", "Retinoid"],
      }),
    /own/,
  );
  assert.equal(
    validateReportAnswers({ ...fixtureAnswers, procedure: "Planned procedure" })
      .procedure,
    undefined,
  );
});
test("report uses the supplied age, preserves provisional decisions and never substitutes sample products", () => {
  const r = buildReport({
    scan: fixtureScan,
    answers: fixtureAnswers,
    catalog,
  });
  assert.equal(r.decision.assumedContext.ageBand, "30–49");
  assert.equal(r.sections.length, 12);
  assert.equal(r.paymentMode, "simulation");
  assert.equal(r.products.length, 0);
  assert.match(
    r.sections.find((s) => s.id === "products").items[0].label,
    /No eligible/,
  );
  assert.ok(
    r.sections
      .find((s) => s.id === "observations")
      .items.some((i) => i.body === "Test blemish evidence."),
  );
  assert.equal(r.provenance.catalogVersion, "database-test");
  const minor = buildReport({
    scan: fixtureScan,
    answers: { ...fixtureAnswers, ageBand: "Under 18" },
    catalog,
  });
  assert.equal(minor.decision.assumedContext, undefined);
  assert.ok(minor.decision.cards.every((c) => c.status !== "candidate"));
});
test("poor photo cannot generate a report", () =>
  assert.throws(
    () =>
      buildReport({
        scan: {
          ...fixtureScan,
          analysis: { ...fixtureScan.analysis, faceDetected: false },
        },
        answers: fixtureAnswers,
        catalog,
      }),
    /Retake/,
  ));
test("API authenticates before provider work and rejects cross-origin requests", async () => {
  const s = setup();
  assert.equal(
    (await invoke(s.handler, { action: "scan" }, { authorization: "" })).status,
    401,
  );
  assert.equal(
    (
      await invoke(
        s.handler,
        { action: "scan" },
        { origin: "https://evil.test" },
      )
    ).status,
    403,
  );
  assert.equal(s.scans, 0);
});
test("signed scan is reusable without another provider call, bound to its account, and detects tampering", async () => {
  const s = setup();
  const scan = await invoke(s.handler, { action: "scan", image: "fixture" });
  assert.equal(scan.status, 200);
  const body = {
    action: "generate",
    scanToken: scan.data.scanToken,
    answers: fixtureAnswers,
    mode: "optimize",
  };
  assert.equal((await invoke(s.handler, body)).status, 200);
  assert.equal((await invoke(s.handler, body)).status, 200);
  assert.equal(s.scans, 1);
  assert.equal(
    (await invoke(s.handler, { ...body, scanToken: body.scanToken + "x" }))
      .status,
    400,
  );
  s.setUser(other);
  assert.equal((await invoke(s.handler, body)).status, 400);
});
test("catalog outage is retryable instead of producing fake product recommendations", async () => {
  const s = setup();
  const scan = await invoke(s.handler, { action: "scan", image: "fixture" });
  s.outage();
  const result = await invoke(s.handler, {
    action: "generate",
    scanToken: scan.data.scanToken,
    answers: fixtureAnswers,
    mode: "fresh",
  });
  assert.equal(result.status, 503);
  assert.match(result.data.error, /catalog/);
});
test("saved report ownership comes from auth and unlock has no payment call", async () => {
  const s = setup();
  const report = buildReport({
    scan: fixtureScan,
    answers: fixtureAnswers,
    catalog,
  });
  await invoke(s.handler, { action: "save", report, user_id: other });
  const request = s.calls.find((c) => c.path.endsWith("/skin_reports"));
  assert.equal(JSON.parse(request.options.body).user_id, uid);
  assert.equal(JSON.parse(request.options.body).simulated_unlocked, undefined);
  assert.match(request.options.headers.Prefer, /resolution=ignore-duplicates/);
  const result = await invoke(s.handler, { action: "unlock", id: report.id });
  assert.equal(result.status, 404);
  assert.ok(s.calls.every((c) => !c.path.includes("stripe")));
});
test("PDF is a real multipage file and export requires a simulated unlock", async () => {
  const report = buildReport({
    scan: fixtureScan,
    answers: fixtureAnswers,
    catalog,
  });
  const s = setup();
  assert.equal(
    (await invoke(s.handler, { action: "pdf", report })).status,
    400,
  );
  const pdf = await renderReportPdf({ ...report, unlocked: true });
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.length > 10000);
});

test("published catalog products match actual ingredient decisions and existing coverage remains visible", () => {
  const product = {
    id: "33333333-3333-4333-8333-333333333333",
    name: "QA fixture",
    brand: "Test",
    format: "test",
    sourceUrl: "https://example.test/fixture",
    expressions: [
      {
        ingredientId: "I_SA",
        label: "Salicylic acid",
        role: "primary",
        concentration: null,
      },
    ],
    requiredEligibleIds: ["I_SA"],
    note: "Test only",
  };
  const matched = buildReport({
    scan: fixtureScan,
    answers: fixtureAnswers,
    catalog: { ...catalog, products: [product] },
    wardrobe: [product],
  });
  assert.equal(matched.products[0].id, product.id);
  assert.equal(matched.products[0].owned, true);
  const covered = buildReport({
    scan: fixtureScan,
    answers: { ...fixtureAnswers, routine: "Yes, comfortable and working" },
    catalog: { ...catalog, products: [product] },
    wardrobe: [product],
  });
  assert.equal(covered.products.length, 0);
  assert.equal(
    covered.sections.find((s) => s.id === "wardrobe").items[0].evidence,
    "KEEP IF TOLERATED",
  );
  const held = buildReport({
    scan: fixtureScan,
    answers: { ...fixtureAnswers, feel: "Stinging / burning" },
    catalog: { ...catalog, products: [product] },
    wardrobe: [product],
  });
  assert.equal(held.products.length, 0);
  assert.equal(
    held.sections.find((s) => s.id === "wardrobe").items[0].evidence,
    "REVIEW BEFORE USE",
  );
});

test("permanent deletion validates IDs and invokes the owner-scoped atomic RPC", async () => {
  const s = setup();
  assert.equal(
    (await invoke(s.handler, { action: "delete", id: "invalid" })).status,
    400,
  );
  const result = await invoke(s.handler, { action: "delete", id: uid });
  assert.equal(result.status, 200);
  assert.equal(result.data.deleted, true);
  const call = s.calls.find((c) =>
    c.path.endsWith("/rpc/permanently_delete_skin_report"),
  );
  assert.deepEqual(JSON.parse(call.options.body), { target_id: uid });
  assert.equal(call.options.headers.Authorization, "Bearer token");
});
test("deleted reports return a definitive 410 rather than a cached fallback", async () => {
  const handler = createReportHandler({
    env,
    fetcher: async (url) =>
      new URL(url).pathname === "/auth/v1/user"
        ? json({ id: uid })
        : json([{ id: uid }]),
  });
  for (const body of [
    { action: "get", id: uid },
    { action: "save", report: { id: uid } },
    { action: "unlock", id: uid },
  ]) {
    const result = await invoke(handler, body);
    assert.equal(result.status, 410);
    assert.equal(result.data.code, "REPORT_DELETED");
  }
});

test("daily summary experience preserves legacy reports without adding a purchase or unlock", async () => {
 const s=setup();const scan=await invoke(s.handler,{action:'scan',image:'fixture'});
 const body={action:'generate',scanToken:scan.data.scanToken,answers:fixtureAnswers,mode:'optimize'};
 const legacy=await invoke(s.handler,body);assert.equal(legacy.data.report.price,79);assert.equal(legacy.data.report.experience,undefined);
 const daily=await invoke(s.handler,{...body,experience:'daily-summary-v1'});assert.equal(daily.status,200);assert.equal(daily.data.report.price,0);assert.equal(daily.data.report.experience,'daily-summary-v1');assert.equal(daily.data.report.unlocked,false);assert.equal(daily.data.report.paymentMode,'simulation');
 assert.ok(s.calls.every(c=>!c.path.includes('stripe')));
});
