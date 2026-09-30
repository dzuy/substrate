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

Search by name, brand, alias or SKP ID. Filter by availability, category, brand and verification status. Edit a product to maintain display information, ingredients, publication, and grouped source evidence. Use the product's review queue to track unresolved issues; resolution notes are optional. Change history lists recent database changes.

`save_catalog_product` saves product fields, ingredient links and evidence in one transaction. Both product and source timestamps protect against concurrent edits. An ingredient validation failure rolls back the whole save. Existing ingredient concentrations and notes survive edits.

Non-product entities are viewable separately and cannot be published as retail products. Conversion of a generic family, Rx entity or procedure into a specific product is a subsequent curated workflow. Manually created products currently support the basic catalog/ingredient editor; the imported-evidence editor applies to records with a source link.

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

The web admin uses a full-width desktop layout with its own navigation, separate from the consumer app. Availability, Brand (searchable), Category, and Verification filters combine in the left rail. Products are searchable and sortable, with 25 rows per page. Filters are retained when opening and closing an editor.

Clicking a product row or New product opens a right-side slide-out drawer, keeping the table and filters in place behind it. The drawer supports Escape, outside-click and close-button dismissal with unsaved-change protection, keyboard focus containment, and reduced-motion preferences. Product editing uses Overview, Formula & sources, Directions, Evidence, Rules, Ingredients, Reviews, and History tabs. Save controls remain visible, Cmd/Ctrl+S saves product changes, and Cmd/Ctrl+K focuses catalog search. Closing an edited product prompts before discarding changes. Source library is hidden from navigation; its research records remain preserved. Reviews link to affected product drawers, where the issue and resolution action remain visible while editing. Save product changes before resolving the review; no note is required.

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

### Formula review and recommendation workflow

1. Confirm the exact product, variant, market, and current official ingredient list in Formula & sources. Save changed text first.
2. Use **Parse current ingredient list** to prepare ingredient links. Unknown or ambiguous names require library resolution; missing/partial/narrative text is not silently accepted. Save, check every ingredient and explicit concentration, then mark the formula `full_verified` in Product details or Formula & sources and save again.
3. In Recommendations, map actual formula ingredients to the active ingredient engine IDs. Review each mapping, its primary/support role, and required eligibility. This is a deliberate approval step, not automatic inheritance from marketing claims.
4. Publish the verified topical product and enable recommendations only when the full formula and mappings are reviewed. Bundles and non-topical types remain outside this topical matcher.

The database enforces the readiness guard, and changes to formula text or ingredient links disable recommendations. Formula text changes also unapprove mappings. Unchanged associations survive ordinary saves. Product, evidence, ingredient, and mapping edits remain atomic and audited; stale timestamps reject conflicting saves.

`get_recommendation_catalog` exposes only approved retail facts to authenticated users. The face-scan ingredient handler uses this live projection and the existing same-origin app session. Missing/expired sign-in or a catalog outage returns no product matches; it never substitutes the static demo catalog. The static catalog remains only as a direct engine test fixture. No imported product is currently approved, so the live matcher correctly returns an empty product catalog. The condition/ingredient evidence engine still needs its own clinical review; importing retail data does not validate diagnostic or treatment claims.

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
