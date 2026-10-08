# Report-first experience

As of October 7, 2026, the primary consumer experience is a one-off $79 Skin Intelligence Report. Payment is simulated. The original daily loop remains at `/daily`; catalog and user administration remain available.

## Journey

1. Sign in or create an account.
2. `/assessment`: upload/take a photo, prepare a JPEG, and run the existing high-detail OpenAI scan.
3. Complete the combined questionnaire. The scan prototype supplies concern, comfort, duration, treatments, sensitivity, allergy, reproductive, photo-context, and conditional questions. Daily check-in supplies sleep, stress, activity, and optional cycle context. Add self-reported age, shopping preferences, and optional supplement/context notes. Answers start empty and hidden answers are discarded server-side.
4. Choose one report approach using checkbox options, then optionally search published catalog products and select existing active wardrobe items. Products remain visible when unchecked, with explicit Included / Not included states. Required context questions are labeled. Product-label scanning and manual product-name entry are not part of this flow.
5. Generate a report through `/api/skin-report`. Signed scan references are bound to the authenticated user and expire after 24 hours. Questionnaire edits reuse the scan. The server evaluates the real ingredient engine using supplied age context, retrieves `get_recommendation_catalog`, and matches only eligible published catalog products. A catalog outage fails visibly and can be retried. There is no demo fallback.
6. `/report?id=…`: show a six-second initial preview, then blurred section placeholders and a modal with **Simulate $79 purchase & unlock**. Reopening a locked report does not restart the preview. No payment processor, card entry, or real payment is involved.
7. Open the saved report, or share/download a PDF using the current design settings.

## Report composition

`server/report-builder.mjs` composes actual OpenAI observations, self-reported context, ingredient decisions, and catalog matches into twelve sections modeled on the supplied report's content structure. It is deterministic composition, not a second generative model call. The original vision output, knowledge/rule/catalog versions, and evidence states are preserved. Routine guidance is a conservative foundation; product options are alternatives, not an instruction to layer all matched actives. Optimize mode highlights existing coverage; fresh mode presents a foundation while preserving all existing-treatment and safety gates.

Unknown supplement interactions, biomarker results, procedure schedules, dietary deficiencies, prices, and regional availability are not invented. Shopping country and budget are recorded but do not currently constrain matching because the existing public catalog projection does not supply reliable prices/market coverage. These are explicit future refinement points.

## Storage and deployment

`supabase/migrations/202610070001_skin_reports.sql` was applied to the linked Supabase project on October 7, 2026, enabling cloud report history. Apply it when provisioning another environment. `skin_reports` uses owner-only RLS for reads and writes and cascades with account deletion. The API derives ownership from a verified Supabase session; it does not trust a posted user ID. It uses the public Supabase key plus the caller's token, never a service-role key.

The last five reports and the current assessment have per-user device caches. If cloud storage is temporarily unavailable, reports remain cached locally. Opening a cached report or the home page retries saving pending reports and simulated unlocks to the account. Repeated saves preserve existing cloud records and unlocks. Clearing browser/app data removes those local copies. Local storage failure is surfaced when neither storage destination succeeds. The PDF contains personal photo and questionnaire information and is shared only through an explicit user action.

Unlock flags are **simulation state, not secure payment entitlements**. The full report is fetched for the preview, and authenticated owners can update their own records. Before real payments, separate preview/full access on the server and introduce verified payment fulfillment.

Production: `npm run build:web` and `npm run start:production` serve the web app and new API together. Existing Railway configuration needs no new route service. Vercel has an equivalent API wrapper.

Development: run `npm run web` and `npm run report:server`. The report server listens on loopback port 4318 and also serves Ask Tate. Native builds require `EXPO_PUBLIC_REPORT_API_URL` pointing to a reachable report endpoint. Camera/PDF sharing should be verified on a physical device before a native release.

