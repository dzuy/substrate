# Face Scan Lab

OpenAI photo findings + questionnaire → workbook pathways → ingredient options. This isolated prototype does not change Expo screens, the daily questionnaire, Supabase records or the paused product databases.

## Run

Node 22 and the repository's installed TypeScript compiler are required.

```sh
npm run prototype:face-scan
```

This compiles the portable engine, then serves http://localhost:4317/face-scan-prototype on loopback. The root `.env` supplies `OPENAI_API_KEY`, optional `OPENAI_VISION_MODEL`, `FACE_SCAN_PROTOTYPE_PASSWORD` (required when hosted; ignored on localhost), and optional `FACE_SCAN_SIGNING_SECRET`. These are server-only variables. Never prefix secrets with `EXPO_PUBLIC_`. YouCam is removed; external credentials have not been changed.

One Analyze action makes one paid OpenAI vision call. Answer edits reuse the signed result. Synthetic scenarios make no OpenAI calls and display an explicit synthetic image. To return to a real scan, upload a photo or start a new experiment.

## Workbook ingestion and updates

The standard-library Python importer reads XLSX without editing it or requiring a spreadsheet package:

```sh
python3 prototypes/face-scan/import-workbook.py /absolute/path/updated.xlsx
```

The default stages an immutable snapshot and report under `knowledge/versions/workbook-<hash>/`. Read `report.json`: it contains counts, errors, missing mappings, and added/removed/changed records compared with the active version. Then activate explicitly:

```sh
python3 prototypes/face-scan/import-workbook.py /absolute/path/updated.xlsx --activate
```

Restart the prototype after activation. Re-evaluate a saved scan to create a new decision version. Historical decisions keep their old knowledge/rule versions. Restore an earlier `knowledge/versions/<version>/knowledge.json` to `knowledge/active.json` and restart to roll back; do not overwrite archived snapshots.

Column and row reordering and additive columns are supported. Stable canonical IDs and named table headers identify relationships. Duplicate IDs/edges, broken references, removed/renamed columns, invalid scores, formulas, missing tables and unsupported schemas fail rather than silently misread data. Added conditions appear in the selector and scenario list; new visual or evidence endpoint vocabularies require an explicit adapter. The engine never guesses novel clinical interpretations.

Changes to governors, clinical rules, decision stages, modifiers, firewall, admission, action or acceptance tables require policy implementation review before activation. After that review and any needed code/tests, `--policy-reviewed --activate` acknowledges it. This is an engineering acknowledgement, not evidence admission or clinical approval. Data-only mapping/name/score changes do not require rewriting the engine.

The original file generated `workbook-e01b98a69808a24a`: 24 preserved sheets, 16 conditions, 11 pathways, 14 ingredients, 16 condition edges, 21 ingredient edges, 10 governors, four evidence objects, three unresolved clinical rules and nine acceptance scenarios.

## Architecture

- `packages/ingredient-engine/src`: pure TypeScript contracts, pathway evaluator, explicit interpretation policy, and product/evidence integrity functions. No UI, Node filesystem, Expo or Supabase dependencies. Its generated `dist/` is built automatically before local start, tests and web export.
- `knowledge/active.json`: imported source data, separate from the interpretation policy. `knowledge/versions/` retains source snapshots and import reports. The full raw worksheets are retained alongside normalized tables.
- `ingredients.mjs`: thin adapter that loads the active dataset, validates questions and supplies the explicit prototype age assumption of 40–50.
- `handler.mjs`: authenticated/same-origin API for scans, signed-result resolution, config/coverage and labeled synthetic scenarios. Hosted mode fails closed without a password.
- `public/questions.mjs`: clickable questions, conditional follow-ups, defaults, valid shuffling and named scenarios. Selected concerns are not clinician diagnoses.
- `public/app.js`: photo/overlay display, ingredient chips, eligibility details, decision inspector, questionnaire, spinner and explicit local session saving.

The engine ranks using the maximum pathway relevance × applicable evidence score, plus one point for a selected goal/condition. Multiple overlapping routes do not sum into inflated evidence. Textual modifiers use explicit capped one-point prototype adjustments; these are not spreadsheet formulas or calibrated probabilities. Trace records preserve every route, source row, evidence ID and rule code.

Eight conditions lack explicit source edges. `policy.ts` provides labeled provisional narrative-derived routes, and provisional pigment edges fill another graph gap. Where no ingredient relationship exists (for example the adipose pathway), the result says so. New source edges supersede the missing-condition fallback. Proposed relationships cannot alone yield an eligible option.

