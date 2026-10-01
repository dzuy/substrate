# Substrate product database seed audit

Audit date: September 27, 2026. Source: [shared folder](https://drive.google.com/drive/folders/1AwUuc1RVgW862J141LBpM7e8cU8nDTzd).

## Conclusion

The files are consistent enough for a staged, unpublished catalog seed after normalization. They are not a ready-to-run seed for the existing importer, a complete sellable-SKU inventory, or a verified ingredient/recommendation database.

All 61 workbooks opened successfully. I inspected the returned main tables and supporting notes/summaries (181 extracted sections) and checked the repository's current schema, importer, evidence editor fields, and checked-in v10 snapshot. This is a source-data audit: claims, prices, formulas and regulatory assertions were not independently reverified against manufacturers. The connector supplies extracted workbook text rather than native worksheet coordinates; record references below identify the main-table product name and ordinal, not guaranteed Excel row numbers. No Drive files or application/database records were modified.

Accepted scope: use the existing project schema; retain separate sellable variants and bundles; retain all product types, including hair, cosmetic hybrids, devices and supplements.

## Counts and counting policy

| Measure | Count |
|---|---:|
| Workbooks | 61 |
| Main-table product records | **1,534** |
| Records in 60 product-named workbooks | 1,518 |
| Records in MyoLift device workbook | 16 |
| Main records with a device category, including device bundles | 20 |
| Of those: standalone device/variant records | 8 |
| Of those: device bundles | 12 |
| Main oral-supplement records | 1 |
| Remaining topical/hair/cosmetic/program records | 1,513 |
| Additional structured items in LALAIS appendix, excluded from main count | 2 |

The 1,534 count sums main-table records once; it excludes summary totals, notes, repeated ingredient tables, and bare mentions of excluded products. The LALAIS appendix additionally documents a supplement and an accessory, giving **1,536 main-plus-appendix catalog entries** if those two are promoted as incomplete leads. This is not a count of verified unique sellable SKUs or net-new production records.

Most authors deliberately collapsed sizes, shades, refills and multipacks and excluded kits. Preserve the variants actually present, but mark formula-family rows as variant-incomplete. Do not manufacture missing sizes or bundles. MyoLift has four Base/Premium pairs; 7DAYS has five size pairs. These nine same-name pairs are intentional. Valmont has one additional ambiguous same-normalized-name pair that needs review. No full-row duplicate was found in the main tables.

Six exact normalized brand/product-name candidates overlap the checked-in v10 snapshot. This is not a live-database reconciliation, and net-new insert count remains undetermined. Do not subtract six and call the remainder validated unique products.

## Consistency and gaps

| Check | Result and import implication |
|---|---|
| Main table schemas | 9 exact header layouts; 51 files share the same 10-column layout. Build explicit header mappings rather than positional imports. |
| Basic completeness | Every main row has nonblank brand, product name, category, primary URL, usage/directions and claim/use text. Presence does not imply accuracy or specificity. |
| Categories | 1,061 distinct source labels. Only 60 rows map by lowercasing directly to the current 13-value category enum; the other 1,474 require mapping. Preserve source category, body zone, format, mechanism and product type separately. |
| Missing prices | 124 zero placeholders plus 4 blank cells = **128** records (8.3%). Use null and a missing-price reason, never $0. |
| Price representation | 1,370 straightforward positive numeric price rows; another 36 have text-coded prices (31 Valmont, 5 Youngblood). Four Youngblood cells contain multiple size prices. Preserve amount, currency, size, price kind and source. |
| Currencies | 1,440 USD records, 63 GBP (MZ SKIN + Dr Sebagh), 31 CHF (Valmont). These include unresolved prices. Do not invent conversions or market equivalence. |
| URLs | At least **639** primary URLs (41.7%) are collection, storefront-root or retailer-browse links. Other broad category URLs may add to this count. A populated URL is not necessarily an exact product source or unique identity. |
| Dates | 1,340 rows have an ISO date in Source Checked; 134 have prose; 28 contain URLs instead. The other 32 use workbook-level verification dates. Split checked_at from source_url and preserve date provenance. |
| Identifiers | Only 16 rows carry real manufacturer SKUs (MyoLift); 12 have explicit numeric barcodes. 7DAYS has 16 retailer IDs but manufacturer SKUs are Not publicly listed. Do not treat placeholders or retailer IDs as manufacturer identifiers. |
| Images | No main table has an image URL field. All catalog imagery requires enrichment or a placeholder. |
| Ingredients | Ingredient data is heterogeneous and often missing, partial or prose. Complete-looking lists require validation before populating product_ingredients. |
| Market/formula/size | No consistent structured market, size, shade or formula-version keys across the collection. Currency and page locale are evidence, not proof of exact formula equivalence. |
| Availability | Coming Soon, temporarily out of stock, legacy and unresolved current-availability cases exist; most files lack a structured availability field. |
| Claims | Much of the description is manufacturer positioning, interpretation or evidence commentary. Do not copy it wholesale into an unqualified public description or promote source Verified labels to internal verified status. |

## Ingredient extraction requirements

The following examples are particularly consequential. A label such as FULL INCI AVAILABLE can mean the list exists elsewhere, not that it is transcribed in this workbook.

| File | Treatment |
|---|---|
| 7DAYS | 16 ingredient-list payloads; retain retailer provenance, inferred-size labels and the ceramide discrepancy. |
| Youngblood | Five full-list transcriptions embedded in evidence prose; isolate ingredient boundaries from subsequent commentary. |
| U Beauty | Two explicit long FULL INCI transcriptions; most other cells summarize selected ingredients despite similar labels. |
| Trish McEvoy | Mixture of lists and abbreviated ingredient descriptions; at least the Retinol Eye Cream and SPF35 Beauty Balm need completeness review. |
| Solara | 11 labeled full lists; Day Dreamer explicitly partial. Separate active and inactive sections and preserve percentages. |
| Shiseido | 14 summary/reference notes, not transcribed full ingredient lists. |
| Saint Jane | Summary claims 11 full and 3 partial, but numerous available/full labels accompany selected-ingredient summaries. |
| Rodial | Supplemental table joins 39 main products: 19 labeled full, of which one warns the final tail may continue; 20 partial. |
| RevitaLash | Ten ingredient/safety rows embedded below another header inside Notes; join to main products. |

These nine files span 143 main records, but that is **not** a count of complete formulas. Other files contain ingredient mentions and research notes without a consistent complete-list payload. Preserve raw ingredient text, completeness status and source; parse only reviewed literal lists. Do not infer concentrations from ingredient order, convert proprietary complexes into ingredients, or import explanatory phrases as chemical names.

## High-priority exceptions

| File | Issue | Resolution before promotion |
|---|---|---|
| MZ SKIN | Notes claim 35; main records and category-summary counts are 34. | Identify the missing record or correct the source claim. |
| Givenchy | Notes reconcile 23 listings minus 3 refills to 20, then say 19 represented. | Reconcile catalog scope rather than add a guessed product. |
| 7DAYS | Ceramide 40 mL and 80 mL have materially different lists; 40 mL list also matches the HA product's list. | Verify packaging/manufacturer and mark formula uncertain. |
| NuFACE | IonPlex mist described as fragrance-free while source notes report Fragrance (Parfum) in INCI. | Keep conflicting assertions; do not mark fragrance-free. |
| Valmont | Daily Veil SPF30 and DAILY VEIL SPF 30 collapse under name normalization but have CHF250/CHF175 prices; notes explicitly say keep apart pending equivalence. | Require market/size/formula identities before merging. |
| Solara | Pout Protector and Clean Freak are Coming Soon. | Preserve launch/availability state. |
| ReVive | Classic Rescue Elixir and upgraded Renewal version coexist. | Preserve formula/version distinction. |
| LALAIS | Two additional typed sellable items are only in appendix. | Import as incomplete leads if retained; main count stays distinct. |
| Omorovicza | Category summary contains a TOTAL row. | Exclude total from row summation; correct main count is 65, not 130. |
| RevitaLash / Rodial / Youngblood | Important product detail is outside standard main-table fields. | Join and preserve supporting data instead of silently dropping it. |

## Fit to the existing Substrate project

The checked-in schema already has `brands`, `products`, `ingredients`, `product_ingredients`, `catalog_imports`, `catalog_records`, `catalog_reviews` and source snapshots. That provides a suitable staging path.

| Source information | Existing destination / needed treatment |
|---|---|
| Brand and product name | Resolve existing brand/product IDs, aliases and renamed/co-branded identities; generate durable source keys. |
| Source category | Map to products.category; preserve original label and additional dimensions in evidence fields. |
| Product description/claims | Separate neutral public description from attributed manufacturer_claim and evidence_position_source. |
| Prices, currency, size, market, variant, SKU, source details | No dedicated columns for most of these in products. Preserve in catalog_records.fields initially; add explicit schema/UI support before depending on them operationally. |
| Ingredients | Reviewed full lists can map to ingredients/product_ingredients with source order; partial prose belongs in evidence. |
| Raw file data and provenance | Separate catalog_imports snapshots per source/version, with source file ID, product-table locator, fetched time, modified time and checksum. |
| Conflicts and gaps | Review queue with issue type, source record, conflicting values and resolution state. |
| New products | needs_review and catalog_visible=false; retain all requested types without activating clinical rules. |

Important implementation constraints:

1. `scripts/catalog-import.mjs` is specific to the v10 workbook: expected sheet names/header rows, SKP IDs, fixed import ID, retail-type selection and primary_master-based category mapping. It also contains an old task's explicit legacy-archive list. **Do not run it unchanged for these files or carry that archive behavior forward.**
2. `catalog_records.product_id` is unique. A second source record for an already-linked product cannot simply be appended under a new source ID. Decide whether to add a separate many-to-one source-evidence table or maintain one canonical record with structured multi-source provenance and retained snapshots.
3. Current name-only matching would collapse same-name Base/Premium and size variants. Match using brand, product family, sellable variant, market and formula/version where available; ambiguous matches enter review.
4. Current products.category has 13 values and no dedicated hair, oral-supplement or accessory type. Add a separate product_type dimension (initially in evidence if needed); do not use a broad other category to route these through topical routines.
5. The evidence editor renders a fixed field list. Storing arbitrary JSON preserves data but does not automatically make new price/variant/device fields editable in the UI.
6. Workbook verification labels describe the source author's pass. They are not independent source validation, approval for recommendations, or proof of current availability.

Relevant project files: [catalog schema](/Users/dzuy/Documents/ChatGPT/Substrate/supabase/migrations/202608290001_product_catalog.sql), [catalog CMS schema](/Users/dzuy/Documents/ChatGPT/Substrate/supabase/migrations/202609080001_catalog_cms.sql), [existing importer](/Users/dzuy/Documents/ChatGPT/Substrate/scripts/catalog-import.mjs), [evidence editor fields](/Users/dzuy/Documents/ChatGPT/Substrate/src/components/admin/catalog-fields.ts), [checked-in v10 snapshot](/Users/dzuy/Documents/ChatGPT/Substrate/data/catalog/source-v10.json). This audit did not query the live production catalog.

## Suggested consolidation sequence

1. Preserve all raw snapshots and main/supplemental table relationships.
2. Normalize nine layouts to a shared staging record; retain original labels and values.
3. Generate stable source IDs and classify product type and row granularity. Preserve available variants/bundles, flag collapsed families and incomplete appendix leads.
4. Normalize brand aliases, categories, price/currency/status/date fields. Keep unresolved values null with reasons.
5. Reconcile against a fresh live catalog export; preserve existing IDs and wardrobe references. Do not fuzzy-merge formula/strength/SPF/variant siblings.
6. Import new records unpublished, attach source evidence and queue conflicts. Reviewed literal INCI can be enriched separately.
7. Enrich exact product links, images, full formulas, package/market/version identities and evidence. Publish only reviewed records under the chosen minimum catalog policy.

No further answer is required to complete this audit. Before seeding, decide whether unknown-price/image/INCI records may become publicly searchable, and whether source evidence will be many-to-one or aggregated under the current unique record. My recommendation is private staging first and preserved multi-source evidence.

## File-by-file inventory

The ingredient column describes extraction work, not source-verified completeness. Generic/page URL counts use a conservative URL-path rule and may undercount broad category pages. Missing-price count includes both zeros and blanks.

| File | Main records | Missing prices | General URLs | Ingredient handling | Specific consolidation notes |
|---|---:|---:|---:|---|---|
| [7DAYS](https://docs.google.com/spreadsheets/d/1VFS7x1jnO2j0-jQP0fUbC-wusR1E0CYK/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 16 | 0 | 2 | List column; retailer/inference/conflict review | Retailer-sourced, not manufacturer-sourced. Five size-variant pairs. Manufacturer SKU is a placeholder on all 16 rows. Ceramide 40 mL INCI conflicts with 80 mL and duplicates the HA product list; do not copy formulas across sizes. One peptide size uses inferred formula matching. Workbook says 12 face moisturizers + 4 eye creams; main table has 12 + 4. |
| [7E Wellness MyoLift](https://docs.google.com/spreadsheets/d/1R2TuogXjeiyIcTKdEWw6xGUgXaIEROQ4/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 16 | 0 | 0 | Device specs; bundle formulas separate | 16 SKU rows from 12 listings; preserve Base/Premium and bundles. Only file with real manufacturer SKUs/barcodes. Mini/Triwave output missing; generic safety notes need device-specific review. Co-brand 7E Wellness x Meder Beauty needs a brand relationship. |
| [AUTEUR](https://docs.google.com/spreadsheets/d/1GyLQFd3h96xWtNu8Yw8r34G1ibW39hZI/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 20 | 0 | 20 | No full-list field; enrich INCI | Formula-level rows; sizes/bundles generally collapsed or excluded. Preserve scope and claim/evidence notes. |
| [Bellefontaine Switzerland](https://docs.google.com/spreadsheets/d/1UEa7XouxYjlUsH4PAEDRpB2gd9RDLq52/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 30 | 30 | 0 | No full-list field; enrich INCI | All 30 prices are zero placeholders, not free products. |
| [BIOEFFECT](https://docs.google.com/spreadsheets/d/1ciMs6crITIsC1NI87LX13cry7Caj5nrR/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 21 | 11 | 0 | No full-list field; enrich INCI | Four normalized name matches to existing v10 snapshot; reconcile identities rather than insert duplicates. No full INCI payloads in main table. |
| [Blue Lagoon Skin Science](https://docs.google.com/spreadsheets/d/189MR8AQay4Fa0ZsvZynC907dlc_hegZz/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 25 | 0 | 18 | No full-list field; enrich INCI | Includes hand/body/bath; hair products excluded. Some representative from-prices lack a structured size. |
| [Caldera Lab](https://docs.google.com/spreadsheets/d/1EPQYicoHVwv45OvafgFeHmunRmLewyCC/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 10 | 0 | 5 | No full-list field; enrich INCI | Formula-level rows; sizes/bundles generally collapsed or excluded. Preserve scope and claim/evidence notes. |
| [Cellcosmet](https://docs.google.com/spreadsheets/d/1L2FSfv8uW6sQxB2w_6n9An7a3dGXkxMv/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 41 | 0 | 37 | No full-list field; enrich INCI | Contains Cellcosmet and Cellmen formulas under one workbook/brand structure; preserve product line. |
| [Chantecaille](https://docs.google.com/spreadsheets/d/1UeSnfYazMdI8eOE_DxKFppxjBVgcGTIC/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 34 | 6 | 27 | No full-list field; enrich INCI | Formula-level rows; sizes/bundles generally collapsed or excluded. Preserve scope and claim/evidence notes. |
| [Dior](https://docs.google.com/spreadsheets/d/1DxK0JB91BeHDAV2zikj-dpKLY7C_skgG/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 57 | 1 | 0 | No full-list field; enrich INCI | Adult facial/men's skincare pass; Baby Dior and several adjacent categories excluded. From-price versus standard-size price may vary. |
| [Dr Barbara Sturm](https://docs.google.com/spreadsheets/d/1QNogNem3TNX8xI1jcVuVy2jcDLyW0am8/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 38 | 1 | 19 | No full-list field; enrich INCI | Formula-level rows; sizes/bundles generally collapsed or excluded. Preserve scope and claim/evidence notes. |
| [Dr Dennis Gross](https://docs.google.com/spreadsheets/d/1QNlB-gmbHT2Z2Wtcr7xazfcC7YqOxnbi/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 31 | 0 | 3 | No full-list field; enrich INCI | 31 records include four LED devices. Devices need separate specifications and safety fields; file name alone does not identify type. |
| [Dr Few Skincare](https://docs.google.com/spreadsheets/d/13XugPeMEk0r4b3USIUrVhUgvmiyArmHm/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 10 | 0 | 8 | No full-list field; enrich INCI | Mixed brand values Dr. Few Skincare and Dr. Few Skincare / Afore require brand/rename mapping. Systems excluded. |
| [Dr Sebagh](https://docs.google.com/spreadsheets/d/1gmsiPMgf6p31F4BKi3z-gG84udGRvjfA/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 29 | 14 | 29 | No full-list field; enrich INCI | 29 GBP records, 14 zero-price placeholders. Principal-formula pass excludes PRO/travel sizes, blends and procedures. All primary links are collection links. |
| [Eighth Day](https://docs.google.com/spreadsheets/d/1TvI84oXwO-yfQtHly5c1qzfWCIlEhSY1/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 11 | 1 | 0 | No full-list field; enrich INCI | Formula-level rows; sizes/bundles generally collapsed or excluded. Preserve scope and claim/evidence notes. |
| [Element Eight](https://docs.google.com/spreadsheets/d/1xiF7dnT4yFoSdsILhCmPKk2mBiD0HV-M/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 10 | 0 | 5 | No full-list field; enrich INCI | Formula-level rows; sizes/bundles generally collapsed or excluded. Preserve scope and claim/evidence notes. |
| [ELEMIS](https://docs.google.com/spreadsheets/d/1Sfdq6oOS5CxwKN4UMXhgngc5EJAq5W7s/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 53 | 0 | 0 | No full-list field; enrich INCI | Formula-level rows; sizes/bundles generally collapsed or excluded. Preserve scope and claim/evidence notes. |
| [Elm Biosciences](https://docs.google.com/spreadsheets/d/1nEtG7tHVdHGdNNBpef6eFrFA1vWArE6r/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 4 | 0 | 3 | No full-list field; enrich INCI | Includes Inner Dose Daily Skin Supplement. Keep oral-supplement type separate from topical routines. |
| [Estee Lauder](https://docs.google.com/spreadsheets/d/13J2s7j0UzgSWANRqjfQhqDhrqVgOix4H/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 37 | 10 | 0 | No full-list field; enrich INCI | Explicit first pass across core families, not full brand coverage. SPF makeup hybrid retained; shades/refills excluded. |
| [EVE LOM](https://docs.google.com/spreadsheets/d/1GbZpxp8QJDmoM7HlbvrtD9psMPENsB11/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 20 | 0 | 12 | No full-list field; enrich INCI | Formula-level rows; sizes/bundles generally collapsed or excluded. Preserve scope and claim/evidence notes. |
| [Exoceuticals](https://docs.google.com/spreadsheets/d/1VBCdKRpZpw1ORicBF6UYNUsgLtXbYyHV/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 16 | 0 | 14 | No full-list field; enrich INCI | Includes hair/scalp treatment; LED hair brush deliberately excluded. Exosome/technology language is attributed marketing, not a normalized INCI. |
| [Furtuna Skin](https://docs.google.com/spreadsheets/d/1z95RDb4YStPvIO6-OgSSEdBBpX870w6o/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 14 | 5 | 5 | No full-list field; enrich INCI | Formula-level rows; sizes/bundles generally collapsed or excluded. Preserve scope and claim/evidence notes. |
| [Givenchy Beauty](https://docs.google.com/spreadsheets/d/1VuZDmapWmwCDfpowGW_yBH61BUGqYMDk/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 19 | 0 | 0 | No full-list field; enrich INCI | Notes say 23 storefront entries minus 3 refills = 20, but actual records and explicit canonical count are 19. Reconcile missing/excluded identity. Refills deliberately excluded. |
| [Guerlain](https://docs.google.com/spreadsheets/d/1ra2BTo_LemDJDTuua-rGJpKVrlSxmKrG/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 27 | 0 | 23 | No full-list field; enrich INCI | Formula-level rows; sizes/bundles generally collapsed or excluded. Preserve scope and claim/evidence notes. |
| [Hourglass Equilibrium](https://docs.google.com/spreadsheets/d/16GgTJeikmapqqDcga9klJOdPc-UTpy1S/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 8 | 0 | 2 | No full-list field; enrich INCI | Equilibrium is a line under Hourglass, not necessarily a separate brand. Duo excluded. |
| [House of GRO](https://docs.google.com/spreadsheets/d/1ZP19lwImwfDtK1V3zWA1keN8NT-VZFDH/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 5 | 0 | 0 | No full-list field; enrich INCI | Five formulas only; named body/day/night collection bundles excluded. |
| [Jan Marini Marini SkinSolutions](https://docs.google.com/spreadsheets/d/1muE8MzOxUqhuMYIbz3snT50WbMq03XQo/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 32 | 0 | 27 | No full-list field; enrich INCI | Brand value Marini SkinSolutions (Jan Marini) needs alias mapping. Five systems excluded, shades collapsed; preserve formula strengths. |
| [Jaxon Lane](https://docs.google.com/spreadsheets/d/12bTJsaxJkU1LHZbnRYs1xMGpBi1El6eH/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 11 | 0 | 2 | No full-list field; enrich INCI | Formula-level rows; sizes/bundles generally collapsed or excluded. Preserve scope and claim/evidence notes. |
| [Joanna Czech Skincare](https://docs.google.com/spreadsheets/d/1ZU5V6hW2HWy3P6JJEcX9-7xmoXn-tOsW/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 8 | 0 | 2 | No full-list field; enrich INCI | Only the house brand; do not import other brands sold on Joanna Czech retail site as this brand. |
| [Kiehls](https://docs.google.com/spreadsheets/d/1gVLFItWThMqAQV_PWnwazYmiWV1XfRfd/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 70 | 0 | 0 | No full-list field; enrich INCI | 70 records include hair/scalp/shampoo/conditioner as well as skin care. Sizes and refills excluded. |
| [KNESKO](https://docs.google.com/spreadsheets/d/1K_xE12bHW-tWt5dJ3mHS8suUY2dmlDYu/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 27 | 3 | 20 | No full-list field; enrich INCI | Black Pearl legacy names versus current Pearl names need aliases. Sizes, facial sets and kits excluded/collapsed. |
| [KORA Organics](https://docs.google.com/spreadsheets/d/1AXq58ZV7Yqgfzv3PW0yYmSi5-0AI6o1-/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 22 | 0 | 20 | No full-list field; enrich INCI | Noni Bright Vitamin C availability explicitly needs rechecking. Refills and alternate sizes collapsed. |
| [La Mer](https://docs.google.com/spreadsheets/d/1WtEG6drwn_TVsjZH6LGfUV06gcHYHM80/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 34 | 0 | 0 | No full-list field; enrich INCI | Creme de la Mer matches existing v10 snapshot. Refills, sizes and shades collapsed. |
| [La Prairie](https://docs.google.com/spreadsheets/d/1YJWzzJBzy-ToMw9f_DgW31ihCSRZt_6H/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 41 | 0 | 41 | No full-list field; enrich INCI | All primary URLs are collection pages; complexion makeup excluded. Representative standard/base prices need size records. |
| [LALAIS](https://docs.google.com/spreadsheets/d/1Utaj2sRsmsXGQoZrHDGQSUjQz4uEtWk-/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 2 | 0 | 0 | No full-list field; enrich INCI | Main table has 2 topicals. Appendix has 2 additional non-main catalog items: The Skin Perfecting Complex oral supplement ($60) and The Blotting Compact accessory ($48). Retain as separate typed leads if broad scope is desired; not counted in 1,534 main records. |
| [Macrene Actives](https://docs.google.com/spreadsheets/d/1oYd1UZbKI72q5EsWIs-ps_Hz4Rb8U7dM/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 13 | 1 | 2 | No full-list field; enrich INCI | Shades collapsed for tinted moisturizer, concealer and lip filler. Mini/full-size pricing unresolved for Neck & Decolletage. Canonical brand differs from filename. |
| [Mila Moursi](https://docs.google.com/spreadsheets/d/1rxhQCDvi2_2I1YAqRByJ5SL4ALCWlMiq/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 27 | 2 | 15 | No full-list field; enrich INCI | Nine named travel sizes explicitly collapsed into formula rows; source cannot supply a complete sellable-SKU count. |
| [MZ SKIN](https://docs.google.com/spreadsheets/d/1ToFJI0xch1iKaLG_6CKVYDZhHdo5UmT3/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 34 | 0 | 34 | No full-list field; enrich INCI | 34 main records and category-summary total 34, but notes claim 35. GBP prices. All main links are collection URLs. Ampoule programs may contain multiple formulas. No full INCI table. |
| [Natura Bisse](https://docs.google.com/spreadsheets/d/1iQ3_jf6jmi98gWQCAA3VdXR_cXVfmQhN/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 42 | 1 | 0 | No full-list field; enrich INCI | Includes a multiweek treatment program; distinguish program from individual formula. |
| [NEURAE](https://docs.google.com/spreadsheets/d/1q0Mzx8nP6gDhxWzNi7URDwG0qKbDLb9c/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 9 | 1 | 0 | No full-list field; enrich INCI | Harmonie Eye Contour U.S. price unresolved; notes mention EUR price, which must not fill a USD field. Fragrance roll-ons excluded. |
| [Noble Panacea](https://docs.google.com/spreadsheets/d/1lX7H0oTcoyA6g54ZLb9uTNLhkLPsq_dp/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 21 | 1 | 0 | No full-list field; enrich INCI | Trial doses, refills and sets excluded; dose/formula versus sellable package identity must remain separate. |
| [NuFACE Skincare](https://docs.google.com/spreadsheets/d/1ov2fBafODB-VlTnFCP4CDGOA0-3hohES/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 10 | 0 | 2 | No full-list field; enrich INCI | Topicals and conductive masks only; devices intentionally excluded. IonPlex Facial Mist notes say fragrance-free copy conflicts with INCI listing Fragrance (Parfum). Quarantine that attribute from automated matching. |
| [Omorovicza](https://docs.google.com/spreadsheets/d/1Y8EHT5nYpzSN5rsIHC7mhvJ-OWY6E7ag/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 65 | 32 | 65 | No full-list field; enrich INCI | 65 main rows. Category summary includes a TOTAL=65 row; summing all numeric cells would falsely yield 130. All main URLs are collection links. Numerous unresolved prices. |
| [OPULUS Beauty Labs](https://docs.google.com/spreadsheets/d/1pKteLc0a9Ml-3ROIwKNVeKCR14jmkuPz/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 11 | 0 | 0 | No full-list field; enrich INCI | Three Glow Ritual programs and retinol concentrations R1/R2/R3 need separate identities and component/protocol relationships. Activator hardware is excluded from main rows. |
| [Orlane](https://docs.google.com/spreadsheets/d/1s4fVWK6Ydv8HQG7KlAuoIim3sgDRTdfU/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 42 | 0 | 42 | No full-list field; enrich INCI | Out-of-stock current formulas retained. All 42 primary URLs point to a collection page. Sets excluded. |
| [OSEA](https://docs.google.com/spreadsheets/d/16sk_tebHdT5s4zw7cusrSwwTuDT_pUGN/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 31 | 0 | 0 | No full-list field; enrich INCI | Formula-level rows; sizes/bundles generally collapsed or excluded. Preserve scope and claim/evidence notes. |
| [RevitaLash Cosmetics](https://docs.google.com/spreadsheets/d/1Uwh2LGaqgzKOPoZQGIrX3MU6aGN67fkG/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 10 | 0 | 0 | Extract embedded 10-row notes table | A second header and 10 ingredient/safety records are embedded in the notes table. Extract and join, not append. Four products flagged by the workbook as prostaglandin-analogue-containing; preserve attributed safety notes for review. Formula-version history matters. |
| [ReVive Skincare](https://docs.google.com/spreadsheets/d/114jGtRT7SOPbcEun6FrJfYahqerKBngU/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 43 | 1 | 41 | No full-list field; enrich INCI | One blank price. Classic Rescue Elixir retained alongside upgraded Renewal version; do not merge by rough name. Many collection URLs. Source Checked is prose. |
| [Rhode](https://docs.google.com/spreadsheets/d/17rU9ql1A-KmAk-arxrh-fmu9tR0Ff0eA/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 15 | 0 | 5 | No full-list field; enrich INCI | Lip tint, lip shape, pocket blush and highlight milk shade families collapsed; missing SKU-level color distinctions. |
| [Rodial](https://docs.google.com/spreadsheets/d/1q_U4f_j6Ot0W6h299aslOD2R76EuU7ux/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 39 | 0 | 0 | Join supplemental 39-row table | Join 39 supplemental ingredient/safety rows to main products by validated identity. 19 entries begin FULL INCI, including Vit C Face Souffle with an explicit possibly-missing tail; 20 marked partial. Do not append supplement rows as new products. |
| [Saint Jane Beauty](https://docs.google.com/spreadsheets/d/1flkvBwwl4pqK2qB0W91sIzSlcUgm8kC3/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 14 | 0 | 6 | Full-available labels plus summaries/partials | Summary claims 11 full + 3 partial ingredient records, but many FULL INCI AVAILABLE fields are summaries. Preserve uncertainty; do not parse the label as proof of completeness. Includes intimate/body/bath products. |
| [Shiseido](https://docs.google.com/spreadsheets/d/1bkgbK3zcv2M9ERMxI3fSMXXFAZJWRlFp/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 14 | 0 | 0 | References/summaries only | All 14 Ingredient / Technology Notes fields are summaries or references to full lists on product pages, not full INCI payloads. |
| [Sisley Paris](https://docs.google.com/spreadsheets/d/1VflJpEQsLaYhx_PkS6PQilLINifB5GTw/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 59 | 4 | 0 | No full-list field; enrich INCI | Skincare/sun/body pass excludes Hair Rituel and makeup. Tinted sunscreen shades collapsed. |
| [Solara Suncare](https://docs.google.com/spreadsheets/d/1t51fyWtj8Mh-4_eRavpTlWG8un2XSt3I/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 12 | 0 | 0 | 11 labeled full; 1 partial | 11 lists labeled full and 1 explicitly partial (Day Dreamer). Two products marked Coming Soon. Source Checked contains URLs. Separate UV actives, inactive ingredients, water resistance, availability and formula variants. |
| [Sulwhasoo](https://docs.google.com/spreadsheets/d/1eEw3s8FRWwcRvI6phgV4i1JFEWxwqZ1s/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 45 | 0 | 45 | No full-list field; enrich INCI | Includes complexion/lip products with shades collapsed; all main links are collection pages. |
| [Supergoop](https://docs.google.com/spreadsheets/d/1Bv29JGzELPfrlmt7nHl5KS9Dc49jMePt/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 31 | 0 | 28 | No full-list field; enrich INCI | One exact existing-name match plus Unseen SPF40/SPF50, mineral, stick and body siblings that must not be fuzzy-merged. Shades, refills and multipacks collapsed. |
| [Tata Harper](https://docs.google.com/spreadsheets/d/1OGSHupUmQm0QB_OYLJoCG4kCKtXedCVS/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 29 | 0 | 6 | No full-list field; enrich INCI | Formula-level rows; sizes/bundles generally collapsed or excluded. Preserve scope and claim/evidence notes. |
| [Trish McEvoy](https://docs.google.com/spreadsheets/d/1GGG5K5yX0kJpRrAmpeexOhdo86K2LjjL/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 16 | 3 | 3 | Lists mixed with summaries | 3 blank prices. Ingredient fields mix literal lists and summaries; Retinol Eye Cream uses generic botanical extracts, SPF35 uses an inactive summary. Source Checked contains URLs, not dates. Availability and collapsed-size notes matter. |
| [U Beauty](https://docs.google.com/spreadsheets/d/1wlf0Z7OTGk1p1sX42vfNmRkfbjYUU3hU/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 17 | 0 | 0 | 2 explicit lists; remaining summaries | 17 ingredient-note fields; only 2 are explicit FULL INCI transcriptions, most others summarize selected ingredients despite FULL INCI wording. SPF active percentages and partial inactive summaries require separation. Shades/sizes collapsed. |
| [Valmont](https://docs.google.com/spreadsheets/d/1cWg7-H6grih6bw0K77ZyOnOrj0UBk6Un/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 31 | 0 | 0 | No full-list field; enrich INCI | 31 CHF price strings; several have + lower-bound pricing. Daily Veil SPF30 (CHF250) and DAILY VEIL SPF 30 (CHF175) normalize to the same name; notes explicitly require formula verification before merging. No structured currency column. |
| [Youngblood Mineral Cosmetics](https://docs.google.com/spreadsheets/d/1m1yVUwxvgwpSy2MnCuCnF1bq6xpa0SlK/edit?usp=drivesdk&ouid=114157787479296980552&rtpof=true&sd=true) | 5 | 0 | 1 | 5 lists embedded in evidence prose | Five ingredient lists are embedded inside Claim Evidence / Basis, mixed with commentary. Four price cells combine full-size and petite prices; one price has a dollar sign. Must split variants only after size/identity verification. |

## Existing-snapshot identity matches

These are review candidates, not automatic merge approvals. Existing snapshot has 192 retail records; live changes and aliases may reveal further overlap.

| New file | Product | Existing source ID |
|---|---|---|
| BIOEFFECT | EGF Serum | SKP-0140 |
| BIOEFFECT | EGF Day Serum | SKP-0344 |
| BIOEFFECT | EGF Power Serum | SKP-0141 |
| BIOEFFECT | EGF Power Cream | SKP-0037 |
| Supergoop | Bright-Eyed 100% Mineral Eye Cream SPF 40 | SKP-0076 |
| La Mer | Crème de la Mer | SKP-0044 |

## Missing-price record list

Main-table record ordinals are 1-based excluding the header. Zero values in these sources are missing-price markers; do not interpret them as free items.

| File | Main record | Product | Source value |
|---|---:|---|---|
| Mila Moursi | 2 | Cellular Renewal Cream | 0 |
| Mila Moursi | 3 | Triple Actif Anti Wrinkle & Firming Cream | 0 |
| Macrene Actives | 7 | High Performance Neck and Décolletage Treatment | 0 |
| KNESKO | 24 | Gold Repair Body Serum | 0 |
| KNESKO | 25 | Gold Repair Body Cream | 0 |
| KNESKO | 27 | Gold Repair Foot Mask | 0 |
| Furtuna Skin | 5 | Micellar Cleansing Essence | 0 |
| Furtuna Skin | 6 | Cleansing Oil Balm | 0 |
| Furtuna Skin | 8 | Eye Revitalizing Cream | 0 |
| Furtuna Skin | 9 | Daily Renewal Cream | 0 |
| Furtuna Skin | 10 | Nightly Renewal Cream | 0 |
| Trish McEvoy | 6 | Beauty Booster® Face Serum | blank |
| Trish McEvoy | 12 | Beauty Booster® Eye Serum | blank |
| Trish McEvoy | 13 | Beauty Booster® Retinol Eye Cream | blank |
| ReVive Skincare | 42 | Sensitif Repairing Night Cream / Recovery for Sensitive Skin | blank |
| Omorovicza | 13 | Rose Lifting Serum | 0 |
| Omorovicza | 14 | Instant Perfection Serum | 0 |
| Omorovicza | 16 | Queen of Hungary Evening Mist | 0 |
| Omorovicza | 17 | Magic Moisture Mist | 0 |
| Omorovicza | 18 | Omoressence | 0 |
| Omorovicza | 20 | Acid Solution | 0 |
| Omorovicza | 21 | Silver Skin Tonic | 0 |
| Omorovicza | 27 | Cashmere Cleanser | 0 |
| Omorovicza | 28 | Peachy Micellar Cleanser | 0 |
| Omorovicza | 36 | Balancing Moisturizer | 0 |
| Omorovicza | 37 | Instant Plumping Cream | 0 |
| Omorovicza | 38 | Intensive Hydralifting Cream | 0 |
| Omorovicza | 43 | Reviving Eye Cream | 0 |
| Omorovicza | 44 | Illumineye C | 0 |
| Omorovicza | 45 | Firming Neck Cream | 0 |
| Omorovicza | 48 | Ultramoor Mud Mask | 0 |
| Omorovicza | 49 | Midnight Radiance Mask | 0 |
| Omorovicza | 50 | Gold Hydralifting Mask | 0 |
| Omorovicza | 51 | Blue Diamond Resurfacing Peel | 0 |
| Omorovicza | 52 | Silver Skin Saviour | 0 |
| Omorovicza | 53 | Acid Fix | 0 |
| Omorovicza | 54 | Refining Facial Polisher | 0 |
| Omorovicza | 55 | Copper Peel | 0 |
| Omorovicza | 56 | The Cure | 0 |
| Omorovicza | 57 | Mineral UV Shield SPF 30 | 0 |
| Omorovicza | 58 | Complexion Perfector SPF 20 | 0 |
| Omorovicza | 60 | Body Cream | 0 |
| Omorovicza | 61 | Firming Body Oil | 0 |
| Omorovicza | 62 | Gold Shimmer Oil | 0 |
| Omorovicza | 63 | Gold Sugar Scrub | 0 |
| Omorovicza | 64 | Youthful Hands | 0 |
| Omorovicza | 65 | Nourishing Hand Treatment | 0 |
| Noble Panacea | 19 | The Elemental Cleansing Balm | 0 |
| NEURAE | 9 | harmonie The Eye Contour Awakening & Smoothing_ | 0 |
| Natura Bisse | 13 | Essential Shock Intense Hydro Rescue | 0 |
| Estee Lauder | 14 | Re-Nutriv Ultimate Diamond Transformative Brilliance Serum | 0 |
| Estee Lauder | 15 | Re-Nutriv Ultimate Diamond Transformative Energy Serum | 0 |
| Estee Lauder | 24 | Nutritious Melting Soft Creme/Mask | 0 |
| Estee Lauder | 25 | DayWear Anti-Oxidant 24H-Moisture Creme SPF 15 | 0 |
| Estee Lauder | 26 | Resilience Multi-Effect Face and Neck Creme SPF 15 | 0 |
| Estee Lauder | 31 | Derm-Advanced Eye Lift | 0 |
| Estee Lauder | 34 | Re-Nutriv Ultimate Diamond Transformative Energy Eye Creme | 0 |
| Estee Lauder | 35 | Perfectionist Pro Multi-Zone Wrinkle Concentrate | 0 |
| Estee Lauder | 36 | Perfectionist Pro Instant Resurfacing Peel with 9.9% AHA + BHA | 0 |
| Estee Lauder | 37 | Futurist Soft Touch Brightening Skincealer Concealer + SPF 25 | 0 |
| Eighth Day | 3 | The Resurfacing Tonic Pads | 0 |
| Dr Sebagh | 2 | Rose de Vie Cream Cleanser | 0 |
| Dr Sebagh | 4 | Serum Repair | 0 |
| Dr Sebagh | 5 | Retinol Night Repair | 0 |
| Dr Sebagh | 6 | Exo C Booster | 0 |
| Dr Sebagh | 7 | Rose de Vie Serum | 0 |
| Dr Sebagh | 8 | Supreme Maintenance Youth Serum | 0 |
| Dr Sebagh | 9 | Signature Serum | 0 |
| Dr Sebagh | 10 | Platinum Gold Elixir | 0 |
| Dr Sebagh | 11 | Self-Tanning Drops | 0 |
| Dr Sebagh | 17 | Extreme Maintenance Cream | 0 |
| Dr Sebagh | 19 | Vital Cream | 0 |
| Dr Sebagh | 20 | Luminous Glow Cream | 0 |
| Dr Sebagh | 24 | Deep Exfoliating Mask | 0 |
| Dr Sebagh | 25 | Deep Exfoliating Mask Sensitive Skin | 0 |
| Dior | 53 | Dior Solar The After-Sun Balm | 0 |
| Chantecaille | 13 | Bio Lifting Neck Cream | 0 |
| Chantecaille | 16 | Bio Lifting Eye Cream | 0 |
| Chantecaille | 17 | Nano Gold Energizing Eye Serum | 0 |
| Chantecaille | 18 | Gold Energizing Eye Recovery Mask | 0 |
| Chantecaille | 29 | Hibiscus Smoothing Mask | 0 |
| Chantecaille | 30 | Detox Clay Mask with Rosemary and Honey | 0 |
| BIOEFFECT | 1 | Facial Cleanser | 0 |
| BIOEFFECT | 2 | Micellar Cleansing Water | 0 |
| BIOEFFECT | 4 | EGF Essence | 0 |
| BIOEFFECT | 7 | EGF Day Serum | 0 |
| BIOEFFECT | 10 | 3xGF Recovery Serum | 0 |
| BIOEFFECT | 12 | EGF Power Eye Cream | 0 |
| BIOEFFECT | 13 | 3xGF Recovery Eye Serum | 0 |
| BIOEFFECT | 17 | Imprinting Eye Mask | 0 |
| BIOEFFECT | 18 | Recovery Hydrogel Mask | 0 |
| BIOEFFECT | 20 | EGF Hand Serum | 0 |
| BIOEFFECT | 21 | Lip Balm | 0 |
| Bellefontaine Switzerland | 1 | Cleansing Essential | 0 |
| Bellefontaine Switzerland | 2 | Revitalizing Tonic Lotion | 0 |
| Bellefontaine Switzerland | 3 | Moisture Renewing Mask | 0 |
| Bellefontaine Switzerland | 4 | Repairing Nutritive Night Cream | 0 |
| Bellefontaine Switzerland | 5 | Nutrient Regenerating Night Cream | 0 |
| Bellefontaine Switzerland | 6 | Nutri-Regeneration Mask | 0 |
| Bellefontaine Switzerland | 7 | Elixir Beauty Essence | 0 |
| Bellefontaine Switzerland | 8 | Serenity De-Sensitizing Serum | 0 |
| Bellefontaine Switzerland | 9 | Purifying Beauty Essence | 0 |
| Bellefontaine Switzerland | 10 | 24H Repairing Perfect Serum | 0 |
| Bellefontaine Switzerland | 11 | Anti-Oxidant Vit. C Drops | 0 |
| Bellefontaine Switzerland | 12 | Eye Contour Lift Serum | 0 |
| Bellefontaine Switzerland | 13 | Pearly White Perfection Serum | 0 |
| Bellefontaine Switzerland | 14 | Up-Lift Firming Golden Serum | 0 |
| Bellefontaine Switzerland | 15 | Ultra Suncare Protection Face Cream SPF50 PA+++ | 0 |
| Bellefontaine Switzerland | 16 | Intensive Hand Treatment | 0 |
| Bellefontaine Switzerland | 17 | Cellstemine 24HR Repair Cream | 0 |
| Bellefontaine Switzerland | 18 | Cellstemine Intense Renewal Serum | 0 |
| Bellefontaine Switzerland | 19 | Cellstemine Eye Contour Perfection Cream | 0 |
| Bellefontaine Switzerland | 20 | Cellstemine Night Renaissance Elixir | 0 |
| Bellefontaine Switzerland | 21 | Cellstemine 24H Glow Repair Mask | 0 |
| Bellefontaine Switzerland | 22 | Exquis Golden Caviar L'Essentiel | 0 |
| Bellefontaine Switzerland | 23 | Exquis Golden Caviar Cream | 0 |
| Bellefontaine Switzerland | 24 | Exquis Golden Caviar Serum | 0 |
| Bellefontaine Switzerland | 25 | Caviar Rejuven'active Treatment | 0 |
| Bellefontaine Switzerland | 26 | Perfect Shape Cream | 0 |
| Bellefontaine Switzerland | 27 | Stretch Marks Control | 0 |
| Bellefontaine Switzerland | 28 | Tender Skin Exfoliator | 0 |
| Bellefontaine Switzerland | 29 | Silky-Nutritive Feet Refiner | 0 |
| Bellefontaine Switzerland | 30 | Heavy Legs Relieving Concentrate | 0 |
| Sisley Paris | 7 | Gentle Cleansing Gel With Tropical Resins | 0 |
| Sisley Paris | 10 | Sisleÿa Essential Skin Care Lotion | 0 |
| Sisley Paris | 24 | Sisleÿa L'Intégral Anti-Âge Fresh Gel Cream | 0 |
| Sisley Paris | 32 | Supremÿa At Night The Supreme Anti-Aging Skin Care | 0 |
| Dr Barbara Sturm | 36 | ANTI-AGING BODY CREAM V Collection | 0 |

## Method limitations

Counts cover files listed in the specified folder during this audit, not the entire brand catalogs, other Drive folders, or later uploads. All 61 fetches succeeded and the main tables had consistent row widths; no displayed truncation marker was found in the saved source text. Source self-reported catalog breadth is not independently established. Native Excel formatting, hidden cells, formulas and workbook relationships were not audited. Exact worksheet names and physical cell coordinates are not exposed by this text extraction. The complete-SKU count and net-new production count require additional source enrichment and live-catalog reconciliation.