Required server variables: existing `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `OPENAI_API_KEY`. Optional: `OPENAI_VISION_MODEL` from the existing supported-model list, and `REPORT_SIGNING_SECRET` (falls back to `FACE_SCAN_SIGNING_SECRET`, then the server OpenAI key). No secret is exposed to the client.

## Design system

`/style-guide` is a separate editable style guide. `src/report/theme.tsx` owns the default navy/ivory/gold palette, serif/sans choices, type scale, and corner radius. Controls update the report journey and authentication screens, persist locally, and expose copyable JSON tokens. PDF export adopts palette and font family choices. Existing admin and daily screens retain their existing visual components.

## Validation

- `npm run test:report`: questionnaire validation, supplied age context, retakes, authorization, scan integrity/account binding, catalog outages, storage ownership, and real PDF generation.
- `npm run test:face-scan`: existing scan/ingredient/product regression suite.
- `npm run test:tate` and `npm run test:production`.
- `npx tsc --noEmit`, `npm run lint`, `npm run build:web`.
- Browser QA should distinguish synthetic fixtures from a live scan. Never send a sample report photo to a paid provider merely to satisfy a test.

### Live catalog connection (2026-10-07)

The imported INCI records need an explicit `catalog_engine_expressions` bridge.
`scripts/catalog-engine-map.mjs snapshot.json output.sql` generates exact identity
links as **unapproved drafts**, preserving existing mappings. It never matches
substrings (e.g. ethylhexylglycerin is not glycerin). The current import produced
927 links across 363 products; these counts do not imply publication approval.

Three complete formulas were checked against official manufacturer pages in
`data/catalog/reviewed-routine-products.json`. The publishing script emits a
transaction that refuses changed formulas/URLs, approves the actual links, and
publishes through the existing catalog guards. Other mapped products still need
formula review and publication in the CMS. No recommendation uses demo records.

`server/report-products.mjs` retains strict ingredient eligibility and separately
labels reviewed cosmetic routine-support options. These require a published
catalog record, exact reviewed formula fingerprint, a linked support ingredient
in the saved assessment, adult context, and no applicable explicit hold. Unknown
allergies are disclosed; known allergy, procedure, active irritation, or unclear
age suppress this fallback. This is not clinical approval or a declaration that
the full formula suits the user. Full formula edits invalidate publication and
the support review. Add future reviewed formulas to this provenance file only
after source verification; broad identity mapping alone is insufficient.

Opening a cloud report refreshes only its product section when catalog/policy
versions change and persists that update using the signed-in owner's RLS access.
Original observations, ingredient states, answers and unlock state are retained.
A catalog outage leaves saved matches intact. `productsUpdatedAt` records the
refresh independently of the original assessment creation time. New reports and
PDF exports use the same product section.

### Ask Tate in the report app

Ask Tate is a full page at `/ask-tate`, reached from the persistent bottom navigation.
The header Profile icon opens a slide-up drawer over the current page; `/profile`
opens that drawer over Home for compatibility. Customer requests explicitly
send `audience: "customer"` to the existing `/api/ask-tate` endpoint. Its server
adapter enforces published, verified, non-archived products and selects only
customer product/ingredient fields. It never queries internal source records for
customer chats. Admin requests retain the existing admin authorization gate and
tools. Neither path uses a service-role key. Customer conversations can retrieve the signed-in account’s profile, wardrobe,
report count/history and full report sections through read-only tools. Identity
comes from the verified token with explicit owner filters plus RLS. Queries use
customer-facing projections, omit raw photos, contact details and precise location,
and retrieve personal records only when needed. Report counts cover saved cloud
reports, excluding deleted records; device-only reports are unavailable. Owned
wardrobe records can include unpublished products without exposing internal catalog
notes. The model receives dated report observations separately from current profile
and wardrobe data. Conversation
state is held in the account-keyed chat page, survives opening and closing the
Profile drawer, and clears on account changes or New chat. The message composer
stays fixed beneath the scrolling conversation.

Production web uses the same-origin API, including the localhost production
preview; development uses the existing port 4318 server. Native builds require
`EXPO_PUBLIC_TATE_API_URL`. The chat supports evidence record names, follow-up
pagination, loading status, retryable errors, and bounded recent-turn history.

Tate enforces a skincare/beauty scope before catalog or account retrieval for both
customer and admin conversations. A structured server-side classifier permits
skincare, beauty products, brands/companies and beauty-industry questions, plus
Substrate reports/profile/wardrobe questions. Unrelated and mixed unrelated tasks
receive a fixed redirect; classifier errors fail closed with a retry message.
Answer instructions reinforce the same boundary, including against scope-changing
instructions embedded in user messages or retrieved records. This model-based
boundary reduces topic drift but is not a guarantee against every adversarial prompt.
