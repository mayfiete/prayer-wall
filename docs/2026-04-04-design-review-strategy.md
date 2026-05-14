# Prayer Foundation — Design Review Strategy
**Date:** April 4, 2026  
**Source:** Fathom meeting notes — HCA / Daily Raiser, April 3, 2026  
**Author:** Terry Mayfield

---

## My Feedback on the Direction

This is a solid, focused scope. The key insight from the meeting is that **Prayer Foundation is now its own standalone product** — not dependent on Daily Raiser at all. That's actually an architectural advantage: full control over UX, branding, and the building narrative.

A few honest observations:

- **The cobblestone / staggered layout is the right call.** The current uniform grid of square tiles feels like a spreadsheet. Staggered, organically-shaped stones will feel earned and alive as the wall builds.
- **"First stone = CTA" is clever UX.** The next open stone being the interactive one creates a clear, story-driven onboarding — much better than a button above the grid.
- **Monthly reminders over weekly is correct.** Weekly is fatiguing and will drive unsubscribes. Monthly with rich content (newsletter + praise report) creates anticipation.
- **Admin portal with drag-and-drop is appropriately scoped.** Ivy's team updating content without a developer is table-stakes for a product HCA actually owns.
- **The Giving Wall workaround is pragmatic but worth re-evaluating.** A static image with manual name updates doesn't scale past ~50 donors before it becomes a maintenance burden. If that's the direction, build the manual-upload admin tool now, not later.

---

## Code Change Strategy

### Priority 1 — Wall Layout: Staggered Cobblestone

**What the notes say:** Single, staggered, rounded stones. Wall starts blank and builds one stone at a time.

**Current state:** Uniform `grid-cols-4/6/8` square tiles with `aspect-ratio: 1`.

**Changes needed:**

1. **Replace grid layout with a masonry/staggered row layout.**  
   Use a CSS-based offset approach: odd rows shift right by 50% of a stone's width, mimicking real cobblestone coursing. No JS masonry library needed.

2. **Change tile shape from square to rounded stone.**  
   Replace `border-radius: 8px` with organic per-tile variation (`border-radius` ranging from 40%–55% on different axes). Use `aspect-ratio: 4/3` or `5/4` to feel more like rounded river stones.

3. **One stone at a time build — next open stone is the only clickable one.**  
   Currently all `EmptyBrick` tiles are interactive. Change so that **only `EmptyBrick` at index 0** (the first unclaimed slot) is a `<button>`. All others render as non-interactive placeholders.

4. **Asset-ready tile component.**  
   Add an optional `imageUrl` prop to the tile component so that when HCA's designer delivers custom stone PNGs (<15MB each), they can be swapped in as `background-image` without changing component structure.

**Files to change:**
- `src/presentation/components/PrayerBrick.tsx` — `EmptyBrick` onClick logic
- `src/presentation/components/PrayerWallGrid.tsx` — grid layout → staggered rows
- `src/index.css` — tile shape, stagger offset

---

### Priority 2 — Stone Inscriptions (not placard overlay)

**What the notes say:** "Inscribed names" — names carved into the stone surface, not a separate brass tag.

**Current state:** A brass placard element overlaid on the tile center.

**Changes needed:**

1. **Remove `.placard` element entirely.**  
   Replace with directly-rendered text that uses the engraved CSS text-shadow effect (bright bottom edge, dark top edge) directly on the stone surface.

2. **Style:** Uppercase, tight tracking, small caps serif (Libre Baskerville italic works well). Text should look pressed into the stone, not mounted on it.

3. **Keep the split-name two-line layout** — it reads well on a square-ish stone.

**Files to change:**
- `src/presentation/components/PrayerBrick.tsx` — remove `.placard`, restore `.stone-name`
- `src/index.css` — restore engraved text-shadow styles

---

### Priority 3 — Confirmation Email on Signup

**What the notes say:** Immediate email upon sign-up (currently not implemented).

**Current state:** `SubmitPrayerCommitment` use-case inserts to DB only. No email trigger exists. The `email_logs` table is in place but unused.

**Changes needed:**

1. **Supabase Edge Function: `send-confirmation`**  
   Triggered via a `POST` from `SubmitPrayerCommitment` after the DB insert succeeds. Sends confirmation email via Resend (already modeled in `email_logs.resend_message_id`).

