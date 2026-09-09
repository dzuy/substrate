# Substrate Technical Architecture

Last updated: September 8, 2026

This document is for future agents and engineers working on Substrate. It explains the current architecture, the product strategy behind it, and the main extension points.

## Product Strategy

Substrate is a mobile-first skincare intelligence app. The product is organized around a daily loop:

1. Capture or upload a daily face photo.
2. Complete a daily check-in.
3. Store environment, profile, and skin context.
4. Generate Today's Skin Story.
5. Generate Today's Plan as a checklist.
6. Track progress and use the user's Skin Wardrobe to make future plans more specific.

The app should avoid becoming a generic beauty-commerce app. Product and ingredient data exist to make recommendations more personal and useful, not to push shopping.

## Application Stack

- Frontend: Expo Router, React Native, TypeScript.
- Backend: Supabase Auth, Postgres, Storage, Row Level Security, Edge Functions.
- AI: Supabase Edge Functions call OpenAI server-side. Expo client code must not expose OpenAI or service-role keys.
- Styling: shared components and theme live in `src/components/substrate-ui.tsx` and `src/constants/theme.ts`.

Important project instruction: before changing Expo app code, read the exact Expo SDK docs specified in `AGENTS.md`.

## Route Map

Routes are registered in `src/app/_layout.tsx`.

- `/`: Today home.
- `/photo`: daily photo capture/upload.
- `/check-in`: daily check-in.
- `/environment`: location and weather/environment snapshot.
- `/skin-story`: generated narrative explaining today's skin state.
- `/daily-plan`: generated checklist for today.
- `/skin-wardrobe`: user's saved products.
- `/skin-wardrobe/add-products`: one-product add flow plus product photo recognition.
- `/progress`: progress dashboard.
- `/progress-history`: prior entries.
- `/profile`: one-time profile and settings.
- `/admin-products`: admin-only canonical catalog management.

The product CMS now manages the live Supabase catalog, private source evidence, review resolutions, publication and archives. See `docs/PRODUCT_CMS.md` for the v10 import, table boundaries and verification workflow. Sheet edits do not synchronize automatically with the app database.
- `/reset-password`: password reset route.

`BottomNav` currently exposes Today, Wardrobe, Progress, and Profile.

## Auth And App Shell

`src/lib/auth-context.tsx` owns Supabase session state. `src/app/_layout.tsx` gates the app behind auth and shows `AuthScreen` when there is no session.

Profile creation is handled by `ensureProfile` in `src/services/profile.ts`. User-specific data should always be scoped by `user_id`, with RLS enforced in Supabase.

## Service Boundary Pattern

Screens should stay mostly UI-focused. Data access belongs in `src/services/*`.

Current service boundaries:

- `src/services/daily-entries.ts`: create/list daily entries, active local entry date, check-in persistence.
- `src/services/photos.ts`: photo upload and photo analysis invocation.
- `src/services/environment.ts`: geocoding, Open-Meteo environment snapshots, altitude.
- `src/services/profile.ts`: profile location and profile context persistence.
- `src/services/recommendations.ts`: get/create today's analysis, Skin Story, and Daily Plan.
- `src/services/progress-summary.ts`: progress summaries.
- `src/services/catalog.ts`: brands, ingredients, products, product ingredients, and user wardrobe.
- `src/services/product-recognition.ts`: product image detections and detection status updates.

When adding new product, wardrobe, or plan behavior, prefer extending these service files instead of embedding Supabase calls directly in screens.

## Supabase Data Model

Core daily loop:

- `profiles`: one row per user, keyed by auth user id.
- `daily_entries`: one row per user per day.
- `photos`: daily photo metadata and storage path.
- `environment_snapshots`: weather/environment data for a daily entry.
- `analysis_results`: structured skin signals.
- `recommendation_results`: Skin Story and Daily Plan output.

Product foundation:

- `brands`: canonical product brands.
- `ingredients`: canonical ingredient records.
- `products`: canonical product records.
- `product_ingredients`: many-to-many join between products and ingredients.
- `user_wardrobe_items`: user-owned or user-used products linked by `product_id`.
- `product_detections`: OpenAI product photo recognition candidates.
- `product_submissions`: legacy/optional queue for unknown product review.

The key product relationship is:

```text
user_wardrobe_items.product_id
  -> products.id
  -> product_ingredients.product_id
  -> ingredients.id
```

Today’s Plan should connect to wardrobe products by product id, not product name.

## Skin Wardrobe Strategy

Skin Wardrobe is the user's active product inventory.

Current UX:

- `/skin-wardrobe` shows the user's saved products only.
- `/skin-wardrobe/add-products` lets the user add one product at a time.
- Users can manually enter Brand, Product, Description, and Ingredients.
- Users can choose/take a product image, send it to OpenAI through Supabase, edit the candidate details, and accept the product.
- If OpenAI finds a catalog match, Accept adds that product to the wardrobe.
- If there is no catalog match but Brand, Product, and Description are filled, Accept creates a verified product and adds it to the wardrobe.

