# Product database and CMS

The app's Supabase database is the editing source of truth. `/admin-products` is the CMS, available from Profile to accounts with `admin` or `catalog_admin` in trusted Supabase app metadata. Drive workbooks are import sources; CMS saves never write back to them.

## September 8, 2026 import

Source: `Substrate_Skincare_Product_Database_v10_0_PILOT_BATCH_1_CLOSED`, modified September 8 at 23:26:37 UTC. `data/catalog/source-v10.json` captures all ten tabs with source ID, timestamp, exact row values, and sheet names.

- 285 canonical records: 191 finished products, one kit, and 93 other entities.
- 192 records link to the app's `products` table. Two existing records match exactly: C E Ferulic and Epicutis Lipid Serum. Their UUIDs and ingredient/wardrobe references survive.
- 190 new products enter as unpublished, with `needs_review` status. Publication is an explicit CMS control, separate from the source's pilot verification labels.
- Six legacy products absent from v10 are archived per the user's instruction. Archive preserves existing wardrobe references; Restore returns a product to an unpublished review state.
- 411 reviews are retained. Forty shifted rows are aligned on import; ten repeated source review IDs are preserved as evidence, while every database review uses its stable source-row ID.
- 421 valid Master links are imported. Seventy links to missing/retired IDs remain in the immutable snapshot and are listed in `import-report.json` for reconciliation; they are not reassigned by fuzzy matching.
- Source formula strings, dates, regional variants, clinical notes and all 41 canonical fields are retained. INCI text was preserved by the initial import. The subsequent ingredient backfill described below links usable formulas without activating recommendation rules.

## Tables

| Table | Role |
| --- | --- |
| `products` | Real app product identity, display fields, status, publication and archive state |
| `catalog_records` | One source record per SKP ID, optional link to a product UUID, editable private evidence |
| `catalog_imports` | Original immutable workbook snapshot and provenance |
| `catalog_master_links` | Source-derived category relationships to retained canonical records |
| `catalog_reviews` | Review workflow with status, resolution note and original source fields |
| `catalog_changes` | Before/after audit for products, ingredient links, evidence and review changes |

Admin-only RLS protects the source/review/history tables. Members can read published active products and product records already referenced by their own wardrobe. Import snapshots have no client insert/update/delete policies. New data access must preserve these boundaries.

## CMS workflow

Search by name, brand, alias or SKP ID. Filter by availability, category, brand, product type, and ingredient completeness. Edit a product to maintain display information, ingredients, publication, and grouped source evidence. Use the product's Issues tab to track unresolved issues; resolution notes are optional. Change history lists recent database changes.

`save_catalog_product` saves product fields, ingredient links and evidence in one transaction. Both product and source timestamps protect against concurrent edits. An ingredient validation failure rolls back the whole save. Existing ingredient concentrations and notes survive edits.

Non-product entities are viewable separately and cannot be published as retail products. Conversion of a generic family, Rx entity or procedure into a specific product is a subsequent curated workflow. Manually created products receive an editable CMS source record on their first save. Original imported records and snapshots remain preserved.

## Reproduce and verify

```sh
node scripts/catalog-import.mjs
node --test scripts/catalog-import.test.mjs
npx tsc --noEmit
npm run lint
npm run build:web
```

The import generator performs no network writes. It writes `data/catalog/import-v10.sql` and `import-report.json`. Apply the schema migration before the import SQL. Inspect the report and target project first. The SQL is transactional and skips existing source/review/link IDs so replay does not overwrite later CMS edits. It fails on ambiguous product/brand matches, preserves strength and format variants, and does not delete products or ingredients.

`supabase/tests/catalog_cms.sql` performs rollback-only integration checks on the imported catalog: identity preservation, atomic failure, successful save, conflicting edits, audit attribution and member access restrictions. It assumes the initial imported counts; update those fixtures deliberately when catalog scope changes.

The local pre-import backup `data/catalog/live-backup-20260908.json` contains catalog data and a wardrobe reference count, with no personal wardrobe contents. It is ignored by Git.

## Desktop workspace

The web admin uses a full-width desktop layout with its own navigation, separate from the consumer app. Availability, Brand (searchable), Category, product type, and ingredient completeness filters combine in the left rail. Products are searchable and sortable, with 25 rows per page. Filters are retained when opening and closing an editor.

