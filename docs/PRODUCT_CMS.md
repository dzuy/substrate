# Product database and CMS

The app's Supabase database is the editing source of truth. `/admin-products` is the CMS, available from Profile to accounts with `admin` or `catalog_admin` in trusted Supabase app metadata. The Google Sheet is a one-time import source; CMS saves never write back to it.

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
