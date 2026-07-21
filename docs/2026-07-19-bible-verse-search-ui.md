# Technical Design: NIV/ESV Word Search for Bible Verses (User-Facing)
## Prayer Rhythms · Prayer Wall

> **Scope:** A user-facing search feature. A visitor types a word/theme, selects **NIV** or **ESV**, and sees matching Bible verses.
> **Builds on:** `docs/2026-06-14-bibleapi.md` (keyword-to-prayer passage design) and the already-implemented `_shared/` service layer.
> **Stack:** React + TypeScript + Vite (frontend), Supabase Edge Functions (Deno) + Postgres (`prayer_wall` schema), API.Bible / YouVersion providers.

---

## 1. Objective

Expose the existing Bible search capability — currently only consumed by the `send-reminders` email flow — as an interactive search UI. A user enters one or more keywords, picks a translation (NIV or ESV), and receives a ranked list of relevant verses with reference and copyright attribution.

The search must stay **licensing-safe**: verse text is fetched live from an authorized provider by reference, never stored long-term, and always shown with attribution. No AI/ML transformation of NIV text.

---

## 2. Current State (what already exists)

| Layer | File | Status |
|---|---|---|
| Provider interface | `@c:\Repositories\prayer-wall\supabase\functions\_shared\bible-provider.ts` | `getPassage()` + optional `searchPassages()` |
| API.Bible adapter | `@c:\Repositories\prayer-wall\supabase\functions\_shared\apibible-provider.ts` | `getPassage()` + `searchPassages()` implemented |
| YouVersion adapter | `@c:\Repositories\prayer-wall\supabase\functions\_shared\youversion-provider.ts` | `getPassage()` + `searchPassages()` implemented |
| Translation resolution | `@c:\Repositories\prayer-wall\supabase\functions\_shared\bible-types.ts:7` | `resolveBibleId('NIV'\|'ESV', provider)` |
| Two-tier service | `@c:\Repositories\prayer-wall\supabase\functions\_shared\prayer-search-service.ts` | Tier 1 curated index → Tier 2 live API → Tier 3 null |
| Cache repo | `@c:\Repositories\prayer-wall\supabase\functions\_shared\prayer-search-repo.ts` | `bible_api_cache` read/write with TTL |
| Schema | `@c:\Repositories\prayer-wall\supabase\migrations\014_bible_search.sql` | index tables + cache seeded |
| Per-wall translation | `@c:\Repositories\prayer-wall\supabase\migrations\015_bible_translation.sql` | `wall_theme.bible_translation` (NIV/ESV) |

**The gap:** `findPassageForText()` returns a **single** passage and is only callable from inside edge functions. There is no HTTP endpoint the browser can call, and no React UI.

---

## 3. High-Level Architecture

```text
React (Vite)                        Supabase Edge Function (Deno)
────────────────                    ──────────────────────────────────
VerseSearchPage                     bible-search  (new, public)
  └ VerseSearchBar (input + NIV/ESV toggle)
  └ VerseResultList        ── supabase.functions.invoke('bible-search',
       │                             { body: { q, translation, limit } })
       ▼                                    │
  useVerseSearch hook                        ▼
       │                        searchVersesForQuery()  (new service fn)
       │                             ├ Tier 1: curated index (prayer_wall.*)
       │                             ├ Tier 2: provider.searchPassages()
       │                             └ dedupe + rank → results[]
       ▼                                    │
  domain/application layer                  ▼
                              ApiBibleProvider / YouVersionProvider
                                     │  (API keys = Supabase secrets)
                                     ▼
                              NIV / ESV verse text (live, by reference)
```

**Key constraints (unchanged from `2026-06-14-bibleapi.md`):**
- Provider API keys (`API_BIBLE_KEY`, `YOUVERSION_APP_KEY`) are Supabase secrets — never sent to the browser.
- All provider calls go through the edge function.
- Verse text is short-TTL cached in `bible_api_cache`, never persisted permanently.

---

## 4. New Backend: `bible-search` Edge Function

New folder `supabase/functions/bible-search/index.ts`, following the same conventions as `send-reminders` and `send-confirmation` (Deno, service role key, `prayer_wall` schema).

### 4.1 API Contract

```text
POST /functions/v1/bible-search      (invoked via supabase.functions.invoke)
Body: { "q": "anxiety fear", "translation": "NIV" | "ESV", "limit": 5 }
```

```jsonc
// 200 OK
{
  "query": "anxiety fear",
  "translation": "NIV",
  "resolvedTranslation": "NIV",   // may differ if a fallback was used
  "results": [
    {
      "reference": "Philippians 4:6-7",
      "text": "Do not be anxious about anything...",
      "translation": "NIV",
      "copyright": "The Holy Bible, New International Version...",
      "source": "index" | "search"   // provenance for observability
    }
  ]
}
```