Clicking a product row or New product opens a right-side slide-out drawer, keeping the table and filters in place behind it. The drawer supports Escape, outside-click and close-button dismissal with unsaved-change protection, keyboard focus containment, and reduced-motion preferences. Product editing uses Overview, Formula & sources, Directions, Evidence, Ingredients, Issues, and History tabs. Save controls remain visible, Cmd/Ctrl+S saves product changes, and Cmd/Ctrl+K focuses catalog search. Closing an edited product prompts before discarding changes. Source library is hidden from navigation; its research records remain preserved. The Issues tab shows product-specific data problems and resolution actions. Issue details omit the redundant affected-product editing block; optional resolution notes remain available.

## Ingredient backfill

`scripts/catalog-ingredients.mjs` parses the current database copy of Products_Canonical column O, using a fresh backup in `data/catalog/ingredients-before.json`. It separates active/inactive sections, retains numeric commas and parentheses, extracts only explicit percentages, and matches existing names, INCI names, or aliases without fuzzy merging. Original formula text and existing link metadata are preserved. Positions follow the source list, including alphabetic drug-label lists; they do not imply concentration.

The September 8 backfill added 913 ingredient records and 3,135 associations across 124 products. The 68 missing, partial, historical, or annotated formulas are listed with their original text in `data/catalog/ingredients-report.json` for review; these were not converted into ingredient names. Formula text edits in the CMS do not automatically rerun this backfill.

The generated SQL checks for changed source text, runs transactionally, and preserves existing associations on replay. Live backup files and generated SQL are excluded from Git. Parser tests: `node --test scripts/catalog-ingredients.test.mjs`.

## September 30 brand workbook import

The shared Product Databases folder supplied 224 original Excel files. All worksheet cells and file metadata are preserved in 224 immutable `catalog_imports` snapshots. SHA-256 comparison identified 186 distinct workbooks and 38 identical extra uploads. Same-name/same-size archive mapping was checked: no such group contained differing bytes.

The import retained 4,227 product source rows, including LALAIS's supplement and accessory listed only in its summary. Exact brand/name/variant grouping produced 4,165 catalog identities: 4,158 new products and seven existing matches. Sixty-two overlapping rows remain as additional `catalog_sources` evidence. The live database contains 4,356 products, including six previously archived products. All 198 pre-existing product records and seven wardrobe references were verified unchanged. This is a count of catalog records, not a claim that every source family has a fully resolved sellable SKU.

New products are unpublished, `needs_review`, and recommendation-disabled. There are 4,149 new review items. Full unverified ingredient text is retained on 471 new records; 436 formulas parsed into 12,830 ingredient associations, using 1,877 new ingredient library entries. Thirty-five full-text records require manual token normalization. The remaining new records have 1,407 missing, 1,047 partial, 1,208 unresolved, and 25 not-applicable ingredient statuses. Device bundles can contain topical components; a not-applicable device status does not verify those component formulas.

Prices/currencies need review on 2,792 imported identities, and 2,676 have incomplete variant identity. Some workbooks intentionally collapse sizes, shades, sets, or packaging into one family. Those facts cannot be reconstructed from the file alone. Explicit variants stay separate; uncertain same-name rows stay separate and unpublished. Exact spelling matching also preserves uncertain brand aliases rather than merging them by guesswork. Product type and category are provisional classifications that admins should confirm. Source claims and instructions remain private evidence; missing descriptions, images, barcodes, concentrations, and market details are not invented.

The CMS uses server-side search/filter/sort and 25-product pages, with complete counts beyond Supabase's default row cap. Brand and ingredient libraries and review links traverse every page. Full product/evidence details load on opening the drawer. Filters include product type, ingredient completeness, and source file, including identical-file copies and the earlier pilot import. The Formula & sources tab shows original workbook rows, and Product details stores commercial metadata.

### Publishing workflow

Publishing is the single approval action. There are no separate product verification, mapping approval, or recommendation enablement controls. Internal compatibility fields (`status`, `approved`, `recommendation_enabled`, and the formula approval state) are derived atomically from publication; drafts never enter matching.

1. Confirm product type, exact variant, market, and official product URL.
2. In **Ingredients**, enter the full formula, parse ingredient links, and resolve ambiguous names. Completeness describes the available data; it is not a separate approval. The editor checks that linked ingredient identities match the full formula before publishing.
3. In the same tab, map relevant formula ingredients to the matching library and select primary/support roles.
4. Select **Published** and save. That save approves the product, complete formula, and its mappings together. Missing formula data, linked ingredients, or primary topical mappings block publication with an actionable message. Devices/accessories and bundles may publish without a single topical formula; the current matcher continues to support individual topical products only.

