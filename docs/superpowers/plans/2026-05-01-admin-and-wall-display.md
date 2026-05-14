# Prayer Wall — Admin Portal & Wall Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the public prayer wall to show committed stones only (no placeholders), remove the tile-mode toggle from public view, add a runtime CSS texture override system, build a Supabase-auth-gated admin portal for prayer category CRUD and stone asset upload, and change email reminders from weekly to monthly.

**Architecture:** Clean architecture layers are preserved — domain interfaces and use cases are added first, then infrastructure implementations, then presentation. The admin portal creates its own Supabase client (not the shared container) because it needs auth + storage in addition to DB access. No new database tables are required.

**Tech Stack:** React 18, TypeScript 5.6, Vite 6, Tailwind CSS 3, Supabase JS v2, Lucide React, React Router DOM 6. **No test runner is installed** — type correctness is verified with `npx tsc --noEmit` after each task.

---

## File Map

| Status | File | Change |
|--------|------|--------|
| Modify | `src/presentation/components/PrayerWallGrid.tsx` | Remove `MIN_DISPLAY_STONES` and `EmptyBrick`; committed stones + 1 CTA only |
| Modify | `src/presentation/pages/WallPage.tsx` | Remove `<TileModeToggle />` import and JSX |
| Modify | `src/index.css` | `.tile-stone` uses `var(--stone-texture-url, url(...))` |
| Modify | `src/main.tsx` | Bootstrap `--stone-texture-url` from localStorage on load |
| Modify | `src/domain/repositories/IPrayerCategoryRepository.ts` | Add `findAllByOrg`, `create`, `update`, `setActive`, `delete` + data types |
| Modify | `src/infrastructure/repositories/SupabasePrayerCategoryRepository.ts` | Implement five new methods |
| Modify | `src/infrastructure/mock/MockPrayerCategoryRepository.ts` | Implement five new methods |
| Modify | `src/infrastructure/container.ts` | Wire `CreatePrayerCategory`, `UpdatePrayerCategory` |
| Modify | `src/App.tsx` | Add `/admin` route |
| Modify | `supabase/functions/send-reminders/index.ts` | 30-day filter + "monthly" copy |
| Create | `src/application/use-cases/CreatePrayerCategory.ts` | Validates + delegates to repo |
| Create | `src/application/use-cases/UpdatePrayerCategory.ts` | Validates + delegates to repo |
| Create | `src/presentation/hooks/usePrayerCategoriesAdmin.ts` | Full CRUD + moveUp/moveDown |
| Create | `src/presentation/components/AdminAuthGuard.tsx` | Supabase session check + login form |
| Create | `src/presentation/pages/admin/CategoryAdmin.tsx` | List, rename, toggle active, reorder, add |
| Create | `src/presentation/pages/admin/AssetAdmin.tsx` | Drag-drop upload to Supabase Storage |
| Create | `src/presentation/pages/AdminPage.tsx` | Auth shell + tab nav (Categories / Assets) |

---

## Task 1: Wall Display — Remove Placeholder Stones

**Files:**
- Modify: `src/presentation/components/PrayerWallGrid.tsx`

- [ ] **Step 1: Replace the file**

Remove `MIN_DISPLAY_STONES`, remove `EmptyBrick` import and its render branch. The `items` array becomes `[...prayers, cta]`. The `StoneItem` union loses the `empty` variant.

```typescript
// src/presentation/components/PrayerWallGrid.tsx
import { useRef, useCallback, useMemo } from 'react'
import type { Prayer } from '../../domain/entities/Prayer'
import { PrayerBrick, CtaBrick } from './PrayerBrick'
import { usePrayerWall } from '../hooks/usePrayerWall'
import { useRealtimePrayers } from '../hooks/useRealtimePrayers'
import { useTileMode } from '../context/TileModeContext'
import { Loader2 } from 'lucide-react'

const STONES_PER_ROW = 7

interface PrayerWallGridProps {
  wallId: string
  onCtaClick?: () => void
}

type StoneItem =
  | { kind: 'prayer'; prayer: Prayer; isNew: boolean }
  | { kind: 'cta' }

export function PrayerWallGrid({ wallId, onCtaClick }: PrayerWallGridProps) {
  const { prayers, loading, error, addPrayer } = usePrayerWall(wallId)
  const { isChanging } = useTileMode()
  const newIdsRef = useRef<Set<string>>(new Set())

  const handleNewPrayer = useCallback(
    (prayer: Prayer) => {
      newIdsRef.current.add(prayer.id)
      addPrayer(prayer)
    },
    [addPrayer],
  )

  useRealtimePrayers(wallId, handleNewPrayer)

  const rows = useMemo(() => {
    const items: StoneItem[] = [
      ...prayers.map((p) => ({
        kind: 'prayer' as const,
        prayer: p,
        isNew: newIdsRef.current.has(p.id),
      })),
      { kind: 'cta' as const },
    ]

    const result: StoneItem[][] = []
    for (let i = 0; i < items.length; i += STONES_PER_ROW) {
      result.push(items.slice(i, i + STONES_PER_ROW))
    }
    return result
  }, [prayers])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-amber-500" size={40} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24 text-red-400 text-sm">{error}</div>
    )
  }

  return (
    <div className={`stone-wall${isChanging ? ' tiles-changing' : ''}`}>
      {rows.map((row, rowIdx) => (
        <div
          key={rowIdx}
          className={`stone-row${rowIdx % 2 === 1 ? ' stone-row--offset' : ''}`}
        >
          {row.map((item) => {
            if (item.kind === 'prayer') {
              return (
                <PrayerBrick
                  key={item.prayer.id}
                  prayer={item.prayer}
                  isNew={item.isNew}
                />
              )
            }
            return <CtaBrick key="cta" onClick={onCtaClick} />
          })}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/presentation/components/PrayerWallGrid.tsx
git commit -m "feat: wall starts blank — committed stones + 1 CTA, no placeholders"
```