```jsonc
// Graceful degradation (provider down / not licensed for NIV)
{
  "query": "anxiety",
  "translation": "NIV",
  "resolvedTranslation": "ESV",
  "results": [ { "reference": "...", "text": null, "status": "TEXT_UNAVAILABLE" } ]
}
```

### 4.2 Request Handling

1. **CORS** — mirror `_shared/cors.ts` (or the headers used in existing functions) so the browser can call it.
2. **Validate input** — `q` non-empty, length-capped (e.g. ≤ 120 chars); `translation ∈ {NIV, ESV}`; `limit` clamped to `1..10`.
3. **Resolve provider + bibleId** — reuse the same selection logic as `send-reminders`:
   - Provider = `YouVersionProvider` if `YOUVERSION_APP_KEY` set, else `ApiBibleProvider`.
   - `bibleId = resolveBibleId(translation, providerName)`.
   - Note: YouVersion public tier only supports NIV → if `ESV` requested there, fall back to API.Bible or report `resolvedTranslation`.
4. **Search** — call new `searchVersesForQuery()` (Section 5).
5. **Respond** — JSON with `results[]`, always include attribution.

### 4.3 Auth

- Keep `verify_jwt` decision explicit. For a public marketing search, deploy **without JWT** but protect with rate limiting (Section 8). Anon-key invoke via `supabase.functions.invoke` is acceptable.

---

## 5. New Service: `searchVersesForQuery()`

The existing `findPassageForText()` returns one passage. The search UI needs **multiple ranked results**. Add a sibling function to `prayer-search-service.ts` (do not change the single-result email path).

```typescript
// supabase/functions/_shared/prayer-search-service.ts  (add alongside existing)

export interface VerseSearchHit {
  reference: string;
  text: string | null;
  translation: string;
  copyright: string | null;
  source: "index" | "search";
}

export async function searchVersesForQuery(
  query: string,
  provider: BibleProvider,
  bibleId: string,
  limit = 5,
): Promise<VerseSearchHit[]> {
  const terms = normalizeTerms(query);      // reuse existing normalizer
  const out = new Map<string, VerseSearchHit>();   // key = reference (dedupe)

  // Tier 1: curated index — highest-quality, pastorally mapped passages
  //   findThemesByTerms → findPassagesForThemes → getPassage (cached)
  // Tier 2: live provider.searchPassages() to fill remaining slots
  //   for any free-form keyword not in the index
  // Merge, dedupe by reference, rank (Section 6), slice to `limit`.

  return [...out.values()].slice(0, limit);
}
```

**Reuse, don't duplicate:** `normalizeTerms`, `findThemesByTerms`, `findPassagesForThemes`, `getCachedPassage`, `setCachedPassage` already exist. Both providers already expose `searchPassages()`.

---

## 6. Ranking & Dedupe

Return the most prayer-relevant verses first and avoid near-duplicates.

| Signal | Effect |
|---|---|
| Tier 1 curated match | Strong boost — these are editorially chosen |
| `canonical_weight` × `relevance_weight` | Order within curated results (existing logic) |
| Provider relevance order | Order for Tier 2 live hits |
| Reference dedupe | Same reference from both tiers appears once (prefer `source: "index"`) |
| Chapter diversity | Penalize multiple hits from the same chapter |

Do **not** embed or ML-rank NIV text. Rank on your own metadata + provider order only (licensing rule from `2026-06-14-bibleapi.md` §16).

---

## 7. Frontend UI (Clean Architecture)

Follow the existing layering (`domain` / `application` / `infrastructure` / `presentation`) and the `container` + `useContainer()` DI pattern.

### 7.1 Route

Add to `@c:\Repositories\prayer-wall\src\App.tsx`:

```tsx
<Route path="/verses" element={<VerseSearchPage />} />
```

### 7.2 Files to add

| File | Responsibility |
|---|---|
| `src/domain/entities/BibleVerse.ts` | `BibleVerse` type: `reference`, `text`, `translation`, `copyright` |
| `src/application/dto/VerseSearchResult.ts` | DTO returned to UI |
| `src/infrastructure/bible/BibleSearchClient.ts` | Wraps `supabaseClient.functions.invoke('bible-search', { body })` |
| `src/presentation/pages/VerseSearchPage.tsx` | Page shell (header, layout, MockBanner) |
| `src/presentation/components/VerseSearchBar.tsx` | Input + NIV/ESV toggle + submit |
| `src/presentation/components/VerseResultList.tsx` | Renders results + attribution + empty/error states |
| `src/presentation/hooks/useVerseSearch.ts` | State: `query`, `translation`, `results`, `loading`, `error` |