Evidence must match the linked ingredient and a supported endpoint vocabulary. Acne guideline support is not transferred to redness/photoaging. Form families, research-only entries and unknown eligibility remain explicit. The original admission package is still pending; eligible cards are provisional prototype exploration options, not production-approved recommendations. Unlike the first partial prototype, this version does not silently promote hydration evidence from outside the workbook. Adding those reviewed evidence objects is a dataset task.

## Test experience

Open **Prototype test tools & workbook coverage** for 16 named condition scenarios. A synthetic scenario drives the real evaluator but not the vision model. The coverage view accounts for every entity and identifies missing/proposed links, rule states, and unassessed external modifiers. Ingredient chips separate eligible options from links needing context/evidence review. The decision inspector exposes state → pathway → ingredient → evidence → rule traces.

Current treatments support provisional overlap checks. The product/formulation/no-buy and evidence-firewall functions are tested with synthetic fixtures corresponding to the workbook's acceptance cases. There is no live catalog or longitudinal learning integration. No product purchase or prescription-change plan is emitted.

Wearables, biomarkers, cycle history and other external feeds remain explicitly unassessed when absent. Available questionnaire climate/travel, protection and life-stage inputs can modify priorities. The assumed age is a testing setting and must be replaced by real profile context in the product adapter.

## Saving, privacy and versions

Photos and answers stay in page memory until **Save test session** explicitly writes to this browser's IndexedDB. Saved sessions contain the photo, questionnaire, signed analysis, results, decision history and notes. Export JSON contains the same sensitive data. Delete removes that local saved record; it does not delete provider records. Old YouCam data remains readable and is never resumed or remotely deleted.

The questionnaire is evaluated on the prototype server; it is not sent in the vision prompt. OpenAI requests set `store: false`; provider retention policies still apply. Scan references expire after 24 hours and become invalid if the signing key changes. Historical results can still be reopened after expiry, but new evaluation needs a valid reference/new scan. Saving is not cross-device storage.

A new photo invalidates findings. Answer revisions and request sequence guards reject stale responses. A new evaluation appends a versioned result; saved historical decisions are not overwritten automatically. Old incompatible questionnaires preserve their saved result and request current answers.

## Validation

```sh
npm run test:face-scan
python3 prototypes/face-scan/import_workbook_test.py
npx tsc --noEmit
npm run lint
npm run build:web
```

The suite includes all 16 condition routes, all 14 ingredient identities, source/update compatibility, eligibility and evidence scope, signed scan reuse and nine workbook acceptance cases. The latter use explicit synthetic product/outcome/admission objects: passing them is not clinical validation or proof of a production integration. Browser checks cover synthetic resolution, chips, quiz edits and local save/reopen. No live paid photo scan is part of automated validation.

## Hosting and migration

`npm run build:web` compiles the engine, exports Expo and copies the prototype public assets. The existing Vercel API uses the same adapter. Hosting is prepared, not deployed. Validate a protected preview before promotion.

For the product app, adapt its photo findings/profile/questionnaire to the shared contracts, reconcile workbook ingredient IDs with the catalog, add authenticated persistence, and render the response in React Native. Real product expressions, external signals, longitudinal learning and evidence/clinical approval remain separate integrations. See `docs/FULL_INGREDIENT_PROTOTYPE_PLAN.md` and `docs/CONDITION_TO_INGREDIENT_ENGINE.md` for the tracked scope.

### Curated product suggestions

Ingredient results now include `productSuggestions` from the portable product matcher. The independent catalog lives in `catalog/curated-products.json`; increment its version when product facts change and verify official brand links, US formulations, concentrations and required treatment IDs. Only eligible ingredients may match. Product cards sit above Concern signals and retain source links, catalog version and knowledge/rule provenance in saved results. These are alternative ingredient matches, not a prescribed routine or finished-product efficacy assessment. No external product database is connected. Run `npm run test:face-scan` for eligibility, deduplication and context regression coverage.

Catalog v2 now contains 12 products. `productSuggestions.items` remains eligible matches; `demoItems` contains visibly labeled catalog examples for unresolved support-ingredient links. Demo examples do not admit evidence or override holds. See the latest workflow-demo entry in `docs/CONDITION_TO_INGREDIENT_ENGINE.md` for exact exclusions.