---

## Task 2: Stone-First Mode — Remove Toggle from Public Wall

**Files:**
- Modify: `src/presentation/pages/WallPage.tsx`

- [ ] **Step 1: Remove TileModeToggle**

Remove line 5 (`import { TileModeToggle }`) and line 40 (`<TileModeToggle />`). Full replacement:

```typescript
// src/presentation/pages/WallPage.tsx
import { useState } from 'react'
import { PrayerWallGrid } from '../components/PrayerWallGrid'
import { MockBanner } from '../components/MockBanner'
import { BookOpen } from 'lucide-react'
import { Modal } from '../components/ui/Modal'
import { CommitmentForm } from '../components/CommitmentForm'
import { usePrayerCategories } from '../hooks/usePrayerCategories'

const WALL_ID = import.meta.env.VITE_WALL_ID as string
const ORG_ID = import.meta.env.VITE_ORG_ID as string
const ORG_NAME = (import.meta.env.VITE_ORG_NAME as string | undefined) ?? 'My Organization'

function LogoMark() {
  return (
    <div className="w-[60px] h-[60px] rounded-full bg-stone-900 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 40 40" width="38" height="38" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <polygon points="20,4 36,34 4,34" stroke="#fff" strokeWidth="2" fill="none" />
        <polygon points="20,10 30,28 10,28" fill="rgba(255,255,255,0.35)" />
      </svg>
    </div>
  )
}

export function WallPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const { categories } = usePrayerCategories(ORG_ID)

  return (
    <div className="min-h-screen flex flex-col bg-stone-100 font-body">
      <MockBanner />

      <header className="flex items-center gap-4 px-8 py-6 bg-white border-b border-stone-200">
        <LogoMark />
        <div className="flex-1">
          <h1 className="font-sans text-[26px] font-semibold text-stone-900 leading-tight tracking-tight">Prayer Foundation</h1>
          <p className="text-sm text-stone-400 mt-0.5">{ORG_NAME}</p>
        </div>
      </header>

      <section className="px-8 py-5 bg-white border-b border-stone-200">
        <h2 className="text-[15px] font-semibold text-stone-900 mb-1">Add your name to the wall</h2>
        <p className="text-[13px] text-stone-500 leading-relaxed mb-3">
          Commit to pray for one or more areas and place your stone on the foundation.
        </p>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <span
                key={cat.id}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-600 border border-stone-200"
              >
                {cat.name}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="px-6 pb-10 bg-white">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-stone-500 pt-4 pb-3">
          <BookOpen size={14} />
          Click the next open stone to join
        </div>
        <PrayerWallGrid wallId={WALL_ID} onCtaClick={() => setModalOpen(true)} />
      </section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Commit to pray"
      >
        <CommitmentForm
          wallId={WALL_ID}
          orgId={ORG_ID}
          categories={categories}
          onSuccess={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/presentation/pages/WallPage.tsx
git commit -m "feat: remove tile mode toggle from public wall view"
```

---

## Task 3: CSS Dynamic Stone Texture via Custom Property

**Files:**
- Modify: `src/index.css`
- Modify: `src/main.tsx`

- [ ] **Step 1: Update index.css — use CSS var with fallback**

In `src/index.css`, find the `.tile-stone` rule (line 62). Replace:

```css
background: url('/textures/stone.jpg') center / cover no-repeat;
```

with:

```css
/* --stone-texture-url is set at runtime by AssetAdmin after upload; falls back to bundled asset */
background: var(--stone-texture-url, url('/textures/stone.jpg')) center / cover no-repeat;
```

- [ ] **Step 2: Update main.tsx — bootstrap CSS var from localStorage**

