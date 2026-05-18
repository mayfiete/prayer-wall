# Clean Architecture — Prayer Wall

Apply this skill whenever writing or reviewing any code in this repository.

## Layer Rules (enforce strictly)

```
Domain ← Application ← Infrastructure
                ↑
           Presentation
```

- **Domain** (`src/domain/`): entities, repository interfaces, domain errors. No imports from any other layer.
- **Application** (`src/application/`): use cases, DTOs. Imports from domain only.
- **Infrastructure** (`src/infrastructure/`): repository implementations, Supabase client, mock implementations, DI container. Imports from domain and application.
- **Presentation** (`src/presentation/`): React pages, components, hooks, context. Imports domain entity types and reaches infrastructure **only** through `useContainer()`.

## The One Rule Presentation Must Never Break

> Presentation code must never import from `src/infrastructure/` except through `AppContext.useContainer()`.

This means:
- No `import ... from '../../infrastructure/repositories/...'` in hooks or components
- No `import ... from '@supabase/supabase-js'` in hooks or components (outside `AdminPage` where auth/assets still depend on it — a known future improvement)
- No repository instances created with `new` inside hooks or components
- No raw repository references passed as props between components

## Container Is the Wiring Point

`src/infrastructure/container.ts` is the **only** place that:
- Instantiates repository implementations
- Wires repositories into use cases
- Decides mock vs. real based on `VITE_USE_MOCK`

The container exports **use cases only** — never raw repositories. If a new operation is needed, add a use case and wire it in the container.

## Use Case Rules

Every user-facing operation that reads or mutates data must have a use case class in `src/application/use-cases/`. Use cases:
- Accept repository interfaces (not implementations) via constructor injection
- Contain all validation logic (domain errors for invariant violations)
- Delegate all I/O to the repository
- Never import from `src/infrastructure/` or `src/presentation/`

## Adding a New Feature — Checklist

1. Add or extend entity in `src/domain/entities/` if the data model changes
2. Add or extend repository interface in `src/domain/repositories/` if new data operations are needed
3. Add use case(s) in `src/application/use-cases/` with validation
4. Add repository implementation(s) in `src/infrastructure/repositories/` and matching mock in `src/infrastructure/mock/`
5. Wire the new use case into `src/infrastructure/container.ts`
6. Consume via `useContainer()` in hooks/components — never via direct import

## Props Must Not Carry Infrastructure Types

Component props may carry:
- Domain entity types (e.g., `PrayerCategory`, `Prayer`)
- Primitive values and callbacks
- UI-only state

Component props must **not** carry:
- `SupabaseClient<Database>` or any Supabase type
- Repository instances (`IPrayerRepository`, etc.)
- Use case instances

If a child component needs a use case, it calls `useContainer()` itself.

## Confirmed Violations Fixed (2026-05-18)

| Violation | Resolution |
|---|---|
| `usePrayerCategoriesAdmin` instantiated `SupabasePrayerCategoryRepository` directly | Removed; uses `useContainer()` |
| `CategoryAdmin` received `SupabaseClient<Database>` as prop | Prop removed; component takes no props |
| `StatementsAdmin` received `IPrayerMeditationRepository` as prop | Prop removed; uses `useContainer()` |
| Container exported raw `statementRepo` | Removed; replaced with 5 meditation use cases |
| No use cases for meditation CRUD | Added `GetMeditations`, `CreateMeditation`, `UpdateMeditation`, `DeleteMeditation`, `SetMeditationActive` |
| No use cases for category admin ops | Added `GetAllPrayerCategories`, `SetCategoryActive`, `DeletePrayerCategory` |

## Known Remaining Gaps (future work)

- `AdminPage` still imports `createSupabaseClient()` directly to supply `AdminAuthGuard` and `AssetAdmin` — auth and asset operations do not yet have use cases