2. **Email content:** "You've been added to the Prayer Foundation wall. Here's what you committed to pray for: [category list]."

3. **Log to `email_logs`** with `status: 'sent'` or `'failed'`.

**Files to change / create:**
- `supabase/functions/send-confirmation/index.ts` — new Edge Function
- `src/application/use-cases/SubmitPrayerCommitment.ts` — call Edge Function after insert
- `src/infrastructure/repositories/SupabasePrayerRepository.ts` — pass categories to use-case result

---

### Priority 4 — Monthly Reminders (not weekly)

**What the notes say:** Monthly newsletter (prayer + financial versions), written by Ivy.

**Current state:** Schema has `reminder_active` and `last_reminded_at` on `commitments`. No scheduler exists yet.

**Changes needed:**

1. **Update reminder interval logic** — if a `pg_cron` or Edge Function scheduler is added, fire monthly not weekly.
2. **Two email templates:** Prayer newsletter and Giving newsletter. Content injected from admin portal (Priority 5).
3. **No code change needed now** — defer until admin portal and newsletter copy from Ivy are ready.

---

### Priority 5 — Admin Portal

**What the notes say:** Drag-and-drop content management, asset uploads (stones/bricks), prayer category management.

**Current state:** No admin UI exists. Categories are seeded in SQL.

**Changes needed (new surface, separate route `/admin`):**

1. **Auth gate** — Supabase email/password auth for HCA staff. Single admin role.
2. **Category manager** — CRUD for `message_categories` table. Reorder via drag-and-drop (`display_order` column already exists).
3. **Asset uploader** — Upload stone/brick PNG assets to Supabase Storage. Store URL on `walls` table (add `stone_asset_url`, `brick_asset_url` columns). Front-end reads URL to use as `background-image`.
4. **Wall content editor** — Edit wall name, org name, description text (currently hardcoded in `WallPage`). Store in `walls` table (add `description TEXT` column).
5. **Giving Wall manual name tool** — Upload static brick wall image, overlay committed donor names as positioned text layers. Export as PNG. (Workaround implementation.)

**Schema additions needed:**
```sql
ALTER TABLE prayer_wall.walls ADD COLUMN description TEXT;
ALTER TABLE prayer_wall.walls ADD COLUMN stone_asset_url TEXT;
ALTER TABLE prayer_wall.walls ADD COLUMN brick_asset_url TEXT;
```

**Files to create:**
- `src/presentation/pages/AdminPage.tsx`
- `src/presentation/pages/admin/CategoriesPage.tsx`
- `src/presentation/pages/admin/AssetsPage.tsx`
- `src/presentation/pages/admin/ContentPage.tsx`

---

## Recommended Implementation Order

| # | Task | Effort | Dependency |
|---|------|--------|------------|
| 1 | Staggered cobblestone layout + first-stone-only CTA | Medium | None |
| 2 | Inscribed name text (remove placard) | Small | None |
| 3 | Deploy to test URL, share with Ivy | Small | 1, 2 |
| 4 | Receive stone assets from HCA designer | External | Ivy |
| 5 | Swap in real stone PNG assets | Small | 4 |
| 6 | Confirmation email Edge Function | Medium | Supabase setup |
| 7 | Admin portal — categories + content | Large | Supabase auth |
| 8 | Admin portal — asset uploader | Medium | 7 |
| 9 | Monthly reminder scheduler | Medium | 7 |
| 10 | Giving Wall static image tool | Large | 7 |

---

## What to Defer

- **Giving Wall workaround** — do not build until Ivy confirms direction with Ken. A static image tool is wasted effort if the narrative pivot lands somewhere else.
- **Monthly newsletter sending** — need Ivy's content first. Infrastructure can be built but don't wire live sends.
- **Multi-org support** — schema supports it, but don't build the UI until a second client exists.

---

## Open Questions for Ivy

1. What file format are the stone assets? PNG with transparent background preferred for flexible CSS composition.
2. Are the stone assets per-state (empty vs. claimed) or do we overlay the name in CSS?
3. What should the confirmation email subject line and from-name be?
4. Is "Heritage Christian Academy" the wall name shown publicly, or a shorter version?
