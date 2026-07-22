# ADR 003 — Mock vs Supabase Repository Wiring

**Date:** 2026-07 (documented after bug)  
**Status:** Active

## Decision

`src/infrastructure/container.ts` is the single place that decides which repository implementation is used. The `VITE_USE_MOCK=true` env var switches the entire app to in-memory mocks for local development without a Supabase connection.

## The pattern

```typescript
if (USE_MOCK) {
  // All mock repos — data lives in memory, resets on page reload
  meditationRepo = new MockPrayerMeditationRepository()
} else {
  // All Supabase repos — data persists to the database
  meditationRepo = new SupabasePrayerMeditationRepository(supabase)
}
```

## The bug this ADR documents (Jul 2026)

`SupabasePrayerMeditationRepository` was never created. The `else` branch accidentally used `MockPrayerMeditationRepository` in production, so all meditation data was lost on every page reload and never written to the database. Meditations appeared to save in the admin UI but were never persisted.

**Fix:** Created `SupabasePrayerMeditationRepository.ts` and wired it in the `else` branch.

## Rule for future repositories

**Every new repository interface must have both a `Mock*` and a `Supabase*` implementation, and both must be wired in `container.ts`.** If you add a new `IPrayerXxxRepository`, the checklist is:

- [ ] `src/infrastructure/mock/MockPrayerXxxRepository.ts`
- [ ] `src/infrastructure/repositories/SupabasePrayerXxxRepository.ts`
- [ ] Both wired in `container.ts` — mock in `if (USE_MOCK)`, Supabase in `else`
- [ ] Table type added to `src/infrastructure/supabase/types.ts`