Unpublishing removes matching eligibility. Direct edits to ingredient links, mappings, or formula text outside the atomic save return the product to draft. CMS saves of a published product revalidate and approve the final data in the same transaction. A failed publication rolls back the whole save; stale timestamps reject conflicting edits. Legacy published products remain published, but incomplete or unmapped records stay outside the matching projection until corrected.

Migration `202609300004` implements this workflow without widening member access to evidence or snapshots. Existing admins may create only source records for CMS-authored products under the fixed manual provenance container. Rollback-only checks in `supabase/tests/catalog_publishing.sql` cover publication, automatic matching eligibility, incomplete-data rejection, atomic failure, conflicting edits, unpublishing, formula invalidation, devices, manual source records, audit, and member access.

`get_recommendation_catalog` exposes approved retail facts to authenticated users. The face-scan handler uses this live projection and the existing same-origin app session. Missing/expired sign-in or a catalog outage returns no product matches; it never substitutes the static demo catalog. Ingredient/condition evidence still requires its own clinical review; publication does not validate diagnostic or treatment claims.

### Reproduction and recovery

The September 30 pre-import backup is `data/catalog/live-backup-20260930.json`, ignored by Git. Original workbooks, extracted snapshots, prepared rows, generated SQL, batch checkpoints, file manifests and detailed reports are also local ignored data. Private Drive identifiers and research rows are retained locally and in the protected database rather than published to the source repository.

```sh
python3 scripts/catalog-workbooks.py /path/to/Product-Databases.zip
python3 scripts/catalog-stage.py
node scripts/catalog-brand-import.mjs
node --test scripts/catalog-brand-import.test.mjs scripts/catalog-ingredients.test.mjs
```

Apply migrations `202609300001` through `202609300003` to the verified linked Substrate project before importing. `scripts/catalog-apply-batches.mjs` requires an explicit `--apply` and an authenticated `SUBSTRATE_SUPABASE_CLI` path. It applies 66 sequential transactions, checks generated SQL hashes, and records successful batches locally. Replaying unchanged batches skips existing IDs and preserves CMS edits. Do not regenerate against a different backup and reuse old checkpoints. Unknown transaction outcomes can safely replay the exact same SQL; changed batches require investigation.

Validation included a representative rollback-only batch before import, final table/source reconciliation, unchanged original-record comparison, completed-batch replay without duplicate counts, and rollback-only tests in `supabase/tests/brand_catalog.sql` and `supabase/tests/catalog_cms.sql`. The latter counts the original pilot explicitly so expanding the catalog does not weaken its identity, atomic-save, concurrency, audit, and member-access assertions.

### Ingredient note cleanup

Migration `202609300005` separates recognized note-only placeholders from actual formula text. Source prose is preserved as **Ingredient source notes** in Formula & sources; immutable workbook snapshots and source rows remain unchanged. Empty formulas become `missing`, while existing `not_applicable` classifications and devices/accessories retain that status. Actual ingredient lists and mixed entries containing ingredient names are left intact. No ingredient associations are removed.

The same conservative classifier is used by `scripts/catalog-stage.py`; database normalization prevents these placeholders from returning on later CMS saves. Parser guards also prevent common placeholders from becoming ingredient identities. Regression checks: `python3 scripts/catalog_formula_notes_test.py`, `node --test scripts/catalog-ingredients.test.mjs`, and rollback-only `supabase/tests/catalog_ingredient_notes.sql`.

## October 20 incremental workbook import

The Drive folder grew from 224 to 737 workbooks. All 513 new files were downloaded, size-checked, opened, and captured with their complete worksheet contents. SHA-256 and worksheet comparisons found 506 distinct new workbooks and seven duplicate uploads; none duplicated a previously imported workbook. Four unique workbooks contained technology research or an empty product audit rather than product rows. All 513 files remain preserved as immutable snapshots.

The final import added 6,406 product drafts from 6,673 source rows. Another 202 rows matched existing products and were attached as source evidence without changing their canonical CMS records. Sixty-five uncertain identities were held as source evidence and review issues. New products remain unpublished and recommendation-disabled. The database now contains 10,762 products, 709 brands, 4,895 ingredients, 10,900 source rows, and 739 workbook/import snapshots. The import added 12,813 ingredient associations and 6,671 review issues.

