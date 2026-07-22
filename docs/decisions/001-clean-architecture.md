# ADR 001 — Clean Architecture Layering

**Date:** 2026-05  
**Status:** Active

## Decision

The codebase uses a clean architecture layering pattern:

```
domain → application → infrastructure → presentation
```

| Layer | Path | Purpose |
|---|---|---|
| Domain | `src/domain/` | Entities, repository interfaces, domain errors. No framework dependencies. |
| Application | `src/application/use-cases/` | One file per use case. Orchestrates domain objects. No UI or DB code. |
| Infrastructure | `src/infrastructure/` | Supabase repos, mock repos, Supabase client, DI container. |
| Presentation | `src/presentation/` | React pages, components, hooks. Calls use cases via `useContainer()`. |

## Rules

- Domain types (`Prayer`, `PrayerCategory`, `PrayerMeditation`) are defined in `src/domain/entities/` and used everywhere.
- Infrastructure never imports from presentation. Presentation never imports directly from infrastructure (use container).
- `src/infrastructure/container.ts` is the single composition root — it wires repos and use cases, and decides mock vs real.
- `useContainer()` (AppContext) is how presentation accesses use cases.

## Why

Keeps business logic testable in isolation, makes swapping Supabase for another backend mechanical, and prevents "spaghetti" imports across layers.