### 7.3 Invocation pattern (matches existing code)

```tsx
// BibleSearchClient.ts — same pattern as CommitmentForm's send-confirmation call
const { data, error } = await supabaseClient.functions.invoke('bible-search', {
  body: { q, translation, limit: 5 },
});
```

### 7.4 UX details

- **Translation toggle** — segmented NIV / ESV control; default from `wall_theme.bible_translation` (fetched via existing theme flow) or `ESV`.
- **Debounce** search input (~350ms) or require explicit submit to limit provider calls.
- **States** — loading spinner, empty ("No verses found for …"), error ("Search is temporarily unavailable").
- **Attribution** — always render `— {reference} · {copyright}` under each verse (licensing requirement).
- **Styling** — Tailwind + CSS vars already in the app (`var(--color-heading)`, etc.); reuse `ui/Input`, `ui/Button`.
- **Mock mode** — when `VITE_USE_MOCK=true`, return canned verses so the UI works without a provider key.

---

## 8. Security, Abuse & Rate Limiting

Because this endpoint is public and hits paid/limited provider quotas:

- **Input validation** — cap `q` length; allowlist `translation`; clamp `limit`.
- **Rate limiting** — per-IP throttle (edge-level or a `search_rate_limit` table keyed by IP + minute window). API.Bible non-commercial limit is 5,000/day — protect it.
- **Cache-first** — `bible_api_cache` (short TTL) absorbs repeat queries and reduces provider calls.
- **No key exposure** — provider keys stay in Supabase secrets; browser only ever calls `bible-search`.
- **Timeouts / circuit breaker** — bound provider latency; degrade gracefully to reference-only results.

---

## 9. Caching & Licensing

- Reuse `getCachedPassage` / `setCachedPassage` with short TTL (minutes–hours) — verse text is transient.
- Persist only **references + your own metadata**, never long-term NIV text.
- Always render copyright attribution returned by the provider.
- Keep the **NIV kill-switch**: if NIV access changes, fall back to ESV (or an open translation) and surface `resolvedTranslation`.

---

## 10. Error Handling

| Condition | Behavior |
|---|---|
| Empty/invalid `q` | 400 with `{ error }` |
| Unsupported translation | 400, or fall back to ESV with `resolvedTranslation` |
| Provider 401/403 (NIV not licensed) | Fall back to ESV; log securely |
| Provider 404 (no reference) | Omit that hit |
| Provider 429 | Serve cache; if none, return `TEXT_UNAVAILABLE` |
| Provider 5xx / timeout | Return curated references with `text: null`, `status: TEXT_UNAVAILABLE` |
| No matches at all | `results: []` (UI shows empty state) |

---

## 11. Testing & Verification

- **Service unit tests** — `searchVersesForQuery()`: term normalization, dedupe by reference, ranking order, tier fallthrough, limit clamping. Mock the `BibleProvider`.
- **Edge function** — local `supabase functions serve bible-search`; curl NIV and ESV queries; verify attribution and fallback.
- **Frontend** — Playwright: type a query, toggle NIV↔ESV, assert results render with references; assert empty and error states.
- **Manual** — confirm NIV returns via configured provider; confirm ESV returns via API.Bible; confirm provider key never appears in network tab.

---

## 12. Task Breakdown

**Backend**
1. Add `searchVersesForQuery()` + `VerseSearchHit` to `prayer-search-service.ts` (multi-result, dedupe, rank).
2. Create `supabase/functions/bible-search/index.ts` (CORS, validation, provider/bibleId resolution, response shape).
3. Add per-IP rate limiting.
4. Deploy: `supabase functions deploy bible-search`; confirm secrets `API_BIBLE_KEY` (and optionally `YOUVERSION_APP_KEY`).

**Frontend**
5. `BibleVerse` entity + `VerseSearchResult` DTO.
6. `BibleSearchClient` (invoke wrapper) + `useVerseSearch` hook.
7. `VerseSearchBar` (NIV/ESV toggle) + `VerseResultList` (attribution, states).
8. `VerseSearchPage` + `/verses` route in `App.tsx`.
9. Mock-mode canned data.

**Verification**
10. Service unit tests + edge curl checks + Playwright flow.

---

## 13. Out of Scope (future)

- Admin CRUD for themes/keywords/passages (Phase 2 in `2026-06-14-bibleapi.md`).
- Saved verses / devotional plans (Phase 4).
- Full-text search over your own summaries (not over NIV/ESV text).
