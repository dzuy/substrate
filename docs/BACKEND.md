# Backend Foundation

Substrate V1 uses Supabase as the planned backend foundation for authentication, Postgres persistence, and private photo storage.

## Local Environment

Copy the example env file:

```bash
cp .env.example .env.local
```

Set:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

These values are public client values. Do not put service-role keys or OpenAI keys in Expo `EXPO_PUBLIC_` variables.

## Schema

The initial database migration is:

```text
supabase/migrations/202608030001_initial_backend.sql
```

It creates:

- `profiles`
- `daily_entries`
- `photos`
- `analysis_results`
- `recommendation_results`
- private `daily-photos` storage bucket
- row-level security policies for user-owned data

## Client Code

Client initialization lives in:

```text
src/lib/supabase.ts
```

Typed service boundaries live in:

```text
src/services/auth.ts
src/services/daily-entries.ts
src/services/photos.ts
```

The current app UI is not yet wired to these services. The next implementation milestone is authentication UI and session-gated routing.
