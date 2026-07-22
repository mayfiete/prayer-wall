# ADR 002 — Supabase `prayer_wall` Schema

**Date:** 2026-05  
**Status:** Active

## Decision

All application tables live in a dedicated `prayer_wall` Postgres schema, not in `public`.

## Consequences

### Frontend client
`src/infrastructure/supabase/client.ts` creates the client with:
```typescript
db: { schema: 'prayer_wall' }
```

### Edge functions
Each edge function creates its own Supabase client (service role) with:
```typescript
const supabase = createClient(url, serviceRoleKey, {
  db: { schema: 'prayer_wall' },
})
```
**If you omit `db: { schema: 'prayer_wall' }` in an edge function, all queries will silently hit `public` and return empty results.**

### `types.ts` is manual
`src/infrastructure/supabase/types.ts` is maintained by hand — it is NOT auto-generated. Every new migration that adds a table or column must be reflected here manually, or TypeScript queries will fail.

### Service role grant
Migration `019_grant_service_role_schema.sql` grants `USAGE` on the `prayer_wall` schema to `service_role`. This must be run or edge functions will get permission errors even with the correct schema config.

### RLS policies
All tables have RLS enabled. Public reads use `anon` role. Admin writes require `authenticated` role. Edge functions use `service_role` which bypasses RLS.

## Why

Isolates this app's tables from Supabase system tables and any other future apps sharing the same project. Avoids name collisions with Supabase's built-in `public` schema tables.