Matching uses both current CMS names and historical source identities, preserves explicit variants, and supports individually reviewed brand aliases. A shared URL does not establish product identity. A further near-name audit resolved six additional duplicate identities and held 26 uncertain overlaps. Their 32 newly inserted drafts were removed in a guarded transaction after verifying that they had no CMS edits, publication, wardrobe references, or reviewed mappings. Their source rows and reviews were retained. No pre-existing products were removed.

Each data transaction locks the affected catalog tables and compares every pre-existing row before commit, including reviews and ingredient mappings. Canonical records are skipped before insertion when their source ID already exists; this prevents metadata triggers from overwriting CMS edits during a retry. A rollback-only replay with simulated CMS changes verified that notes, variant, price, and description survive.

Final readback verified all 4,356 original products, 242 brands, 3,577 ingredients, 4,443 canonical CMS records, 4,227 source rows, 15,978 ingredient links, and 927 reviewed engine mappings unchanged. The 226 original import identifiers, hashes, and modification timestamps also matched. All new source mappings, snapshot hashes, review IDs, and unpublished draft states passed verification. The importer and ingredient regression suites passed 25 JavaScript tests and four Python tests.

### Audit and recovery

The ignored `data/catalog/october-2026/` directory contains original workbooks, manifests, snapshots, pre-import backups, duplicate decisions, staging data, SQL batches, completion hashes, overlap reconciliation, and final verification. `settled-report.json` describes the final result; `verification.json` records the comparison with the original CMS data. Preserve both the original batch plan and the subsequent overlap settlement for recovery.

The incremental tooling is separate from the September import:

```sh
python3 scripts/catalog-stage.py /path/to/stage-snapshots.json /path/to/batch-directory
node scripts/catalog-incremental.mjs /path/to/batch-directory
node scripts/catalog-resolve-overlaps.mjs /path/to/batch-directory
node scripts/catalog-verify-incremental.mjs /path/to/batch-directory --generate
node --test scripts/catalog-brand-import.test.mjs scripts/catalog-incremental.test.mjs scripts/catalog-ingredients.test.mjs
python3 scripts/catalog_formula_notes_test.py
```

Preparation requires reviewed snapshots, a current database backup, and optional documented brand aliases. Overlap resolution additionally requires explicit reviewed decisions; it is not an automatic fuzzy merge. Inspect generated SQL and run rollback-only preflight before applying. The batch runner requires `--apply`, `SUBSTRATE_SUPABASE_CLI`, `SUBSTRATE_CATALOG_BATCH_DIR`, and the verified `SUBSTRATE_CATALOG_PROJECT_REF`. This import used 127 checkpointed transactions, followed by the overlap settlement. Do not regenerate completed batches against a different backup or replay original inserts after settling overlaps; retain the completed checkpoint file. Final verification runs the generated detail checks and compares original rows field-for-field with the backups.

Run linked CLI queries sequentially: concurrent CLI login initialization can invalidate another query's temporary database credentials. Table-specific `verify-core-*.sql` queries are available if the combined core readback needs to be split.

### Follow-up review of the 65 held identities

The October 20 follow-up reviewed every held source against its original workbook evidence, the current candidate CMS records, and targeted manufacturer checks. It linked 51 sources to existing products and retained 14 holds for unresolved shade, scent, packaging, formula-version, product-code, or bundle-scope conflicts. No product was created, deleted, published, or rewritten. The catalog remains at 10,762 products.

Thirty-five identity-only issues were resolved. Sixteen issues were marked partially resolved because their original formula or price questions remain open. Each of the 14 remaining holds has a specific evidence requirement. Review notes distinguish an identity decision from formula verification or approval for recommendations.

The review also corrected an import metadata bug: a held source with a null product ID could inherit the ID of an unrelated null-linked canonical record. Held reviews now point to their own source; confirmed matches point to the correct canonical record. Existing editorial fields are preserved, and a regression test covers the null-ID case.

The ignored `data/catalog/october-2026/held-review/` directory contains the fresh backup, all 65 evidence-backed decisions, expected results, rollback-only validation, applied SQL, readback verification, and `review-report.md`. `scripts/catalog-review-held.mjs` generates SQL only from those explicit decisions. It rejects changed source/review rows, guards all canonical CMS records and mappings, and supports replay of the same decisions without changing review timestamps. The earlier import reports remain historical; the follow-up report records the updated source associations.
