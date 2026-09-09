# Substrate

Substrate is a mobile-first skincare intelligence app built with Expo, React Native, TypeScript, Supabase, and OpenAI-backed Edge Functions.

## Technical Docs

Start here when working on the app:

- `docs/ARCHITECTURE.md`: current app architecture, data model, strategy, and agent guidance.
- `docs/BACKEND.md`: backend setup notes.
- `docs/PRODUCT_CMS.md`: live product CMS, v10 source import and catalog workflow.
- `docs/PRD.md`: product requirements and backlog.
- `docs/SKIN_SCORE_TRD.md`: skin score technical requirements.

## Local Development

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npx expo start --web
```

Check the project:

```bash
npx tsc --noEmit
npm run lint
```

## Environment

Client-visible Supabase values:

```text
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Server-side OpenAI values belong in Supabase Edge Function secrets, not in `EXPO_PUBLIC_*` variables.

## Current Product Areas

- Daily photo capture and check-in.
- Today's Skin Story.
- Today's Plan checklist.
- Profile setup.
- Environment snapshots.
- Skin Wardrobe and Add Products flow.
- Admin product catalog.

Before changing Expo app code, read the exact versioned Expo docs referenced in `AGENTS.md`.
