# Daily app implementation — 22 October 2026

Local implementation on `main`, starting at `c58791584fbb15fd73f13203b0a3edb0c59e52af`. No commit, push or deployment was performed in this implementation task. The approved migration was subsequently applied by a separate dedicated IAB task, as recorded below. Existing catalog changes were preserved.

## Entry and journey

Open `/home`, sign in using an existing authorized account, and choose Continue setup. The public `/` landing page has no added sign-in link. Routes: `/onboarding`, `/daily-check-in`, `/your-day`, `/summary`, `/skin-wardrobe`, `/shop`, `/you`. Old report/history routes remain available.

Onboarding reuses the profile editor, photo preparation/analysis, wardrobe scanner and report engine. Six profile sections precede explicit analysis-context review. Unknown answers are not populated with sample values. Name, age, explicit allergy/sensitivity and unambiguous goal mappings are reused. A declined allergy answer remains declined in the profile and unresolved in the ingredient engine. Existing reports can be reused as dated baselines; they are not rewritten.

Front is required for a new scan. Side photos are optional and are never claimed to be analyzed. Selected views first persist as per-user device drafts, then upload to the existing private `daily-photos` bucket under owner/baseline paths. Upload failure preserves the draft and offers retry. Baseline references can restore uploaded images. No new storage permission is applied.

The proposed $19.99/month step is visibly simulated. It collects no card details, activates no subscription and grants no paid entitlement. New `daily-summary-v1` results bypass the legacy report purchase UI without changing legacy unlock records. Summary cards separate current self-report, dated observations and ingredient/catalog evidence. Source versions remain visible. Profile/wardrobe changes mark tracked summaries out of date.

## Persistence checkpoint — migration applied by dedicated IAB task

`supabase/migrations/202610220001_app_journey.sql` was applied by the dedicated IAB task after explicit approval. It adds an owner-scoped journey table and revision-checked save RPC. Do not reapply it. Do not run `supabase db push` automatically: that could apply unrelated pending migrations.

Until that migration is applied, onboarding progress is clearly labelled device-only. Existing profile, wardrobe, photos and reports continue to use their existing account services when the user explicitly saves. Private image references cannot be resumed on another device until journey sync exists. Competing offline/device edits are retained locally rather than silently overwriting remote data; the conflict panel offers refresh, use-account, or keep-device-and-sync. Both versions are backed up locally before choosing; a second remote change rejects a stale choice. Saves are serialized per account.

## Daily behavior

Daily entries use the device-local calendar date. Completing a routine no longer advances a simulated date. Historical rows are not relabelled or erased. Confirmation of an older same-date entry retains its original check-in as `legacySnapshot`.

Tate's `/api/daily-draft` endpoint authenticates and extracts proposed fields from a user note; it has no database-write path. Manual input is always available. Suggestions stay editable until Review and Confirm & save. The daily save checks the original row timestamp and the current date. Optional front photo uses the existing upload/analysis route. Manual wellness entry is self-report; wearable sync is unavailable.

Your Day combines existing rules with active owned products whose saved role, daily frequency and AM/PM preference match. Named products reflect the user's existing routine, not a claim of clinical suitability. Irritation-sensitive products are excluded when context is irritated or unknown. Missing product metadata stays generic. Treatment products are not automatically assigned by the owned-product helper. The original ingredient engine remains intact.

Plan fingerprints include confirmed observations, photo results, profile, weather and wardrobe. Changed inputs require regeneration. Completion persists only for stable matching actions. Weather refresh uses an explicitly saved location. The main day screen does not display invented clinical scores. Legacy progress/analysis remains historical prototype data.

Shop only reads published catalog entries and ingredient detail. No checkout, orders, prices, partners, trials or testing integrations are added. Skin Plate remains unavailable. Shared navy/cream primitives and warm copper accent are reused; no logo or imagery was invented.

## Verification and limits

Run `npm run lint`, `./node_modules/.bin/tsc --noEmit --incremental false`, `node --test server/*.test.mjs`, and `npm run build:web`. Server tests use fixtures/mocked services; the production routing test uses a temporary local server. Do not replace them with calls that write to the production-connected account.

Final pass: 57 server tests passed, including the original 40 report/photo/product/Tate tests. Documented Expo lint passed with one pre-existing environment.ts style warning. The broad `eslint .` command separately encounters Node/Deno/parser configuration issues and is not the same scope as Expo lint. Web export and localhost HTTP checks passed. Re-run checks after any edits.

