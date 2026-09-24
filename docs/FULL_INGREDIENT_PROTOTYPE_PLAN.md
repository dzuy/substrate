# Full condition-to-ingredient prototype plan

Date: 2026-09-23
Status: implemented in the isolated prototype. Source gaps remain explicit; product/outcome integrations are exercised with fixtures. See the completion record below.
Source: SUBSTRATE_Condition_to_Ingredient_Engine_v3_HARDENED.xlsx, reviewed read-only.

## Objective and completion boundary

Extend the current isolated face-scan prototype to account for every workbook condition, pathway, ingredient, relationship and relevant rule. Preserve the working OpenAI scan, questionnaire, chips, collapsible quiz and progress feedback. Build the decision engine independently of its UI so the same tested engine can later serve the Expo app.

Full coverage means every source entry has an explicit tested outcome, including missing mapping, not assessed, research-only, unresolved rule and clinician-managed outcomes. It does not mean every condition yields a recommended ingredient or that all workbook data is approved evidence.

Two deliverables distinguish coverage from product integration:
1. Complete condition-to-ingredient evaluation using photos, questionnaire context and declared current treatments.
2. Workbook-wide integration harness using clearly labeled synthetic product/wardrobe/outcome fixtures for product-dependent and learning cases. Actual product recommendations, external integrations and production deployment remain deferred. The paused product databases remain untouched.

## Source audit

The workbook contains 16 conditions/goals, 11 pathways, 14 ingredient nodes, 16 condition-pathway edges, 21 pathway-ingredient edges, 10 governors, four evidence objects, three unresolved clinical rules and nine acceptance scenarios.

Eight conditions have no explicit row in 04_CONDITION_PATHWAY: melasma, dehydration, oil/shine, texture/pores, laxity, volume change, scar support and bruising. The condition descriptions suggest pathways but do not supply executable weighted relationships. P_PIGMENT, P_VASC and P_ADIPOSE have no ingredient edges in 05_PATHWAY_INGREDIENT. Do not silently substitute narrative mentions for approved mappings.

Most pathway-ingredient rows say Pending provenance. E_RET_ACNE is reused for a photoaging relationship with an explicit endpoint-applicability caveat. The evidence admission sheet says even the starter AAD evidence package is pending formal Substrate review. Numeric evidence scores alone are insufficient admission decisions. The workbook describes a pipeline but does not define a complete numerical ranking formula or all modifier coefficients.

## Condition coverage

| Workbook entry | Prototype input route | Mapping work |
| --- | --- | --- |
| Acne | Visible blemishes plus reported pattern/history | Existing four pathway edges; retain subtype distinctions |
| Rosacea / persistent redness | Visible redness plus reported persistence, triggers and diagnosis history | Existing three edges; redness alone does not establish rosacea |
| Post-inflammatory hyperpigmentation | Visible marks plus prior inflammation history | Existing pigment edge; downstream pigment ingredient edges need definition |
| Melasma | Reported diagnosis/history and pigment observations | Missing explicit condition edges; do not diagnose from photo |
| Barrier impairment | Symptoms, recent treatments and visible flaking/redness | Existing barrier edge; prioritize supported recovery context |
| Dehydration / low water content | Reported symptoms/context | Missing explicit edges; photo cannot establish water content |
| Oil / shine | Visible shine when assessable plus reported oil pattern | Missing explicit edges |
| Texture / pores | Existing texture/pore observations plus subtype questions | Missing explicit edges |
| Photoaging / UV damage | Visible component findings plus exposure/protection context | Existing oxidative-stress edge; do not infer causal UV history from appearance |
| Fine lines / wrinkles | Existing fine-line findings plus context | Existing ECM edge; distinguish evidence endpoints |
| Laxity | Reported goal; observations only if assessable | Missing explicit edges; clinical/structural limits represented |
| Facial volume change | Reported goal/history | Missing explicit edges; do not equate topical hydration with volume correction |
| Scar support | Reported scar type/history and clinical plan | Missing explicit edges; scar type/timing required |
| Post-procedure recovery | Reported procedure/type/date/protocol | Existing wound and barrier edges; unresolved procedure rules remain explicit |
| Bruising | Reported context/history; visible discoloration is nonspecific | Missing explicit edges; clinician route represented |
| Healthy-looking glow | Selected composite goal plus component findings | Existing hydration/inflammation/pigment edges; decompose the goal |

## Delivery sequence

### 1. Import and reconcile the complete knowledge data

Create a reproducible workbook extraction step that generates versioned structured data. Preserve canonical IDs, exact source sheet/row, workbook hash and source wording. Validate duplicates, foreign keys, required fields and unsupported references. Import all 16/11/14 entities and all existing edges, including caution/research rows.