Replace entire `src/main.tsx`:

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const storedTexture = localStorage.getItem('prayer-wall:stone-texture')
if (storedTexture) {
  document.documentElement.style.setProperty('--stone-texture-url', `url(${storedTexture})`)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 3: Type-check**

```
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/index.css src/main.tsx
git commit -m "feat: CSS custom property for runtime stone texture override with localStorage persistence"
```

---

## Task 4: Extend IPrayerCategoryRepository with CRUD

**Files:**
- Modify: `src/domain/repositories/IPrayerCategoryRepository.ts`

> **Note:** After this step, TypeScript will report errors in the two implementing classes. Those are resolved in Tasks 5 and 6. Do not commit until Task 6 is complete.

- [ ] **Step 1: Replace the entire file**

```typescript
// src/domain/repositories/IPrayerCategoryRepository.ts
import type { PrayerCategory } from '../entities/PrayerCategory'

export interface CreateCategoryData {
  orgId: string
  name: string
  displayOrder: number
}

export interface UpdateCategoryData {
  name?: string
  displayOrder?: number
}

export interface IPrayerCategoryRepository {
  findActiveByOrg(orgId: string): Promise<PrayerCategory[]>
  findAllByOrg(orgId: string): Promise<PrayerCategory[]>
  create(data: CreateCategoryData): Promise<PrayerCategory>
  update(id: string, data: UpdateCategoryData): Promise<PrayerCategory>
  setActive(id: string, active: boolean): Promise<void>
  delete(id: string): Promise<void>
}
```

- [ ] **Step 2: Verify expected errors before continuing**

```
npx tsc --noEmit
```

Expected: Errors in `SupabasePrayerCategoryRepository.ts` and `MockPrayerCategoryRepository.ts` for missing methods. This is intentional — do NOT commit yet.

---

## Task 5: SupabasePrayerCategoryRepository — Implement CRUD

**Files:**
- Modify: `src/infrastructure/repositories/SupabasePrayerCategoryRepository.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
// src/infrastructure/repositories/SupabasePrayerCategoryRepository.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../supabase/types'
import type {
  IPrayerCategoryRepository,
  CreateCategoryData,
  UpdateCategoryData,
} from '../../domain/repositories/IPrayerCategoryRepository'
import type { PrayerCategory } from '../../domain/entities/PrayerCategory'
import { NotFoundError } from '../../domain/errors/DomainError'

type DB = Database['prayer_wall']['Tables']
type CategoryRow = DB['message_categories']['Row']

function rowToCategory(row: CategoryRow): PrayerCategory {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    displayOrder: row.display_order,
    isActive: row.is_active,
  }
}

export class SupabasePrayerCategoryRepository implements IPrayerCategoryRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async findActiveByOrg(orgId: string): Promise<PrayerCategory[]> {
    const { data, error } = await this.client
      .from('message_categories')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    if (error) throw new Error(error.message)
    return ((data ?? []) as CategoryRow[]).map(rowToCategory)
  }

  async findAllByOrg(orgId: string): Promise<PrayerCategory[]> {
    const { data, error } = await this.client
      .from('message_categories')
      .select('*')
      .eq('org_id', orgId)
      .order('display_order', { ascending: true })
    if (error) throw new Error(error.message)
    return ((data ?? []) as CategoryRow[]).map(rowToCategory)
  }

  async create(data: CreateCategoryData): Promise<PrayerCategory> {
    const { data: row, error } = await this.client
      .from('message_categories')
      .insert({ org_id: data.orgId, name: data.name.trim(), display_order: data.displayOrder })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return rowToCategory(row as CategoryRow)
  }

  async update(id: string, data: UpdateCategoryData): Promise<PrayerCategory> {
    const patch: DB['message_categories']['Update'] = {}
    if (data.name !== undefined) patch.name = data.name.trim()
    if (data.displayOrder !== undefined) patch.display_order = data.displayOrder

    const { data: row, error } = await this.client
      .from('message_categories')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    if (!row) throw new NotFoundError('Category')
    return rowToCategory(row as CategoryRow)
  }

  async setActive(id: string, active: boolean): Promise<void> {
    const { error } = await this.client
      .from('message_categories')
      .update({ is_active: active })
      .eq('id', id)
    if (error) throw new Error(error.message)
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from('message_categories')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
  }
}
```

---

## Task 6: MockPrayerCategoryRepository — Implement CRUD

**Files:**
- Modify: `src/infrastructure/mock/MockPrayerCategoryRepository.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
// src/infrastructure/mock/MockPrayerCategoryRepository.ts
import type {
  IPrayerCategoryRepository,
  CreateCategoryData,
  UpdateCategoryData,
} from '../../domain/repositories/IPrayerCategoryRepository'
import type { PrayerCategory } from '../../domain/entities/PrayerCategory'
import { MOCK_CATEGORIES } from './mockData'
import { NotFoundError } from '../../domain/errors/DomainError'

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

let categories: PrayerCategory[] = [...MOCK_CATEGORIES]
let nextId = 100

export class MockPrayerCategoryRepository implements IPrayerCategoryRepository {
  async findActiveByOrg(orgId: string): Promise<PrayerCategory[]> {
    await delay(200)
    return categories
      .filter((c) => c.orgId === orgId && c.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder)
  }

  async findAllByOrg(orgId: string): Promise<PrayerCategory[]> {
    await delay(200)
    return categories
      .filter((c) => c.orgId === orgId)
      .sort((a, b) => a.displayOrder - b.displayOrder)
  }

  async create(data: CreateCategoryData): Promise<PrayerCategory> {
    await delay(300)
    const cat: PrayerCategory = {
      id: `mock-cat-${++nextId}`,
      orgId: data.orgId,
      name: data.name.trim(),
      displayOrder: data.displayOrder,
      isActive: true,
    }
    categories.push(cat)
    return cat
  }

  async update(id: string, data: UpdateCategoryData): Promise<PrayerCategory> {
    await delay(300)
    const idx = categories.findIndex((c) => c.id === id)
    if (idx === -1) throw new NotFoundError('Category')
    categories[idx] = {
      ...categories[idx],
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
    }
    return categories[idx]
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await delay(200)
    const cat = categories.find((c) => c.id === id)
    if (!cat) throw new NotFoundError('Category')
    cat.isActive = active
  }

  async delete(id: string): Promise<void> {
    await delay(200)
    const before = categories.length
    categories = categories.filter((c) => c.id !== id)
    if (categories.length === before) throw new NotFoundError('Category')
  }
}
```

- [ ] **Step 2: Type-check (Tasks 4–6 combined)**

```
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit all three files together**

```bash
git add src/domain/repositories/IPrayerCategoryRepository.ts \
        src/infrastructure/repositories/SupabasePrayerCategoryRepository.ts \
        src/infrastructure/mock/MockPrayerCategoryRepository.ts
git commit -m "feat: category repository CRUD — interface, Supabase impl, mock impl"
```

---

## Task 7: CreatePrayerCategory Use Case

**Files:**
- Create: `src/application/use-cases/CreatePrayerCategory.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/application/use-cases/CreatePrayerCategory.ts
import type {
  IPrayerCategoryRepository,
  CreateCategoryData,
} from '../../domain/repositories/IPrayerCategoryRepository'
import type { PrayerCategory } from '../../domain/entities/PrayerCategory'
import { ValidationError } from '../../domain/errors/DomainError'

export class CreatePrayerCategory {
  constructor(private readonly categoryRepo: IPrayerCategoryRepository) {}

  async execute(data: CreateCategoryData): Promise<PrayerCategory> {
    if (!data.name.trim()) throw new ValidationError('Category name is required')
    if (data.displayOrder < 0) throw new ValidationError('Display order must be 0 or greater')
    return this.categoryRepo.create(data)
  }
}
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/application/use-cases/CreatePrayerCategory.ts
git commit -m "feat: CreatePrayerCategory use case"
```

---

## Task 8: UpdatePrayerCategory Use Case

**Files:**
- Create: `src/application/use-cases/UpdatePrayerCategory.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/application/use-cases/UpdatePrayerCategory.ts
import type {
  IPrayerCategoryRepository,
  UpdateCategoryData,
} from '../../domain/repositories/IPrayerCategoryRepository'
import type { PrayerCategory } from '../../domain/entities/PrayerCategory'
import { ValidationError } from '../../domain/errors/DomainError'

export class UpdatePrayerCategory {
  constructor(private readonly categoryRepo: IPrayerCategoryRepository) {}

  async execute(id: string, data: UpdateCategoryData): Promise<PrayerCategory> {
    if (data.name !== undefined && !data.name.trim()) {
      throw new ValidationError('Category name cannot be empty')
    }
    if (data.displayOrder !== undefined && data.displayOrder < 0) {
      throw new ValidationError('Display order must be 0 or greater')
    }
    return this.categoryRepo.update(id, data)
  }
}
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/application/use-cases/UpdatePrayerCategory.ts
git commit -m "feat: UpdatePrayerCategory use case"
```

---

## Task 9: Wire Container with New Use Cases

**Files:**
- Modify: `src/infrastructure/container.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
// src/infrastructure/container.ts
import type { IPrayerRepository } from '../domain/repositories/IPrayerRepository'
import type { IPrayerCategoryRepository } from '../domain/repositories/IPrayerCategoryRepository'
import type { IRealtimeClient } from './mock/MockRealtimeClient'

import { GetPrayerWall } from '../application/use-cases/GetPrayerWall'
import { GetPrayerCategories } from '../application/use-cases/GetPrayerCategories'
import { SubmitPrayerCommitment } from '../application/use-cases/SubmitPrayerCommitment'
import { UnsubscribeFromReminders } from '../application/use-cases/UnsubscribeFromReminders'
import { CreatePrayerCategory } from '../application/use-cases/CreatePrayerCategory'
import { UpdatePrayerCategory } from '../application/use-cases/UpdatePrayerCategory'

import { MockPrayerRepository } from './mock/MockPrayerRepository'
import { MockPrayerCategoryRepository } from './mock/MockPrayerCategoryRepository'
import { MockRealtimeClient } from './mock/MockRealtimeClient'

import { createSupabaseClient } from './supabase/client'
import { SupabasePrayerRepository } from './repositories/SupabasePrayerRepository'
import { SupabasePrayerCategoryRepository } from './repositories/SupabasePrayerCategoryRepository'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

let prayerRepo: IPrayerRepository
let categoryRepo: IPrayerCategoryRepository
let realtimeClient: IRealtimeClient

if (USE_MOCK) {
  prayerRepo = new MockPrayerRepository()
  categoryRepo = new MockPrayerCategoryRepository()
  realtimeClient = new MockRealtimeClient()
} else {
  const supabase = createSupabaseClient()
  prayerRepo = new SupabasePrayerRepository(supabase)
  categoryRepo = new SupabasePrayerCategoryRepository(supabase)
  realtimeClient = supabase as unknown as IRealtimeClient
}

export const container = {
  getPrayerWall: new GetPrayerWall(prayerRepo),
  getPrayerCategories: new GetPrayerCategories(categoryRepo),
  submitPrayerCommitment: new SubmitPrayerCommitment(prayerRepo, categoryRepo),
  unsubscribeFromReminders: new UnsubscribeFromReminders(prayerRepo),
  createPrayerCategory: new CreatePrayerCategory(categoryRepo),
  updatePrayerCategory: new UpdatePrayerCategory(categoryRepo),
  supabase: realtimeClient,
}
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/container.ts
git commit -m "feat: wire CreatePrayerCategory and UpdatePrayerCategory into DI container"
```

---

## Task 10: usePrayerCategoriesAdmin Hook

**Files:**
- Create: `src/presentation/hooks/usePrayerCategoriesAdmin.ts`

The hook instantiates `SupabasePrayerCategoryRepository` directly (not via container) because admin pages pass a `SupabaseClient` with auth. `moveUp`/`moveDown` swap `displayOrder` between adjacent items, calling two `update` calls in parallel.

- [ ] **Step 1: Create the file**

```typescript
// src/presentation/hooks/usePrayerCategoriesAdmin.ts
import { useState, useEffect, useCallback, useRef } from 'react'
import type { PrayerCategory } from '../../domain/entities/PrayerCategory'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../infrastructure/supabase/types'
import { SupabasePrayerCategoryRepository } from '../../infrastructure/repositories/SupabasePrayerCategoryRepository'

export interface UsePrayerCategoriesAdminResult {
  categories: PrayerCategory[]
  loading: boolean
  error: string | null
  create: (name: string) => Promise<void>
  update: (id: string, name: string) => Promise<void>
  setActive: (id: string, active: boolean) => Promise<void>
  remove: (id: string) => Promise<void>
  moveUp: (id: string) => Promise<void>
  moveDown: (id: string) => Promise<void>
}

export function usePrayerCategoriesAdmin(
  orgId: string,
  supabase: SupabaseClient<Database>,
): UsePrayerCategoriesAdminResult {
  const [categories, setCategories] = useState<PrayerCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // useRef keeps one stable instance; avoids stale closures in useCallback deps
  const repoRef = useRef(new SupabasePrayerCategoryRepository(supabase))

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const all = await repoRef.current.findAllByOrg(orgId)
      setCategories(all)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (name: string) => {
    const maxOrder = categories.reduce((m, c) => Math.max(m, c.displayOrder), 0)
    const created = await repoRef.current.create({ orgId, name, displayOrder: maxOrder + 1 })
    setCategories((prev) => [...prev, created])
  }, [orgId, categories])

  const update = useCallback(async (id: string, name: string) => {
    const updated = await repoRef.current.update(id, { name })
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)))
  }, [])

  const setActive = useCallback(async (id: string, active: boolean) => {
    await repoRef.current.setActive(id, active)
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, isActive: active } : c)))
  }, [])

  const remove = useCallback(async (id: string) => {
    await repoRef.current.delete(id)
    setCategories((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const moveUp = useCallback(async (id: string) => {
    const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder)
    const idx = sorted.findIndex((c) => c.id === id)
    if (idx <= 0) return
    const above = sorted[idx - 1]
    const current = sorted[idx]
    await Promise.all([
      repoRef.current.update(current.id, { displayOrder: above.displayOrder }),
      repoRef.current.update(above.id, { displayOrder: current.displayOrder }),
    ])
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id === current.id) return { ...c, displayOrder: above.displayOrder }
        if (c.id === above.id) return { ...c, displayOrder: current.displayOrder }
        return c
      }),
    )
  }, [categories])

  const moveDown = useCallback(async (id: string) => {
    const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder)
    const idx = sorted.findIndex((c) => c.id === id)
    if (idx === -1 || idx >= sorted.length - 1) return
    const below = sorted[idx + 1]
    const current = sorted[idx]
    await Promise.all([
      repoRef.current.update(current.id, { displayOrder: below.displayOrder }),
      repoRef.current.update(below.id, { displayOrder: current.displayOrder }),
    ])
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id === current.id) return { ...c, displayOrder: below.displayOrder }
        if (c.id === below.id) return { ...c, displayOrder: current.displayOrder }
        return c
      }),
    )
  }, [categories])

  return { categories, loading, error, create, update, setActive, remove, moveUp, moveDown }
}
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/presentation/hooks/usePrayerCategoriesAdmin.ts
git commit -m "feat: usePrayerCategoriesAdmin hook — CRUD, toggle active, move up/down"
```

---

## Task 11: Admin Auth Guard Component

**Files:**
- Create: `src/presentation/components/AdminAuthGuard.tsx`

- [ ] **Step 1: Create the file**

```typescript
// src/presentation/components/AdminAuthGuard.tsx
import { useState, useEffect } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../infrastructure/supabase/types'