No authenticated end-to-end, physical camera, private cloud upload, deployed migration or live provider test was performed. IAB inspection tooling was not exposed in this execution context; Chrome was not used. Test the full flow only with an approved isolated test account/environment: onboarding/resume, profile/wardrobe edits, optional view retry, simulated subscription, summary staleness, check-in confirmation, daily-photo skip, date rollover, routine invalidation, and legacy report access.

The exact newer references were not found in the synced Dropbox Substrate folder: `Luxury Skincare App Onboarding Screens.png`, `Substrate Beauty Wellness App Showcase.png`, `SUBSTRATE Wellness App Experience.png`. No claim of inspecting those pixels is made. Exact visual matching and interactive accessibility review remain pending reference transfer and IAB access.

## Exact migration target and approval scope

The configured public host is kfwzpoeyirnrmsbrynvc.supabase.co; the linked project ref is kfwzpoeyirnrmsbrynvc. No local Supabase configuration, CLI, isolated environment or safe test account was identified. The production/staging label is unverified: treat it as shared/live. A zero-row REST probe returned 404/PGRST205 for app_journey_state and 200 for profiles.

Approval would authorize applying ONLY supabase/migrations/202610220001_app_journey.sql to project kfwzpoeyirnrmsbrynvc after confirming this is the intended shared target; prefer an isolated development project first. It adds one table, owner SELECT policy/grant, and authenticated revision-checked RPC. Existing catalog, profiles, photos, reports and billing are not altered. The auth-user foreign key cascades deletion only to that user's new journey row. Risks include incorrect policy/function grants and real multi-device behavior; mocked tests do not replace review. The subsequent approved application is recorded below.

Rollback should disable the new RPC grant first and retain/back up journey rows, returning to device-only progress. Dropping the table destroys newly synced progress and needs separate approval after backup. Do not broadly push unrelated pending migrations.

Daily check-in directly links optional front photo to /photo, with return to check-in and device draft preservation. Missing journey schema degrades to labelled device-only onboarding. Existing account services remain available for explicit user saves.

## Reference transfer blocker

The three exact version-0 Library references were resolved on 22 October. The current required Library helper failed with 'library file transfer failed: download failed' for each image, both normally and once with network-enabled execution. No bytes were materialized or inspected. This was an execution failure, not an approval denial. No raw-download fallback was attempted. Visual fidelity work remains blocked until supported transfer succeeds; shared-theme changes are not a verified match.

## Migration and local reference checkpoint — 22 October

Parent reports dedicated IAB task 01a161ab-86d1-712f-960a-18e3dd1770df applied ONLY the approved migration to kfwzpoeyirnrmsbrynvc. That task verified table, RLS, owner SELECT, foreign key and security-definer RPC; create/update/stale-revision/cross-user/unauthenticated checks ran in a rolled-back transaction with zero persistent rows. These database checks are attributed to that task, not repeated here. Existing default anonymous EXECUTE remains, with the RPC authentication guard rejecting unauthenticated calls; no further grants were changed.

Independent read-only verification here: the configured REST endpoint app_journey_state with select=revision&limit=0 returned HTTP 200 (previously 404/PGRST205). The app adapter reads this same table and writes via save_app_journey; schema visibility is confirmed, but this task did not exercise authenticated browser resume/save or multi-device interaction. Device-only fallback remains for connectivity/save errors. Earlier approval-pending and missing-schema notes describe the previous state.

Local /home returned HTTP 200; unauthenticated daily-draft POST returned 401. Servers remain running.

Three same-named PNGs were found and inspected under /Users/dzuy/Library/CloudStorage/Dropbox-Emmajustice/Emmajustice Team Folder. Their layouts depict the described navy/cream/copper experience, but they do NOT match the pinned Library original hashes:
- Luxury Skincare App Onboarding Screens.png: 1671091 bytes; SHA256 165927618867fcc15df1940a6a17f888705adc3808f2d5b28a55f5710df265ed
- Substrate Beauty Wellness App Showcase.png: 2182737 bytes; SHA256 c89a4b16cfaa44db511c38404d120d93e616b5f1f690f36e3cee66b9b3c58ea8
- SUBSTRATE Wellness App Experience.png: 1967290 bytes; SHA256 f77bdd199092660de0099b3895e3e120b55cbf9aac28fa619bfe949498993dac

Reference identity confirmation is pending before visual changes. No Library download was retried. Downloads folder enumeration returned Operation not permitted; no retry or workaround was attempted. Dropbox files were readable.

