---
name: clean-architecture
description: Apply Prayer Wall's clean architecture with security-focused review of trust boundaries, authorization, data exposure, payments, and regression tests.
---

# Clean Architecture — Prayer Wall

Apply this skill whenever writing or reviewing any code in this repository.

## Security-Oriented Engineering

Treat security as part of correctness, not a separate final audit. Scale the review to the change: a copy edit does not require a full security assessment, but changes to data access, authentication, payments, or integrations require explicit trust-boundary checks. Follow `AGENTS.md` for project-specific rules and verification commands.

### Trust Boundaries and Authorization

- Identify the caller, untrusted inputs, sensitive data, and permitted actions before changing a flow. Follow data through the browser, edge function, database, Realtime, logs, and email where relevant.
- Browser code is not a security boundary. UI guards, hidden fields, TypeScript types, and client-side validation do not prevent direct API calls. Enforce authorization and input validation on the server/database as well.
- Authentication does not imply administrator authorization. Policies for `authenticated` must not automatically grant administrative access; use trusted, server-enforced role or ownership checks.
- A valid Supabase JWT or public anon key is not proof of service-role authorization. Privileged edge functions must explicitly authorize their callers before using elevated credentials. CORS is not authentication or rate limiting.

### Database and Data Exposure

- Apply least privilege to both rows and columns in the `prayer_wall` schema. RLS controls rows; it does not hide sensitive columns.
- PostgreSQL grants are additive: a column-level REVOKE does not override table-level SELECT. Remove broad grants, including relevant PUBLIC/inherited access, before granting an explicit public column allowlist. Never restore broad access merely to fix a permission error.
- Keep public repository projections aligned with column grants, including every column actually requested. Restricted browser queries must not use `SELECT *`. New private columns must remain inaccessible by default.
- Verify effective permissions for `anon`, `authenticated`, and `service_role`; do not trust policy names, comments, or frontend field selection as evidence of protection.
- Check API projections, filters, joins, RPCs, and Realtime payloads where relevant. Hiding a value in the UI or removing it after receipt does not prevent exposure. Keep legitimate public reads and trusted backend operations working.
- Minimize retained donor identity and raw webhook data; restrict access and consider retention. An anonymous wall label does not mean the processor or backend lacks donor identity, nor does it authorize public disclosure.

### Payments, Secrets, and Untrusted Content

- Preserve Stripe-hosted Checkout for real payments. Never collect real card numbers or CVC in app-owned fields, store them, or log them. Keep mock card-entry forms out of public production deployments.
- Keep service-role credentials and payment secrets server-side; `VITE_*` configuration is public. Do not log secrets, donor records, full checkout URLs, or raw payment payloads unnecessarily.
- Preserve raw-body webhook signature verification, timestamp tolerance, paid-status checks, wall ownership checks, test/live isolation, and transactional idempotency. A success redirect is not proof of payment.
- Validate redirect destinations, bound inputs, and consider abuse controls for public endpoints. Escape untrusted values inserted into email HTML; do not assume React's output escaping protects server-generated content.
- Hosted Checkout reduces PCI scope but does not establish compliance. Separate verified code safeguards from unverified deployment settings, operational controls, and merchant obligations.

### Security Verification and Change Safety

- Reproduce an access-control bug with synthetic data in a disposable environment, add a failing regression test, then fix the underlying policy or permission boundary.
- Test both denied access and intended behavior: private reads/filters and unauthorized writes must fail, public projections must succeed, and service-role processing must remain functional. For Realtime changes, test actual payloads on existing and new subscriptions.
- Test migration reruns and preservation of records. Use a new sequential corrective migration rather than assuming edits to an old migration repair a deployed database. Update manually maintained types when tables or columns change.
- Verify live project identity and inspect permission metadata or zero-row queries before considering access to donor records. Do not make real payments, send emails, or mutate live data for a security test without explicit approval. Migrations are applied manually by the user.
- Run relevant tests/build checks and review affected dependencies. Do not weaken security controls to make checks pass. Report blocked or skipped checks explicitly; distinguish confirmed exposure from possible exposure, and prepared fixes from applied, verified fixes.

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
- Contain business validation logic (domain errors for invariant violations); server entry points must also validate untrusted input and enforce authorization
- Delegate all I/O to the repository
- Never import from `src/infrastructure/` or `src/presentation/`

## Adding a New Feature — Checklist

1. Add or extend entity in `src/domain/entities/` if the data model changes
2. Add or extend repository interface in `src/domain/repositories/` if new data operations are needed
3. Add use case(s) in `src/application/use-cases/` with validation
4. Add repository implementation(s) in `src/infrastructure/repositories/` and matching mock in `src/infrastructure/mock/`
5. Wire the new use case into `src/infrastructure/container.ts`
6. Consume via `useContainer()` in hooks/components — never via direct import
7. Review affected trust boundaries, authorize privileged operations server-side, and test permitted behavior alongside forbidden access

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