interface AdminAuthGuardProps {
  supabase: SupabaseClient<Database>
  children: React.ReactNode
}

export function AdminAuthGuard({ supabase, children }: AdminAuthGuardProps) {
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session)
      setChecking(false)
    })
  }, [supabase])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) { setLoginError(error.message); return }
    setAuthed(true)
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <span className="text-stone-400 text-sm">Checking session…</span>
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-white rounded-xl shadow p-8 space-y-4"
        >
          <h1 className="text-xl font-semibold text-stone-900">Admin Login</h1>
          {loginError && <p className="text-sm text-red-600">{loginError}</p>}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-stone-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-stone-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-amber-600 text-white rounded-md py-2 text-sm font-semibold hover:bg-amber-700 disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    )
  }

  return <>{children}</>
}
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/presentation/components/AdminAuthGuard.tsx
git commit -m "feat: AdminAuthGuard — Supabase session check with login form fallback"
```

---

## Task 12: CategoryAdmin Page

**Files:**
- Create: `src/presentation/pages/admin/CategoryAdmin.tsx`

Reorder uses up/down arrow buttons (no DnD library installed). Inline rename activates on row click, saves on blur or Enter, cancels on Escape.

- [ ] **Step 1: Create the directory and file**

```typescript
// src/presentation/pages/admin/CategoryAdmin.tsx
import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../infrastructure/supabase/types'
import type { PrayerCategory } from '../../../domain/entities/PrayerCategory'
import { usePrayerCategoriesAdmin } from '../../hooks/usePrayerCategoriesAdmin'
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react'

