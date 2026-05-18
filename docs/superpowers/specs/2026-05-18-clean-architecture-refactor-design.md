# Clean Architecture Refactor — Design

**Date:** 2026-05-18  
**Approach:** Layer-by-layer (A)

---

## Violations Found

| # | Violation | File(s) |
|---|---|---|
| V1 | Presentation imports infrastructure class directly | `usePrayerCategoriesAdmin.ts` imports `SupabasePrayerCategoryRepository` |
| V2 | Infrastructure type leaks into presentation props | `CategoryAdmin.tsx` receives `SupabaseClient<Database>` as prop |
| V3 | Presentation holds raw repository reference | `StatementsAdmin.tsx` receives `IPrayerMeditationRepository` as prop |
| V4 | Container exposes raw repository | `container.ts` exports `statementRepo` |
| V5 | Missing application layer for meditation CRUD | No use cases for create/update/delete/toggle meditations |
| V6 | Missing application layer for category admin ops | No use cases for setActive, delete, get-all (admin) categories |

---

## Step 1 — Application Layer: New Use Cases

### 1a. Category admin use cases (3 new files)

**`src/application/use-cases/GetAllPrayerCategories.ts`**  
- `execute(orgId: string): Promise<PrayerCategory[]>`  
- Calls `categoryRepo.findAllByOrg(orgId)` (returns active + inactive — for admin)

**`src/application/use-cases/SetCategoryActive.ts`**  
- `execute(id: string, active: boolean): Promise<void>`  
- Calls `categoryRepo.setActive(id, active)`

**`src/application/use-cases/DeletePrayerCategory.ts`**  
- `execute(id: string): Promise<void>`  
- Calls `categoryRepo.delete(id)`

### 1b. Meditation use cases (5 new files)

**`src/application/use-cases/GetMeditations.ts`**  
- `execute(categoryId: string): Promise<PrayerMeditation[]>`  
- Calls `meditationRepo.findByCategory(categoryId)`

**`src/application/use-cases/CreateMeditation.ts`**  
- `execute(data: CreateMeditationData): Promise<PrayerMeditation>`  
- Validates: body not empty, displayOrder >= 0  
- Delegates to `meditationRepo.create(data)`

**`src/application/use-cases/UpdateMeditation.ts`**  
- `execute(id: string, data: UpdateMeditationData): Promise<PrayerMeditation>`  
- Validates: body not empty if provided, displayOrder >= 0 if provided  
- Delegates to `meditationRepo.update(id, data)`

**`src/application/use-cases/DeleteMeditation.ts`**  
- `execute(id: string): Promise<void>`  
- Delegates to `meditationRepo.delete(id)`

**`src/application/use-cases/SetMeditationActive.ts`**  
- `execute(id: string, active: boolean): Promise<void>`  
- Delegates to `meditationRepo.setActive(id, active)`

---

## Step 2 — Infrastructure: Container Update

**`src/infrastructure/container.ts`**  
- Add 8 new use case instances (3 category + 5 meditation)  
- Remove `statementRepo` raw export  
- Keep `supabase: realtimeClient` (used by `useRealtimePrayers`)

Container shape after:
```ts
export const container = {
  // existing
  getPrayerWall, getPrayerCategories, submitPrayerCommitment,
  unsubscribeFromReminders, createPrayerCategory, updatePrayerCategory,
  supabase,
  // new category admin
  getAllPrayerCategories, setCategoryActive, deletePrayerCategory,
  // new meditation
  getMeditations, createMeditation, updateMeditation,
  deleteMeditation, setMeditationActive,
}
```

---

## Step 3 — Presentation: Fix usePrayerCategoriesAdmin

**`src/presentation/hooks/usePrayerCategoriesAdmin.ts`**  
- Remove `supabase: SupabaseClient<Database>` parameter entirely  
- Remove `SupabasePrayerCategoryRepository` import  
- Remove `useRef(new SupabasePrayerCategoryRepository(supabase))`  
- Call `useContainer()` and destructure needed use cases  
- Wire: `create` → `createPrayerCategory.execute()`, `update` → `updatePrayerCategory.execute()`, `setActive` → `setCategoryActive.execute()`, `remove` → `deletePrayerCategory.execute()`, load → `getAllPrayerCategories.execute()`  
- `moveUp`/`moveDown` call `updatePrayerCategory.execute()` with swapped `displayOrder`

---

## Step 4 — Presentation: Fix CategoryAdmin

**`src/presentation/pages/admin/CategoryAdmin.tsx`**  
- Remove `CategoryAdminProps` interface (no more `supabase` prop)  
- Remove `supabase` from component signature  
- Pass no supabase argument to `usePrayerCategoriesAdmin`  
- Remove `const { statementRepo } = useContainer()` — `StatementsAdmin` will get its own use cases via context

---

## Step 5 — Presentation: Fix StatementsAdmin

**`src/presentation/pages/admin/StatementsAdmin.tsx`**  
- Remove `repo: IPrayerMeditationRepository` from props  
- Remove `StatementsAdminProps.repo`  
- Call `useContainer()` internally  
- Wire all repo calls to use cases: `repo.findByCategory` → `getMeditations.execute()`, `repo.create` → `createMeditation.execute()`, `repo.update` → `updateMeditation.execute()`, `repo.delete` → `deleteMeditation.execute()`, `repo.setActive` → `setMeditationActive.execute()`

---

## Step 6 — Skills

**`.claude/skills/clean-architecture/SKILL.md`**  

A project-scoped skill that enforces the layer rules:

- Domain has no imports from application/infrastructure/presentation
- Application imports only from domain
- Infrastructure imports from domain and application (for DTOs)
- Presentation imports only from domain (entity types) and application (use cases via container); never from infrastructure
- Container is the only place that instantiates repositories or wires use cases
- Components and hooks get use cases via `useContainer()` — never via props, never via direct import

---

## Files Changed Summary

| File | Action |
|---|---|
| `src/application/use-cases/GetAllPrayerCategories.ts` | New |
| `src/application/use-cases/SetCategoryActive.ts` | New |
| `src/application/use-cases/DeletePrayerCategory.ts` | New |
| `src/application/use-cases/GetMeditations.ts` | New |
| `src/application/use-cases/CreateMeditation.ts` | New |
| `src/application/use-cases/UpdateMeditation.ts` | New |
| `src/application/use-cases/DeleteMeditation.ts` | New |
| `src/application/use-cases/SetMeditationActive.ts` | New |
| `src/infrastructure/container.ts` | Modified |
| `src/presentation/hooks/usePrayerCategoriesAdmin.ts` | Modified |
| `src/presentation/pages/admin/CategoryAdmin.tsx` | Modified |
| `src/presentation/pages/admin/StatementsAdmin.tsx` | Modified |
| `.claude/skills/clean-architecture/SKILL.md` | New |
