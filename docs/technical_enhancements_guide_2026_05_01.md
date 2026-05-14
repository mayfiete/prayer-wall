# Prayer Wall — Technical Enhancements

## 1. Wall Display Logic (`PrayerWallGrid.tsx`)

**Current behavior:** Grid always renders a minimum of 48 stones — committed prayers fill from the top, then empty placeholder stones (`EmptyBrick`) fill the remainder, with the CTA inserted after the last committed prayer.

**Required behavior:** Wall starts completely blank. Only committed stones render, plus exactly one `CtaBrick` at the next position. No empty placeholders exist in the initial state.

**Changes:**

* Remove the `Math.max(48, prayers.length + 1)` minimum-stone calculation.
* Remove all `PlaceholderBrick` renders.
* New grid logic: `[...prayers.map(p => <PrayerBrick>), <CtaBrick>]`
* Stagger logic (offset rows) remains — just applied to `prayers.length + 1` total tiles.
* The row/column assignment for the CTA tile uses `prayers.length` as the index (0-based), so it always appears as the next stone in sequence.

---

## 2. Stone-First Visual Mode

**Current behavior:** `TileModeContext` toggles between `'stone'` and `'brick'` modes. The `TileModeToggle` component exposes this switch to users.

**Required behavior:** The Prayer Foundation is stone-only. The toggle is removed from the public wall view.

**Changes:**

* `TileModeContext.tsx`: Set `defaultMode = 'stone'`; keep context in place for any future admin use.
* `WallPage.tsx`: Remove `<TileModeToggle />` from the header.
* `TileModeToggle.tsx`: No deletion — retained for potential admin reuse.
* `index.css .tile-stone`: Once HCA's asset arrives, update `background-image` URL from `/textures/stone.jpg` to the new file path (e.g., `/textures/hca-stone.jpg`). Keep under 15MB constraint; add a code comment noting the asset spec.
* `tailwind.config.js` safelist: No change needed; `tile-stone` is already safelisted.

---

## 3. Custom Stone Asset

**Current location:** `public/textures/stone.jpg` (generic)

**Required:** HCA-provided cobblestone asset matching the "one room schoolhouse" brand.

**Changes:**

* Drop the new file into `public/textures/` (name TBD pending delivery, e.g., `hca-cobblestone.jpg`, max 15MB).
* Update the single `background-image` reference in `index.css .tile-stone`.
* Update `public/textures/prayer_hands.jpg` if HCA also provides a replacement icon (not mentioned, but asset folder is already seeded).
* `MockRealtimeClient.ts` / `mockData.ts`: No texture references — no change.

---

## 4. Prayer Category CRUD (Admin Extension)

**Current `IPrayerCategoryRepository`:** read-only — `findActiveByOrg(orgId)` only.

**Changes to `src/domain/repositories/IPrayerCategoryRepository.ts`:**

```ts
interface IPrayerCategoryRepository {
  findActiveByOrg(orgId: string): Promise<PrayerCategory[]>
  findAllByOrg(orgId: string): Promise<PrayerCategory[]>   // includes inactive
  create(data: CreateCategoryData): Promise<PrayerCategory>
  update(id: string, data: UpdateCategoryData): Promise<PrayerCategory>
  setActive(id: string, active: boolean): Promise<void>
  delete(id: string): Promise<void>
}

interface CreateCategoryData {
  orgId: string
  name: string
  displayOrder: number
}

interface UpdateCategoryData {
  name?: string
  displayOrder?: number
}
```

`SupabasePrayerCategoryRepository.ts` and `MockPrayerCategoryRepository.ts`: implement the four new methods.

**New use cases:**

* `src/application/use-cases/CreatePrayerCategory.ts`
* `src/application/use-cases/UpdatePrayerCategory.ts`

---

## 5. Admin Portal

**New route in `App.tsx`:**

```tsx
<Route path="/admin" element={<AdminPage />} />
```

Admin pages are auth-gated. Use `Supabase auth.getSession()` on mount; redirect to a simple login form if no session. No new auth tables required — leverages Supabase built-in `auth.users`.

**New files:**

| File                                               | Purpose                                                           |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| `src/presentation/pages/AdminPage.tsx`           | Shell with tab nav: Categories / Assets                           |
| `src/presentation/pages/admin/CategoryAdmin.tsx` | CRUD for `message_categories`; drag-to-reorder `displayOrder` |
| `src/presentation/pages/admin/AssetAdmin.tsx`    | Upload stone texture to `public/textures/`via Supabase Storage  |