## Visual source correction — STOPPED

User clarified that the email attachments are newer than the Dropbox versions. The Dropbox versions are 1536×1024, but matching compositions do not authorize substituting them for the newer email references. Visual work stopped immediately upon correction. No visual rollback has been performed; no functional changes were reverted.

One provisional visual pass had already been applied before the correction:
- src/report/theme.tsx: deeper navy, warmer cream/surface, muted text and border defaults.
- src/report/ui.tsx: dark-surface context, optional dark frame, smaller title and content width/spacing, cream panels/notices, pill buttons with optional copper variant, NautilusArt component.
- src/components/substrate-ui.tsx: navy bottom navigation with copper active state.
- src/app/daily-check-in.tsx: dark presentation, decorative art, revised heading, copper draft/review buttons.
- src/app/onboarding.tsx: dark welcome/subscription/wellness/complete presentation, art replacing small spiral on welcome, copper primary actions.
- src/app/your-day.tsx: dark presentation, heading and routine-section labels, copper regeneration action.
- assets/images/nautilus-daily-v1.png: newly generated decorative asset, copied from task workspace. Built-in imagegen was used; prompt requested a luminous translucent copper-and-blue nautilus on dark navy with no text/UI/branding. It is provisional, not an approved logo or email-derived asset.

Home, summary, shared AppHeader and underlying journey/daily/database logic were not edited by this visual pass. Exact mutation script is retained at /tmp/substrate-visual.py for selective review; it must NOT be rerun. Existing catalog diff still matches the pre-task snapshot. The newer pinned email references remain required, and exhausted Library downloads must not be retried or bypassed.

## Authoritative October 21 email reconciliation — completed local code pass

The retrieval task supplied references/emma-email-originals/Luxury Skincare App Onboarding Screens.png and Substrate Beauty Wellness App Showcase.png. Both actual 640×427 files were viewed here and SHA256 verified against the pinned email identities (7fd880681460574df03ccde70396d0b7e35b91f8545e17f3f48d13f2061e6edf and 9b2fec12472ed7b34658246b9d3ab2e8ba76a1712f18a705155b58266f7f962d). These replace Dropbox as the design authority. The October 20 Experience email image remains unavailable and was not substituted.

Reconciled and retained the navy/cream palette, serif headings, copper pill actions, cream cards, dark navigation and decorative nautilus because they are visible in the verified newer originals. Extended the real app with a shared responsive evidence-summary grid, membership preview card, optional manual-wellness card, compact letterspaced app header, and Home with Tate/day entry plus functional category cards. No mockup measurements, paid membership confirmation, partner identities, wearable connections or commercial transactions were copied. Home uses existing iconography instead of inventing product photography or presenting a stock face as the user's skin. The generated nautilus is supporting art, not a logo or exact reproduction. Saved design-system overrides remain respected.

Newer onboarding and showcase support this shared direction. Exact October 20 five-screen Experience layout and deeper category-detail treatments remain uncovered. Actual browser layout, responsive screenshot comparison, keyboard/screen-reader operation and authenticated end-to-end QA remain unverified: no IAB inspection/screenshot tool was exposed here, and Chrome was never used. Do not describe this as pixel-perfect or fully visually verified.

Verification after reconciliation: TypeScript passed, Expo lint passed with the one pre-existing environment.ts array-type warning, 57/57 server tests passed, web export passed, diff check passed. /home HTTP 200; unauthenticated daily-draft HTTP 401. Original catalog diff remains byte-identical to the starting snapshot. Servers remain running. No database, grant, deployment, push or production-data changes were performed in this pass.

Generated asset: assets/images/nautilus-daily-v1.png, built-in imagegen. Original retained at /Users/dzuy/Documents/Codex/2026-10-20/task-4/generated_images/exec-fa4197cf-ddaa-4492-bfe8-8d50e24d93b3.png.
Prompt: Create a decorative app illustration, not a logo or UI: a single luminous translucent nautilus shell in side cross-section, elegant logarithmic spiral with fine glowing copper/golden chamber edges and subtle deep ocean blue translucent chambers. Centered floating on uniform extremely dark navy #031927 background, generous clean margin all sides. Quiet luxurious editorial wellness mood, soft warm light, delicate wisps near shell only. Square artwork. No text, letters, symbols, interface, people, brands, borders or watermark. This is supporting atmospheric artwork for a skincare app with cream cards and copper accents.

## Independent IAB QA corrections

