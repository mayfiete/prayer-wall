# Meeting Notes — HCA Prayer Wall Review & Giving Wall Planning

**Date:** August 5, 2026  
**Duration:** 23 minutes  
**Attendees:** Terry Mayfield (Fathom / dev), Ivy VanGee (Heritage Christian Academy)  
**Organization:** hcafredericksburg.org  
**Source:** Fathom AI transcript

---

## Purpose

Review feedback from Ivy's testing of the Prayer Wall and plan the initial scope and build strategy for the Giving Wall.

---

## Key Decisions

| Decision | Detail |
|---|---|
| Prayer Wall approved for launch with minor edits | Core functionality confirmed working |
| Giving Wall will be a code clone of Prayer Wall | Accelerates development; same brick/wall architecture |
| Payment processor not yet selected | Evolve proposal flagged as high cost; Justify/Gettrx to be evaluated |
| Both walls launch together | Early school year, unified fundraising campaign |

---

## Topics

### 1. Prayer Wall Feedback & Edits

#### Testing Results
Ivy confirmed the following core flows work end-to-end:
- Name submission (stonemason places a stone)
- Confirmation email received after submission
- Admin portal accessible and navigable

#### Approved UI/UX Edits

**1.1 — Separate muted color theme option**  
The global "Muted" color was controlling subtext across all locations (Header org name, Banner description, etc.). Ivy requested each section have its own independent subtext color control rather than sharing one global value.  
→ **Owner: Terry** | **Status: Complete** — see [Technical Appendix A](#appendix-a-per-section-subtext-colors)

**1.2 — Text editing for Ivy (headings and prompts)**  
Static phrases like "Add your name to the wall" and "Click the next open stone to join!" were hardcoded in the frontend. Ivy needs to be able to edit these from the Theme admin without a code deploy.  
→ **Owner: Terry** | **Status: Complete** — see [Technical Appendix B](#appendix-b-editable-ui-text-strings)

#### Admin Portal Testing
Terry requested Ivy independently test the admin portal's category management, prayer point editing, and meditation editing before the next meeting. This validates the full admin surface before launch.  
→ **Owner: Ivy**

#### Meditation Context
Noted that some prayer categories may contain sensitive, specific requests (e.g., *"Cindy's surgery on Tuesday"*). The meditation system supports this — admins can add, reorder, and deactivate meditations per category without any code changes.

#### Bible Verse API
A planned feature (API.Bible integration for ESV/NIV verses in reminder emails) exists in the codebase but has known performance concerns. Implementation is deferred until performance issues are resolved. The `bible_translation` column is already in the schema and the `API_BIBLE_KEY` secret slot exists in Supabase edge function secrets.

---

### 2. Giving Wall Development Plan

#### Build Strategy
The Giving Wall will be a **direct code clone** of the Prayer Wall repository. This reuses the proven brick/wall layout, admin portal, email infrastructure, and deployment pipeline, reducing build time significantly.

#### Key Architectural Differences from Prayer Wall

| Prayer Wall | Giving Wall |
|---|---|
| Prayer categories (Missions, Faculty, etc.) | No categories — replaced by payment portal |
| Stonemason submits name + email | Donor pays → payment confirmed → brick appears |
| Confirmation email sent on form submit | Webhook from payment processor triggers brick creation |
| Weekly reminder emails via pg_cron | Receipts / thank-you emails (TBD) |

#### Payment Flow (Giving Wall)
1. Visitor clicks "Give" / open stone CTA
2. Payment processor modal opens (Evolve or alternative)
3. Donor completes payment
4. Processor fires a webhook to a Supabase edge function
5. Edge function creates the brick record in the database
6. Brick appears on the Giving Wall

#### Timeline
Terry to begin the Giving Wall build immediately. A functional version (wall renders, payment modal opens, webhook creates brick) to be ready for Ivy to test by the following week's meeting (Aug 13).

---

### 3. Payment Processor Vetting

#### Evolve Proposal (flagged as high cost)

| Fee | Amount |
|---|---|
| Transaction fee | 3.4% + $0.25 |
| Monthly platform fee | $120/mo ($1,440/yr) |
| PCI compliance add-on | ~$100/yr |
| Invoicing add-on | ~$88/yr |
| **Total annual overhead** | **~$1,628/yr** before any transactions |

Terry to contact Evolve (Gannon) to negotiate: nonprofit pricing, PCI compliance waiver, invoice fee waiver, and ACH processing terms. CC Ivy on that email.

#### Competitive Alternatives Under Review

| Processor | Transaction Fee | Nonprofit Cost | Notes |
|---|---|---|---|
| **Justify** | Standard (~2.9%) | Free | Cashback program possible |
| **Gettrx** | Standard (~2.9%) | Free | To be evaluated |
| **Funraise** | 2.9% + $0.60 | Platform fee TBD | Full fundraising platform; per-transaction fee penalizes small gifts |

**ACH Processing** was confirmed as a required feature. ACH avoids card transaction fees for donors making large gifts (e.g., $500+), which is common in school fundraising.

→ **Owner: Ivy** — research Justify and Gettrx, prep a Gettrx account  
→ **Owner: Terry** — research both, prep accounts, evaluate webhook support

---

### 4. WordPress Integration

Terry to send Luke (HCA web team) the API code snippet and WordPress embed instructions for both the Prayer Wall and Giving Wall. After that, coordinate the landing page layout with Luke.  
→ **Owner: Terry**

---

### 5. Launch Plan

Both walls to launch together early in the school year as a unified fundraising and prayer campaign. Terry to draft the joint launch plan.  
→ **Owner: Terry**

---

## Action Items

| # | Item | Owner | Status |
|---|---|---|---|
| 1 | Separate muted color option in Themes tab | Terry | ✅ Complete |
| 2 | Add text-editing for Ivy (headings, prompts) | Terry | ✅ Complete |
| 3 | Match reminder email template to Ivy's sample | Terry | 🔲 Pending |
| 4 | Test admin portal (categories, prayers, meditations) | Ivy | 🔲 Pending |
| 5 | Email Gannon (Evolve) re: nonprofit pricing, PCI/invoice waivers, ACH; CC Ivy | Terry | 🔲 Pending |
| 6 | Research Justify/Gettrx; prep account for Giving Wall | Ivy | 🔲 Pending |
| 7 | Draft joint launch plan (Prayer Foundation + Giving Wall) | Terry | 🔲 Pending |
| 8 | Send Luke API docs + WP embed for both walls; coordinate landing page | Terry | 🔲 Pending |

---

## Next Meeting

**Thursday, August 13, 2026 at 1:00 PM**  
Agenda: Giving Wall progress demo, admin portal feedback from Ivy, payment processor shortlist.

---

---

## Technical Appendices

---

### Appendix A: Per-Section Subtext Colors

**Problem:** The single global `color_muted` CSS variable was used as the subtext color for every section of the wall page. This meant changing the muted color for the header would also affect the banner description, and vice versa.

**Locations that render subtext:**
- **Header** — org name (`VITE_ORG_NAME`) rendered below the wall title
- **Banner** — description paragraph rendered below the banner heading

**Solution:** Two new per-section subtext color columns were added to `wall_theme`, each independently controllable from the Theme admin.

#### Migration (`020_wall_theme_subtext.sql`)
```sql
ALTER TABLE prayer_wall.wall_theme
  ADD COLUMN IF NOT EXISTS color_header_subtext TEXT NOT NULL DEFAULT '#88838a',
  ADD COLUMN IF NOT EXISTS color_banner_subtext TEXT NOT NULL DEFAULT '#88838a';
```
Default value `#88838a` matches the previous global muted color so existing walls see no visual change until explicitly edited.

#### CSS Variables added
| Variable | Used by |
|---|---|
| `--color-header-subtext` | Org name `<p>` in the header |
| `--color-banner-subtext` | Description `<p>` in the banner section |

#### Files changed
- `supabase/migrations/020_wall_theme_subtext.sql` — schema
- `src/infrastructure/supabase/types.ts` — Row / Insert / Update types (manually maintained)
- `src/infrastructure/theme.ts` — `THEME_DEFAULTS` + `applyTheme()`
- `src/index.css` — `:root` fallback defaults
- `src/presentation/pages/WallPage.tsx` — HTML elements now reference `--color-header-subtext` / `--color-banner-subtext`
- `src/presentation/pages/admin/ThemeAdmin.tsx` — "Subtext" `ColorRow` added to Header and Banner sections

---

### Appendix B: Editable UI Text Strings

**Problem:** Several user-facing strings (banner heading, description, wall CTA, modal title, success screen copy, submit button label) were hardcoded as JSX literals in `WallPage.tsx` and `CommitmentForm.tsx`. Changing any of them required a code edit and a deployment.

**Solution:** These strings are now stored as columns on `wall_theme`, written to CSS custom properties by `applyTheme()`, and read back in `WallPage` via a `useThemeVar` hook. The Theme admin exposes a "UI Text" section with editable fields for each string.

#### Migration (`021_wall_theme_text_strings.sql`)
```sql
ALTER TABLE prayer_wall.wall_theme
  ADD COLUMN IF NOT EXISTS text_banner_heading  TEXT NOT NULL DEFAULT 'Add your name to the wall',
  ADD COLUMN IF NOT EXISTS text_banner_body     TEXT NOT NULL DEFAULT 'Commit to pray for one or more areas of need...',
  ADD COLUMN IF NOT EXISTS text_wall_cta        TEXT NOT NULL DEFAULT 'Click the next open stone to join!',
  ADD COLUMN IF NOT EXISTS text_modal_title     TEXT NOT NULL DEFAULT 'Commit to pray',
  ADD COLUMN IF NOT EXISTS text_success_heading TEXT NOT NULL DEFAULT 'Your stone has been placed!',
  ADD COLUMN IF NOT EXISTS text_success_body    TEXT NOT NULL DEFAULT 'You will receive weekly prayer reminders by email.',
  ADD COLUMN IF NOT EXISTS text_submit_button   TEXT NOT NULL DEFAULT 'Add my stone to the foundation!';
```

#### Data flow
```
ThemeAdmin (edit field)
  → update() → applyTheme() → setProperty('--text-banner-heading', value)   [live preview]
  → handleSave() → supabase.upsert() + cacheTheme()                         [persisted]

WallPage (on mount)
  → loadCachedTheme() → applyTheme(cached)                                  [instant from localStorage]
  → fetchAndApplyTheme() → applyTheme(db row) + cacheTheme()                [authoritative from DB]
  → useThemeVar('--text-banner-heading', fallback)                           [reads CSS var into React state]
  → MutationObserver on <html style> → re-reads var if applyTheme fires      [live updates]
```

#### `useThemeVar` hook
```ts
function useThemeVar(varName: string, fallback: string): string {
  const [val, setVal] = useState(
    () => getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback
  )
  useEffect(() => {
    const obs = new MutationObserver(() => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
      if (v) setVal(v)
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => obs.disconnect()
  }, [varName])
  return val
}
```
This replaces the previous one-off `wallTitle` state + effect pattern. All seven text vars use the same hook.

#### Known gotcha — stale localStorage
If `cacheTheme` was last called before migration 021 was applied, the cached JSON will have no `text_*` keys. On the next `loadCachedTheme`, `applyTheme` merges with `THEME_DEFAULTS` and the CSS vars will always be the hardcoded defaults regardless of what's in the DB. **Fix:** save the theme once from the Theme admin after applying the migration. This writes a new cache entry that includes all `text_*` keys.

#### Files changed
- `supabase/migrations/021_wall_theme_text_strings.sql` — schema
- `src/infrastructure/supabase/types.ts` — Row / Insert / Update types
- `src/infrastructure/theme.ts` — `THEME_DEFAULTS` + `applyTheme()`
- `src/presentation/pages/WallPage.tsx` — `useThemeVar` hook; all seven strings now theme-driven
- `src/presentation/components/CommitmentForm.tsx` — `successHeading`, `successBody`, `submitLabel` props added
- `src/presentation/pages/admin/ThemeAdmin.tsx` — "UI Text" section with `TextRow` component; `TextRow` supports single-line and multiline inputs
