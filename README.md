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

Server-side OpenAI values belong in Supabase Edge Function secrets and Railway service variables, not in `EXPO_PUBLIC_*` variables.

## Production Hosting (Railway)

Railway hosts the exported Expo web app, Ask Tate, and Face Scan Lab in a single Node service. Supabase continues to provide Auth, Postgres, Storage, and Edge Functions.

- Build: `npm run build:web` (Node 22).
- Start: `npm run start:production`.
- Readiness check: `/healthz`.
- Server: `server/production.mjs`, listening on `0.0.0.0` and Railway's `PORT`.
- Configuration: `.railway/railway.ts`. Run `railway config plan`, review the diff, then `railway config apply` when changing infrastructure. Railway does not automatically apply this file during builds.

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Railway before building. Set `OPENAI_API_KEY`, `OPENAI_MODEL`, and `OPENAI_VISION_MODEL` as server variables. `FACE_SCAN_SIGNING_SECRET` is optional; without it, signing derives from the OpenAI key. Local `.env` files are excluded from deployment uploads.

The server preserves app deep links and serves the lab at `/face-scan-prototype`. Both `/api/ask-tate` and `/api/face-scan-prototype` use their existing handlers. Exported assets are the only files served; server files and secrets are not public. Test routing with `npm run test:production`.

When changing domains, update Supabase Auth's Site URL and allowed redirect URLs, including `/reset-password`, before switching traffic. Verify sign-in, password recovery, admin chat, and photo analysis on the new domain. `vercel.json` remains available for the previous deployment during the transition.

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
- `/admin`: read-only user directory with names, emails, trusted app roles, verification, joined date, and last sign-in. Search and pagination run in Supabase through `list_admin_users`; only users with `admin` in trusted app metadata can access it. `catalog_admin` alone is insufficient. Apply `supabase/migrations/202610010001_admin_users.sql` and validate with `supabase/tests/admin_users.sql`. No service-role key is sent to the browser.

Before changing Expo app code, read the exact versioned Expo docs referenced in `AGENTS.md`.

### Ask Tate (admin product chat)

The web catalog's **Ask Tate** drawer queries current product, ingredient, and source records through the signed-in administrator's Supabase session. The server uses the existing `OPENAI_API_KEY` and optional `OPENAI_MODEL` environment variables; never expose the API key with an `EXPO_PUBLIC_` prefix. The production server serves `/api/ask-tate` alongside the exported web app and needs the same existing Supabase public connection variables and OpenAI server secret.

For local development, run `npm run tate:server` alongside `npm run web`. The chat server loads `.env` and `.env.local` and listens on loopback port 4318. If needed, set `EXPO_PUBLIC_TATE_API_URL` to another chat endpoint and `TATE_PORT` to change the server port. Run `npm run test:tate` for authorization, database retrieval, pagination, and provider failure tests.