Inspected the supplied real IAB screenshots (Home desktop/mobile, check-in form, Your Day, summary and onboarding). Corrected the issues identified without saving live account data:
- JourneyResult now distinguishes service availability from having a synced row. A successful empty read means available=true/cloud=false; fresh onboarding says progress will save when continuing. Offline/missing-schema errors remain unavailable. Two new regressions assert empty reads do not create rows and distinguish unavailable service.
- Bottom navigation explicitly emits aria-selected. Shared titles/headings have header semantics and aria-level 1/2.
- Home artwork reduced from a separate 260px row to an inline 68px mobile/110px desktop ornament. Main actions are adjacent, setup card compacted, category tiles use two mobile columns and four desktop columns with decorative still-life/spiral images. Images are explicitly described as decorative, not saved products.
- Check-in decoration reduced from a 230px row to a 70px noninteractive ornament; welcome artwork reduced to 110px.
- New nautilus-daily-v2.png is a circular luminous spiral with alpha transparency (sips confirmed hasAlpha=yes), replacing the realistic square-backed asset in active UI. Original v1 retained. New skincare-still-life-v1.png is generic unbranded decorative imagery.

Both new assets used built-in imagegen and were inspected. Original outputs retained in task-4/generated_images: exec-76d49334-4b22-48a3-971c-9a6e10e7377b.png and exec-579fb69d-accc-4183-b443-e3db458d58f3.png.
Spiral prompt: Decorative luminous logarithmic nautilus spiral for a luxury skincare app. A nearly circular flat spiral with delicate fine copper gold chamber lines, translucent deep blue chambers and subtle warm glow, viewed straight on. Smooth precise flowing radial curves like an ethereal mathematical spiral. NOT a realistic seashell: no pointed opening, no shell lip, no rough organic surface, no large protrusion. Isolated on fully transparent background, soft glow fading into true transparency at all edges. No dark square, no frame, no lettering, no logo, no symbols, no UI. Centered with generous transparent margin; elegant restrained light suitable for placing over any dark navy background.
Still-life prompt: Editorial decorative still life for a skincare app category card. Small group of unbranded cream ceramic skincare pump bottles and one amber glass dropper, with a folded cream linen cloth on a warm ivory limestone surface. Soft side light, muted copper accents, elegant understated luxury. Wide horizontal composition, products central with breathing room. No words, no labels, no logos, no ingredients, no hands, no health claims. These are generic decorative containers, not actual catalog products.

Validation: 59/59 server tests pass (including the previous 57), TypeScript passes, Expo lint passes with its one existing environment.ts warning, web export passes, diff check passes. Catalog diff remains byte-identical. Read-only browser recheck is pending with parent QA; no new rendered screenshots are claimed here. Populated routines/summary and later onboarding still require an approved safe test environment rather than synthetic production records.

## Final small polish after independent browser recheck

Parent's independent IAB recheck confirmed the preceding fixes/navigation and no horizontal overflow. Inspected its Home/onboarding screenshots here. Final changes: Home visible label is now 'Check in' with accessible name 'Check in with Tate'; price is ordinary styled text instead of a second h1 on both welcome/subscription; welcome art and description share a compact row, and simulation copy is shortened while retaining the no-charge disclosure. This moves the next action upward without changing its behavior.

Active artwork is now assets/images/nautilus-daily-v3.png, a softer desaturated navy/copper edit of v2; alpha transparency verified. Built-in imagegen edit prompt: Edit this decorative spiral only in color and lighting. Preserve the nearly circular spiral geometry and transparent background. Remove the vivid sapphire/cyan jewel-like color and glossy bright highlights. Use very dark desaturated navy translucent chambers with soft muted copper amber chamber lines and a restrained diffuse warm glow. Overall much softer, dimmer, quieter, airy and elegant, matching fine copper illuminated nautilus linework on navy. No metallic glitter, no gemstone look, no blue glow. Preserve alpha transparency outside the ornament and its soft edge. No text or logo.
Original output retained at task-4/generated_images/exec-2634ec8b-0d46-4aa1-aa15-c74e538938ca.png; earlier variants retained. No production writes, permission changes, deployment or push. Catalog diff remains unchanged. Final small edits still require rendered browser recheck; prior IAB results are not claimed as verification of these last edits. Manual user testing may proceed at http://localhost:8081/home, understanding that explicitly saving uses the configured shared account backend and that billing remains simulated. Populated routines/summary, later onboarding, camera and cross-device browser saves remain unverified end to end.
