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

## Internal Face Scan Lab

Run `npm run prototype:face-scan` and open `http://localhost:4317/face-scan-prototype` for the isolated YouCam/OpenAI comparison prototype. It uses server-only keys in the root `.env` and keeps experiment-saving controls hidden during the current prototyping phase. See [prototype documentation](prototypes/face-scan/README.md).

## Current Product Areas

- Daily photo capture and check-in.
- Today's Skin Story.
- Today's Plan checklist.
- Profile setup.
- Environment snapshots.
- Skin Wardrobe and Add Products flow.
- Admin product catalog.

Before changing Expo app code, read the exact versioned Expo docs referenced in `AGENTS.md`.

### Ask Tate (admin product chat)

The web catalog's **Ask Tate** drawer queries current product, ingredient, and source records through the signed-in administrator's Supabase session. The server uses the existing `OPENAI_API_KEY` and optional `OPENAI_MODEL` environment variables; never expose the API key with an `EXPO_PUBLIC_` prefix. Vercel serves `/api/ask-tate` alongside the exported web app and needs the same existing Supabase public connection variables and OpenAI server secret.

For local development, run `npm run tate:server` alongside `npm run web`. The chat server loads `.env` and `.env.local` and listens on loopback port 4318. If needed, set `EXPO_PUBLIC_TATE_API_URL` to another chat endpoint and `TATE_PORT` to change the server port. Run `npm run test:tate` for authorization, database retrieval, pagination, and provider failure tests.