Keep three separate layers: unchanged source data; explicitly proposed additions/interpretations; admitted/approved configuration. Produce a coverage report that makes missing edges and evidence visible. Record existing prototype deviations, including its hand-added hydration evidence and simplified governors, rather than treating them as workbook facts.

Ingredient coverage includes the current nine plus panthenol, Centella asiatica, and three distinct Helichrysum entries (extract, hydrolate and essential oil). Form-specific children/aliases may extend broad families such as retinoids and vitamin C without changing the original IDs. Do not inherit evidence across forms or endpoints without an applicability decision.

Deliverable: source manifest, normalized knowledge dataset, discrepancy report and complete coverage matrix.

### 2. Define reusable contracts and package boundaries

Create a UI-independent TypeScript engine with no DOM, Expo, Node-only filesystem or Supabase dependencies. Separate knowledge loading, OpenAI transport and storage adapters from pure evaluation logic.

Input: findings with source/region/uncertainty, timestamped member context, goals, current treatment exposure, optional verified wardrobe expressions, assumed test context, and knowledge/rule versions.

Output: supported care states, pathway priorities, deduplicated ingredient options, evidence applicability, eligibility, missing context, ranked alternatives, action scope, and a decision trace. Keep model confidence, source evidence and recommendation eligibility separate.

The prototype server invokes the shared engine and continues verifying signed scan references. A future Supabase Edge Function can invoke the same engine through a separate adapter; React Native will render the same response contract.

Deliverable: typed input/output schemas and a thin prototype adapter, with current flow preserved during migration.

### 3. Expand observation-to-condition interpretation

Keep the vision model responsible for observable findings, not choosing treatments. Extend the observation schema only where needed and defensible (for example shine), retaining not-assessed and uncertain states. Combine findings with symptoms/history in an explicit condition/phenotype resolver.

Give every condition an input route: visual support, reported context, goal selection, clinician-reported diagnosis, or a combination. Conflicting answers/findings produce a clarification rather than an invented condition. Preserve source attribution and timestamps. Existing eight-concern scans remain usable for supported routes; additional photo fields may require a new scan, with a clear explanation.

Deliverable: all 16 conditions represented with positive, negative, uncertain and unavailable scenarios.

### 4. Make the questionnaire cover actual rule inputs

Use a short core quiz with conditional follow-ups for subtype, symptom persistence, oil/dryness, known diagnoses, prior marks/scars, protection habits, exact treatment class/form, frequency/tolerance, relevant reproductive context and procedure timing/protocol. Ask only when an answer can change the result; unresolved product-specific information stays unknown.

Retain the user-requested prototype age assumption of 40–50 and do not restore Tender / painful. Record the assumption separately; never carry it into production as real user data. Keep defaults, Shuffle and arrow disclosure. Add named synthetic scenarios so testing can intentionally target all conditions and combinations rather than hoping random answers reach them. Synthetic test inputs never become real profile facts.

Deliverable: question-to-rule dependency map and condition-specific test presets.

### 5. Implement pathway matching, evidence and eligibility

Execute supported condition/phenotype → relevant pathways → ingredient edges → evidence/form/endpoint applicability → governors → ranked alternatives. Preserve multiple supporting pathways when deduplicating an ingredient; avoid increasing rank merely because overlapping concerns repeat the same evidence.

Use source 0–3 relevance/evidence scales where present. Formalize textual upweight/downweight instructions and missing aggregation/tie-break rules as versioned proposed policies, with examples for review. Do not present these as original spreadsheet formulas or calibrated clinical probabilities. Separate hard exclusions from softer ranking preferences.

Evaluate each rule at its actual scope. A restriction on one form or condition should not automatically blank all other independent results. Global referral/quality rules retain their defined scope. Replace the prototype's overly broad reproductive/treatment holds with explicit rule applicability and unknown-rule outcomes, without inventing a clinical ruling.

Represent all 10 governors. Preserve CR-001/002/003 as unresolved until a versioned ruling exists. Make evidence admission a separate field from evidence presence. Include all ingredient nodes in coverage; research-only or caution nodes are not automatically recommendable chips.

Deliverable: deterministic engine with reason codes, score components, source lineage and explicit unresolved branches.

### 6. Represent current-care coverage and smallest-change decisions

Use reported treatments for provisional overlap checks, retaining unknown formulation/exposure. Add a fixture adapter for the workbook's sample products and Expression_ID model to exercise separate efficacy coverage, active load, safety relevance and duplication relevance. Do not interpret an ingredient's mere presence as effective coverage.

Evaluate the minimum-change action vocabulary where required inputs support it. Without verified wardrobe/formulation data, return ingredient-level exploration or a coverage question rather than pretending to have a complete product action plan. Preserve clinician control over prescription changes.