**`CategoryAdmin.tsx` data flow:**

* Fetches all categories via `findAllByOrg` (includes inactive).
* Inline text edit → `UpdatePrayerCategory.execute()`.
* Toggle switch per row → `setActive(id, bool)`.
* Drag handle reorders → bulk `displayOrder` update on drop.
* "Add Category" form → `CreatePrayerCategory.execute()`.

**`AssetAdmin.tsx` data flow:**

* Upload zone for Stone Texture.
* On file select: validate `file.size < 15 * 1024 * 1024`, then upload to Supabase Storage bucket `wall-assets`.
* On upload success: update a `wall_assets` config record (or env-equivalent) with the new public URL.
* `index.css .tile-stone` background is overridden at runtime via a CSS custom property: `--stone-texture-url` set on `document.documentElement` from the fetched asset URL.

---

## 6. Container / Dependency Injection

`src/infrastructure/container.ts` — add new use cases:

```ts
export const container = {
  // existing
  getPrayerWall,
  getPrayerCategories,
  submitPrayerCommitment,
  unsubscribeFromReminders,
  supabase,
  // new
  createPrayerCategory,
  updatePrayerCategory,
}
```

---

## 7. Email Reminder Frequency

**Change:** Weekly → Monthly (30-day interval).

The `reminder_active` flag and `last_reminded_at` column already exist on the `commitments` table. The frequency change lives wherever the reminder-dispatch logic runs — most likely a Supabase Edge Function (`supabase/functions/send-reminders/`) or a `pg_cron` job.

**Target query change:**

```sql
-- Before
WHERE reminder_active = true AND last_reminded_at < NOW() - INTERVAL '7 days'

-- After
WHERE reminder_active = true AND last_reminded_at < NOW() - INTERVAL '30 days'
```

If a cron schedule triggers this function, update it from weekly (`0 9 * * 1`) to monthly (`0 9 1 * *`).

> The two newsletter types (Prayer / Financial) Ivy will author are sent externally via Resend — no code change required for content. The `email_logs` table already captures delivery status regardless of content type.

---

## 8. New Hook

| Hook                                | Location                                               | Returns                                                        |
| ----------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------- |
| `usePrayerCategoriesAdmin(orgId)` | `src/presentation/hooks/usePrayerCategoriesAdmin.ts` | `{ categories, loading, create, update, setActive, remove }` |

---

## 9. Summary: File Inventory

### Modified

| File                                                                    | Change                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/App.tsx`                                                         | Add `/admin`route                                                            |
| `src/presentation/pages/WallPage.tsx`                                 | Remove `<TileModeToggle />`                                                  |
| `src/presentation/components/PrayerWallGrid.tsx`                      | Remove placeholder logic;`prayers.length + 1`total tiles                     |
| `src/domain/repositories/IPrayerCategoryRepository.ts`                | Add 4 CRUD method signatures                                                   |
| `src/infrastructure/repositories/SupabasePrayerCategoryRepository.ts` | Implement CRUD                                                                 |
| `src/infrastructure/mock/MockPrayerCategoryRepository.ts`             | Implement CRUD                                                                 |
| `src/infrastructure/container.ts`                                     | Wire new use cases                                                             |
| `src/index.css`                                                       | Update `.tile-stone`background path; add `--stone-texture-url`CSS var hook |
| `supabase/functions/send-reminders/`                                  | Change interval 7 days → 30 days                                              |

### New

| File                                                   | Purpose                |
| ------------------------------------------------------ | ---------------------- |
| `src/application/use-cases/CreatePrayerCategory.ts`  | Admin: new category    |
| `src/application/use-cases/UpdatePrayerCategory.ts`  | Admin: edit category   |
| `src/presentation/pages/AdminPage.tsx`               | Admin shell            |
| `src/presentation/pages/admin/CategoryAdmin.tsx`     | Category management UI |
| `src/presentation/pages/admin/AssetAdmin.tsx`        | Texture upload UI      |
| `src/presentation/hooks/usePrayerCategoriesAdmin.ts` | Admin category hook    |

---

> **Largest unknowns before implementation:**
>
> 1. Supabase Storage bucket setup for `AssetAdmin`
> 2. Whether reminder dispatch is an Edge Function (no file exists yet in the repo) or a `pg_cron` job in the migration
> 3. The exact file format/name of HCA's stone asset
>