Current metadata on wardrobe rows:

- `status`: active, paused, finished.
- `notes`: exists in the database but is currently hidden in the UI to keep cards clean.
- `routine_timing`: AM, PM, either.
- `frequency`: daily, weekly, as needed.
- `routine_role`: cleanser, serum, moisturizer, SPF, treatment, device, other.
- `avoid_when_irritated`: whether Today’s Plan should skip the item during irritation.

Likely next metadata:

- Optional start/end dates.
- User-specific application notes.
- Rotation rules for products used less than daily.

## Product Catalog Strategy

The catalog is shared infrastructure. It should support both:

- Admin-managed canonical products.
- User-created product records from the Add Products flow.

Catalog admin access is controlled by `src/lib/admin.ts` and Supabase RLS using auth app metadata roles. Current accepted roles are `catalog_admin` and `admin`.

The admin page should remain an operations tool, not a primary user flow.

## Ingredient Intelligence Backlog

The ingredient table already exists, but the intelligence layer is intentionally future work.

Planned ingredient expansion:

- INCI names and aliases.
- Functions and ingredient family.
- Barrier, Inflammation, Hydration, Collagen, and Pigmentation impact.
- Irritation potential.
- Comedogenic/acne risk.
- Photosensitivity risk.
- Pregnancy and breastfeeding caution.
- Best timing: AM, PM, either.
- Do-not-combine guidance.
- Evidence level and source notes.

This layer will let Today’s Plan reason from the products a user owns:

```text
User owns active SPF
  -> include SPF in morning plan

User reports itchy/dry skin
  -> favor barrier/hydration products
  -> avoid exfoliating acids or retinoids

User has pigmentation goals and high UV
  -> prioritize SPF and antioxidant support
```

## Today’s Plan Strategy

Today's Plan is moving toward a saved checklist.

Current direction:

- Plan items have a title, description, and done/not-done state.
- The list is saved per day.
- Daily Check-In can later show yesterday's checklist so the user can confirm what was completed.

Future product connection:

- Store optional `product_id` references on plan items or in structured item metadata.
- Choose products from `user_wardrobe_items` where status is active.
- Prefer explicit product references in copy: "Use EltaMD UV Skin Recovery SPF 50" instead of "Apply sunscreen."
- Fall back to generic advice only when no matching wardrobe product exists.

## AI And Edge Functions

OpenAI calls must happen inside Supabase Edge Functions, not in Expo client code.

Current functions:

- `supabase/functions/analyze-photo/index.ts`: face photo analysis.
- `supabase/functions/generate-recommendation/index.ts`: Skin Story and Daily Plan generation.
- `supabase/functions/generate-progress-summary/index.ts`: progress summaries.
- `supabase/functions/analyze-products/index.ts`: product image recognition.

Required secret:

```text
OPENAI_API_KEY
```

Optional model secrets:

```text
OPENAI_MODEL
OPENAI_IMAGE_MODEL
OPENAI_VISION_MODEL
```

Do not add OpenAI keys to `EXPO_PUBLIC_*` variables.

## Environment Data

Environment data currently uses Open-Meteo. Location comes from the profile location flow and is saved to the profile. The environment snapshot includes weather-derived values and altitude.

Pollen is not currently implemented. If added later, confirm whether the selected provider supports the needed pollen data for the target geographies and whether a separate pollen API is required.

## RLS And Security Expectations

Default posture:

- User-owned data should be readable/writable only by that user.
- Shared catalog data can be readable by authenticated users.
- Catalog mutations should be restricted by admin role unless the product add flow intentionally needs user-created catalog records.
- Service-role keys should never be exposed to the Expo app.
- Photos are sensitive and should stay private.

When changing schema, update:

- SQL migrations in `supabase/migrations`.
- Generated or hand-maintained types in `src/types/database.ts`.
- Any affected service boundary.

## Local Development

Typical local commands:

```bash
npm install
npx expo start --web
npx tsc --noEmit
npm run lint
```

Supabase commands commonly used during development:

```bash
npx supabase db push --linked --project-ref kfwzpoeyirnrmsbrynvc
npx supabase functions deploy analyze-products --project-ref kfwzpoeyirnrmsbrynvc
npx supabase secrets set OPENAI_API_KEY=... --project-ref kfwzpoeyirnrmsbrynvc
```

If function deploy returns 403, first confirm the Supabase CLI is logged in with a full-access token for the project owner account and that the local project is linked.

## Agent Guidelines

Before changing behavior:

- Read nearby screens and service files before editing.
- Preserve RLS assumptions.
- Keep UI mobile-first.
- Keep screens calm and focused; avoid turning operational tools into marketing pages.
- Use existing components, theme tokens, and service boundaries.
- Run TypeScript and lint after changes.
- Document new architecture decisions here when they affect future work.

Known existing lint warnings may appear in `src/app/progress.tsx` and `src/services/environment.ts`; do not treat them as caused by unrelated changes unless you touched those files.