Define optional personal outcome records and make global knowledge read-only to the runtime. Test that synthetic personal/cohort outcomes cannot modify global evidence. Full longitudinal learning and real catalog matching remain separate integrations.

Deliverable: real current-treatment context plus labeled synthetic fixtures for product-dependent workbook behavior.

### 7. Finish the prototype experience and inspection tools

Keep Ingredients chips at the top and details below. Separate eligible options from held, research-only or unresolved candidates so visual presence is not mistaken for an approved recommendation. Selecting a concern filters/highlights supporting ingredients; chip selection opens the explanation. Preserve the clean copy and badge removals already requested.

Expose concise empty/result states with exact reasons when a link is unavailable. Add a collapsible prototype-only decision inspector: finding → care state → pathways → ingredient → evidence → rules → outcome. Include dataset/rule versions and source references outside the default consumer flow.

Preserve spinner and recomputation without repeated paid scans. Add an explicit local Save test session / Reopen flow so prototype updates need not force a paid rescan; store/export only on explicit action and make deletion available. Keep saved results versioned, with re-evaluation creating a new result rather than silently rewriting history.

Deliverable: a complete inspectable prototype flow and reproducible saved test sessions.

### 8. Verify coverage, fidelity and portability

Build tests from the workbook's nine specified acceptance cases, not merely from implementation behavior. Use synthetic product, admission and outcome fixtures for the cases requiring those layers; report them as simulated integrations. Clinical-rule approval transitions are synthetic test versions, never real approvals.

Add condition-by-condition coverage, all 14 ingredient identities, missing-edge behavior, evidence applicability, unknown inputs, combinations of concerns, governor scope/precedence, duplicate pathways, no-change behavior, photo quality, stale results, signed tokens, answer edits, mobile layout, keyboard controls and saved-version migration.

Provide a coverage report for every entity, edge and rule: implemented, tested, pending evidence, unresolved policy, fixture-only or deferred external integration. No dropped rows. Live-photo evaluation checks repeatability and usability separately from deterministic workbook tests. Product migration needs a subsequent clinical/evidence review and evaluation across varied photos; passing code tests is not clinical validation.

Deliverable: passing acceptance suite, coverage report, example decision traces and documented main-app migration boundary.

## Completion criteria

- All 16 conditions, 11 pathways, 14 ingredient nodes and existing relationship rows are accounted for.
- Missing source mappings have explicit outcomes; any additions are traceable and distinguished from the source.
- Every displayed ingredient can be traced to the relevant inputs, pathways, evidence and rule versions.
- Unknown, caution, research-only and unresolved are not converted into positive recommendations.
- The nine workbook acceptance scenarios run with their required fixtures and no unsupported integration claims.
- The prototype retains its current UX controls, serves real OpenAI scans and recomputes locally on the server without another model call.
- The portable engine has no prototype UI/storage dependency; the product app is not changed in this phase.

## Future product migration

Reconcile workbook IDs with the existing ingredient catalog; adapt main-app photo findings and daily-questionnaire answers to the shared contracts; replace prototype age/test context with real profile data; add authenticated persistence and owned-product expressions; port the UI to React Native. Run identical evaluation fixtures against the prototype and production adapter before rollout. Product catalog cleanup, real product matching, wearable/lab/environment integrations and personal learning are tracked separately, not silently claimed complete here.

## Implementation completion record

Built the repeatable XLSX importer and explicit activation flow; portable TypeScript evaluator; full workbook snapshot and coverage report; all condition selectors and named synthetic scenarios; conditional context questions; traceable pathway/evidence/governor results; grouped ingredient chips and decision inspector; explicit local save/reopen and versioned decision history. Workbook source data is separate from proposed interpretation policies.

Added future-file compatibility checks for reordered rows/columns, additive columns, changed records, broken references and schema changes. Policy-affecting updates require an explicit review acknowledgement before activation. New condition/ingredient data can be traversed without modifying selection code; new observation vocabularies, endpoint meanings or clinical behaviors still need a reviewed adapter.

The nine workbook acceptance tests run against portable product/expression, no-buy, clinical-version, evidence admission and personal/global isolation functions using synthetic fixtures. Those functions are ready for adapters but are not connected to a real catalog or personal learning feed. This distinction is surfaced in the README and coverage tools.

Preserved user-requested age 40–50 test assumption, removed Tender / painful option, Shuffle, quiz arrows, Ingredients title/chips and spinner. Original source workbook and paused product spreadsheets are unchanged.

Verification: 48 Node tests (including the nine workbook acceptance scenarios) and four Python importer compatibility tests pass. TypeScript checking, lint (one preexisting environment-service warning) and web export pass. Browser QA confirmed scenario resolution, chip navigation, explicit save/reopen after refresh, desktop/mobile layouts and no browser warnings/errors. No real photo was sent for a paid OpenAI evaluation during this implementation.
