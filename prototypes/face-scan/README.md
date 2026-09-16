# Face Scan Lab

Isolated internal web prototype. No Expo screens, main-app navigation, Supabase records, or production photo-analysis behavior are changed. The standalone source lives here alongside the main application source so the existing Vercel project can eventually serve both.

## Local use

Requires Node 22. From the Substrate root:

```sh
npm run prototype:face-scan
```

Open http://localhost:4317/face-scan-prototype. The local server binds to loopback only. Restart after changing `.env`.

The root `.env` supplies server-only variables:

```dotenv
OPENAI_API_KEY=...
YOUCAM_API_KEY=...
# Existing main-app model configuration is reused; fallback matches analyze-photo.
OPENAI_VISION_MODEL=...
# Required when hosted; optional locally.
FACE_SCAN_PROTOTYPE_PASSWORD=...
# Optional stable task-signing key (defaults to YOUCAM_API_KEY).
FACE_SCAN_SIGNING_SECRET=...
```

Never prefix these secrets with `EXPO_PUBLIC_`, `NEXT_PUBLIC_`, or `VITE_`. No keys are sent to the browser. The root `.env` remains gitignored. No paid calls happen until Run comparison is clicked. If only one provider is configured, its runs remain usable and the others are visibly skipped.

## Comparison design

- Detailed OpenAI: one high-image-detail call with four nullable concern scores, regional observations, and explicit 0/25/50/75/100 visibility anchors. Prompt version: `four-concern-anchors-v2`. Older saved results are labeled with their earlier scoring prompt.
- YouCam: `/s2s/v2.1/task/skin-analysis`, HD redness/acne/texture/pore, JSON results, preblended overlays. Estimated consumption is 12 units per successful task. No dollar estimate is invented; OpenAI token usage is recorded.
- Missing or invalid metrics stay unavailable. Only whole-face YouCam scores are compared, using `(100 - raw_score) * 100 / 99` to align its 1–100 health range to 0–100 concern. Original raw/UI scores remain in the response. Range alignment is not empirical calibration; score differences are not accuracy measurements.
- The browser decodes and re-encodes a JPEG, dropping original metadata, max long side 2560, min short side 1080, max upload 2.8 MB. Identical prepared bytes are sent to every run; providers record SHA-256. Camera capture uses the browser, not Perfect's restricted Camera Kit.

## Privacy and saving

Unsaved photos/results live in page memory. Save explicitly writes photo, outputs, overlays, task reference, configuration, and notes to this browser's IndexedDB. This is not shared cloud storage. Deleting browser data removes saved experiments. Export JSON contains sensitive images and results and should be handled accordingly.

After receiving scores and downloading every available overlay, the browser asks the server to delete the completed YouCam task using `/s2s/v2.0/task/delete`. The UI distinguishes confirmed deletion, pending work, and failures. A partial overlay download leaves the task available and exposes deletion retry. The API documentation says deletion includes associated input/output files; this is not a verified backup purge. Task tokens expire after 30 days and become invalid if the signing secret changes.

Keep the tab open during a run. If polling fails or takes over five minutes, Resume retrieves the existing task without submitting another paid analysis. Save pending experiments to retain their task references. Tab crashes/closure before saving or before receiving a task ID can leave files with the provider. Upload success followed by task creation failure can also leave a file; the UI reports this explicitly. There is no background cleanup worker in this prototype.

OpenAI requests set `store: false`; this is not a claim of zero provider retention. Provider policies apply independently of local experiment saving. Send consenting adults' test photos only. The prototype does not make diagnoses or recommend ingredients from image scores.

## Vercel (prepared, not deployed)

`npm run build:web` exports Expo, then copies only `public/` into `dist/face-scan-prototype`. Explicit rewrites precede the Expo fallback. `api/face-scan-prototype.mjs` is a Node function using the same handler as local development. Requests use short YouCam start/status/asset/delete operations rather than one long-running polling function. OpenAI calls allow up to 110 seconds; the function duration is configured for 180 seconds, subject to the project's plan.

Add the server secrets to Vercel's environment settings. Hosted API access fails closed without `FACE_SCAN_PROTOTYPE_PASSWORD`. Testers enter that password in the page; it stays in memory. Use Vercel Deployment Protection as appropriate for wider internal access. A shared password is an internal prototype gate, not per-user production authentication or a distributed rate limiter. Set provider spending limits before expanding access.

Saved experiments remain browser-local on Vercel; shared experiment storage and individual tester identities are future work. Run a protected preview deployment and validate route precedence/function behavior before production promotion.

## Validation

```sh
npm run test:face-scan
npx tsc --noEmit
npm run lint
npm run build:web
```

Transport tests use mocked providers and no real faces. Live endpoint/account compatibility, output appearance, timing, and deletion behavior must be checked with a consenting test photo after both credentials are present.

References: [YouCam skin analysis](https://docs.perfectcorp.com/reference/ai_skin_analysis), [task deletion](https://docs.perfectcorp.com/reference/task_management), [OpenAI image inputs](https://developers.openai.com/api/docs/guides/images-vision).

### Regional OpenAI experiment

The lab defaults to GPT-5.6 Sol, with Terra and Luna selectable per run. YouCam is opt-in so OpenAI experiments can run independently. Model selection is server-allowlisted and recorded in each response. Regional prompt `regional-concerns-v3` returns four concern scores per visible facial region and approximate normalized polygons. These are model-estimated anatomical outlines, not landmark detection or pixel-level concern segmentation. Invalid outlines are omitted; missing scores remain unavailable. Older saved runs need a fresh analysis to obtain regions. The original image is preserved under an SVG layer; hover/focus previews and click selects. Evidence panels sit together above whole-face concern signals.

Cost estimates support the three selectable models using standard published rates verified September 16, 2026. Sol's promotional rate should be reviewed after November 21, 2026. No claim of parity with YouCam is made; evaluate localization and repeated-run consistency before integration.