const ORG_ID = import.meta.env.VITE_ORG_ID as string

interface CategoryAdminProps {
  supabase: SupabaseClient<Database>
}

export function CategoryAdmin({ supabase }: CategoryAdminProps) {
  const { categories, loading, error, create, update, setActive, remove, moveUp, moveDown } =
    usePrayerCategoriesAdmin(ORG_ID, supabase)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [opError, setOpError] = useState('')

  const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder)

  function startEdit(cat: PrayerCategory) {
    setEditingId(cat.id)
    setEditName(cat.name)
    setOpError('')
  }

  async function commitEdit(id: string) {
    if (!editName.trim()) { setOpError('Name cannot be empty'); return }
    setOpError('')
    try {
      await update(id, editName)
    } catch (e) {
      setOpError(e instanceof Error ? e.message : 'Update failed')
    }
    setEditingId(null)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    setOpError('')
    try {
      await create(newName)
      setNewName('')
    } catch (e) {
      setOpError(e instanceof Error ? e.message : 'Create failed')
    }
    setAdding(false)
  }

  async function handleRemove(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    setOpError('')
    try {
      await remove(id)
    } catch (e) {
      setOpError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  if (loading) return <p className="text-stone-400 text-sm py-8 text-center">Loading…</p>
  if (error) return <p className="text-red-500 text-sm py-8 text-center">{error}</p>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-lg font-semibold text-stone-800">Prayer Categories</h2>

      {opError && <p className="text-sm text-red-600">{opError}</p>}

      <ul className="divide-y divide-stone-200 border border-stone-200 rounded-lg overflow-hidden">
        {sorted.map((cat, idx) => (
          <li key={cat.id} className="flex items-center gap-3 px-4 py-3 bg-white">
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => moveUp(cat.id)}
                disabled={idx === 0}
                className="p-0.5 text-stone-400 hover:text-stone-700 disabled:opacity-20"
                aria-label="Move up"
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={() => moveDown(cat.id)}
                disabled={idx === sorted.length - 1}
                className="p-0.5 text-stone-400 hover:text-stone-700 disabled:opacity-20"
                aria-label="Move down"
              >
                <ChevronDown size={14} />
              </button>
            </div>

            <div className="flex-1 min-w-0">
              {editingId === cat.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => commitEdit(cat.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(cat.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="w-full border border-amber-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              ) : (
                <button
                  onClick={() => startEdit(cat)}
                  className="text-sm text-stone-800 hover:text-amber-700 text-left w-full truncate"
                >
                  {cat.name}
                </button>
              )}
            </div>

            <label className="flex items-center gap-1.5 text-xs text-stone-500 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={cat.isActive}
                onChange={(e) => setActive(cat.id, e.target.checked)}
                className="accent-amber-600"
              />
              Active
            </label>

            <button
              onClick={() => handleRemove(cat.id, cat.name)}
              className="p-1 text-stone-300 hover:text-red-500"
              aria-label={`Delete ${cat.name}`}
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          className="flex-1 border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 disabled:opacity-60"
        >
          <Plus size={14} />
          Add
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/presentation/pages/admin/CategoryAdmin.tsx
git commit -m "feat: CategoryAdmin page — list, rename, toggle active, reorder, add new"
```

---

## Task 13: AssetAdmin Page

**Files:**
- Create: `src/presentation/pages/admin/AssetAdmin.tsx`

Uploads to Supabase Storage bucket `wall-assets` at fixed path `textures/stone.jpg` (upsert). On success, sets `localStorage['prayer-wall:stone-texture']` and the `--stone-texture-url` CSS var so the wall updates immediately in the same browser session.

- [ ] **Step 1: Create the file**

```typescript
// src/presentation/pages/admin/AssetAdmin.tsx
import { useState, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../infrastructure/supabase/types'
import { Upload, CheckCircle } from 'lucide-react'

const MAX_BYTES = 15 * 1024 * 1024
const BUCKET = 'wall-assets'
const STONE_PATH = 'textures/stone.jpg'
const LS_KEY = 'prayer-wall:stone-texture'

interface AssetAdminProps {
  supabase: SupabaseClient<Database>
}

export function AssetAdmin({ supabase }: AssetAdminProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    localStorage.getItem(LS_KEY),
  )
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError('')
    setSuccess(false)

    if (file.size > MAX_BYTES) {
      setError(`File exceeds 15 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB)`)
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('File must be an image (JPG, PNG, WebP)')
      return
    }

    setUploading(true)
    try {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(STONE_PATH, file, { upsert: true, contentType: file.type })

      if (uploadError) throw new Error(uploadError.message)

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(STONE_PATH)
      const publicUrl = data.publicUrl

      localStorage.setItem(LS_KEY, publicUrl)
      document.documentElement.style.setProperty('--stone-texture-url', `url(${publicUrl})`)
      setPreviewUrl(publicUrl)
      setSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-lg font-semibold text-stone-800">Stone Texture Asset</h2>
      <p className="text-sm text-stone-500">
        Upload the HCA cobblestone texture (JPG/PNG/WebP, max 15 MB).
        The prayer wall updates immediately in this browser session.
        Other sessions pick up the new texture on next page load.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && (
        <p className="flex items-center gap-1.5 text-sm text-green-700">
          <CheckCircle size={14} /> Texture updated successfully
        </p>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-stone-300 rounded-xl p-10 text-center cursor-pointer hover:border-amber-400 transition-colors"
      >
        <Upload className="mx-auto mb-3 text-stone-400" size={32} />
        <p className="text-sm text-stone-500">
          {uploading ? 'Uploading…' : 'Drop image here or click to browse'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {previewUrl && (
        <div>
          <p className="text-xs text-stone-400 mb-2">Current texture (from last upload)</p>
          <img
            src={previewUrl}
            alt="Stone texture preview"
            className="w-32 h-24 object-cover rounded-lg border border-stone-200"
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/presentation/pages/admin/AssetAdmin.tsx
git commit -m "feat: AssetAdmin page — stone texture upload to Supabase Storage"
```

---

## Task 14: AdminPage Shell and /admin Route

**Files:**
- Create: `src/presentation/pages/AdminPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create AdminPage.tsx**

```typescript
// src/presentation/pages/AdminPage.tsx
import { useState, useMemo } from 'react'
import { createSupabaseClient } from '../../infrastructure/supabase/client'
import { AdminAuthGuard } from '../components/AdminAuthGuard'
import { CategoryAdmin } from './admin/CategoryAdmin'
import { AssetAdmin } from './admin/AssetAdmin'

type Tab = 'categories' | 'assets'

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('categories')
  // useMemo ensures one stable client instance; avoids calling createSupabaseClient at module
  // level, which throws when VITE_USE_MOCK=true and Supabase env vars are absent
  const supabase = useMemo(() => createSupabaseClient(), [])

  return (
    <AdminAuthGuard supabase={supabase}>
      <div className="min-h-screen bg-stone-100">
        <header className="bg-white border-b border-stone-200 px-8 py-5">
          <h1 className="text-xl font-semibold text-stone-900">Prayer Wall Admin</h1>
        </header>

        <nav className="bg-white border-b border-stone-200 px-8">
          <div className="flex">
            {(['categories', 'assets'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                  tab === t
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                {t === 'categories' ? 'Categories' : 'Assets'}
              </button>
            ))}
          </div>
        </nav>

        <main className="px-8 py-8">
          {tab === 'categories' && <CategoryAdmin supabase={supabase} />}
          {tab === 'assets' && <AssetAdmin supabase={supabase} />}
        </main>
      </div>
    </AdminAuthGuard>
  )
}
```

- [ ] **Step 2: Update App.tsx — add /admin route**

```typescript
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './presentation/context/AppContext'
import { TileModeProvider } from './presentation/context/TileModeContext'
import { WallPage } from './presentation/pages/WallPage'
import { CommitmentPage } from './presentation/pages/CommitmentPage'
import { UnsubscribePage } from './presentation/pages/UnsubscribePage'
import { AdminPage } from './presentation/pages/AdminPage'

function App() {
  return (
    <AppProvider>
      <TileModeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<WallPage />} />
            <Route path="/commit" element={<CommitmentPage />} />
            <Route path="/unsubscribe" element={<UnsubscribePage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </BrowserRouter>
      </TileModeProvider>
    </AppProvider>
  )
}

export default App
```

- [ ] **Step 3: Type-check**

```
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/presentation/pages/AdminPage.tsx \
        src/presentation/pages/admin/CategoryAdmin.tsx \
        src/presentation/pages/admin/AssetAdmin.tsx \
        src/App.tsx
git commit -m "feat: admin portal — auth shell, category CRUD, asset upload, /admin route"
```

---

## Task 15: Email Reminder — Monthly Cadence

**Files:**
- Modify: `supabase/functions/send-reminders/index.ts`

The existing function sends to all `reminder_active = true` without any `last_reminded_at` check. This task adds a 30-day filter and updates the email copy from "weekly" to "monthly".

- [ ] **Step 1: Add the 30-day filter**

Find the commitments query (currently lines 26–29):

```typescript
const { data: commitments, error } = await supabase
  .from("prayer_commitments")
  .select("id, name, email, church_id")
  .eq("reminder_active", true);
```

Replace with:

```typescript
const thirtyDaysAgo = new Date()
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

const { data: commitments, error } = await supabase
  .from("prayer_commitments")
  .select("id, name, email, church_id")
  .eq("reminder_active", true)
  .or(`last_reminded_at.is.null,last_reminded_at.lt.${thirtyDaysAgo.toISOString()}`)
```

- [ ] **Step 2: Update email subject and body copy**

Find (line 53):
```typescript
subject: "Your weekly prayer reminder",
```
Replace with:
```typescript
subject: "Your monthly prayer reminder",
```

Find (line 55):
```typescript
<p>This is your weekly reminder that you committed to pray.
```
Replace with:
```typescript
<p>This is your monthly reminder that you committed to pray.
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/send-reminders/index.ts
git commit -m "feat: change reminder cadence to monthly — 30-day filter + updated copy"
```

---

## Verification Checklist

After all tasks are complete, manually verify in the browser with `VITE_USE_MOCK=true`:

- [ ] `/` — wall loads showing 0 committed stones + 1 glowing CTA stone (blank wall start)
- [ ] Submit commitment → new stone appears, CTA shifts to next position
- [ ] No tile-mode toggle visible in header
- [ ] `/admin` — redirects to login form (Supabase auth)
- [ ] After login → admin shell with Categories and Assets tabs
- [ ] Categories tab: all 8 categories listed, rename works, toggle active works, up/down reorder works, add new works
- [ ] Assets tab: file input accepts images, rejects files > 15 MB, shows preview after selection

> **Supabase Storage prerequisite:** The `wall-assets` bucket must be created in the Supabase dashboard before AssetAdmin uploads will work. Set it to **Public** so the returned URL is accessible without auth.
