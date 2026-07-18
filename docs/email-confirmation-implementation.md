# Email Confirmation — Implementation Notes

**Date:** 2026-07-17  
**Status:** Complete — awaiting migration apply + function deploy  

---

## What was built

Three artifacts were created or modified to implement the two-email confirmation flow described in `email-confirmation-spec.md`.

---

## 1. Database migration

**File:** `supabase/migrations/018_email_logs_type.sql`

Adds an `email_type` column to `prayer_wall.email_logs`:

```sql
ALTER TABLE prayer_wall.email_logs
  ADD COLUMN IF NOT EXISTS email_type TEXT NOT NULL DEFAULT 'reminder'
    CHECK (email_type IN ('reminder', 'confirmation', 'summary'));
```

**Key design notes:**
- `DEFAULT 'reminder'` — all existing rows and all future `send-reminders` inserts remain valid with zero changes to that function.
- The `CHECK` constraint prevents any other value from being written.
- No other schema changes were required. All tables consumed by the new function (`commitments`, `commitment_categories`, `message_categories`, `prayer_meditations`) already existed.

---

## 2. Edge Function

**File:** `supabase/functions/send-confirmation/index.ts`

A new Deno/TypeScript Edge Function. Self-contained; no shared modules required.

### Auth model
- `verify_jwt: true` — Supabase runtime validates the anon JWT sent automatically by `supabase.functions.invoke()` in the frontend.
- A **service-role** Supabase client is created inside the function for all DB reads. This bypasses RLS and column-level restrictions (specifically the `email` column hidden from the anon role).

### Execution path

| Step | Action |
|---|---|
| 1 | CORS preflight — return `200` with `Access-Control-Allow-Origin: *` |
| 2 | Parse JSON body; validate `commitment_id` is a UUID (regex check) |
| 3 | Fetch commitment row (`id`, `wall_id`, `name`, `email`) — `404` if not found |
| 4 | Fetch `commitment_categories` → resolve `category_id` list |
| 5 | Fetch `message_categories` for those IDs, ordered by `display_order ASC` |
| 6 | Fetch all active `prayer_meditations` for those categories in one query; group into `Map<category_id, string[]>` |
| 7 | Build Email #1 HTML (confirmation template) |
| 8 | POST to Resend — subject: `"Your prayer stone has been placed"`, tag: `confirmation` |
| 9 | Insert row into `email_logs` with `email_type = 'confirmation'` |
| 10 | Build Email #2 HTML (prayer & meditation summary template) |
| 11 | POST to Resend — subject: `"Your prayers & meditations"`, tag: `summary` |
| 12 | Insert row into `email_logs` with `email_type = 'summary'` |
| 13 | Return `{ sent, failed, errors? }` |

### Error behaviour
- DB errors before any send → `500`, no emails sent.
- Commitment not found → `404`, no emails sent.
- Resend failure on Email #1 → logged as `failed`; Email #2 still attempted independently.
- Resend failure on Email #2 → logged as `failed`; partial result returned.
- Frontend errors → logged to console only; never surface a blocking UI error to the user.

### Email #1 — Confirmation template
- Header: `#9a3412` earth-tone banner, *"Prayer Wall · Commitment Confirmed"*
- Body: warm acknowledgement; tells the user a prayer guide is on its way.
- Footer: unsubscribe link — `{APP_URL}/unsubscribe?id={commitment_id}`

### Email #2 — Prayer & meditation summary template
- Header: `#9a3412` banner, *"Prayer Wall · Your Prayer Guide"*
- Body: one labelled section per category (ordered by `display_order`); each meditation rendered as a `<p>` with `margin-bottom: 1.2em` for paragraph-break separation; categories separated by `<hr>`.
- Fallback: if no active meditations exist for any category, a single explanatory paragraph is shown instead.
- Footer: unsubscribe link.

### Resend API tagging
Each send includes `"tags": [{ "name": "type", "value": "confirmation|summary" }]`. These labels appear in the Resend dashboard **Emails** view, enabling filtering without querying `email_logs`.

---

## 3. Frontend change

**File:** `src/presentation/components/CommitmentForm.tsx`

### What changed
- Added import of `supabaseClient` from `../../infrastructure/supabase/client`.
- After `submitPrayerCommitment.execute()` resolves, a **fire-and-forget** call invokes the Edge Function:

```typescript
supabaseClient?.functions.invoke('send-confirmation', {
  body: { commitment_id: newPrayer.id },
}).catch((err: unknown) => console.error('[send-confirmation]', err))
```

### Design decisions
- **`?.` optional chaining** — `supabaseClient` is `null` when `VITE_USE_MOCK=true`, so the call is safely skipped in mock/dev mode. No emails are sent during local development.
- **Fire-and-forget** — the `onSuccess` callback (modal close + navigate to `/`) is not gated on the Edge Function call. A Resend outage cannot break the commitment flow.
- **Silent catch** — a failed invocation logs to the browser console but shows no error UI to the user, consistent with the spec requirement.
- **Direct `supabaseClient` import** — per ADR-001, no `IEmailNotificationService` abstraction was introduced. The call site is `CommitmentForm.tsx` only.

---

## Deploy checklist

- [ ] **Apply migration** — run `018_email_logs_type.sql` against the Supabase project (Dashboard → SQL Editor, or `supabase db push`)
- [ ] **Deploy Edge Function** — `supabase functions deploy send-confirmation`
- [ ] **Verify secrets** — confirm these are set in Dashboard → Edge Functions → Secrets:
  - `RESEND_API_KEY`
  - `FROM_EMAIL`
  - `APP_URL`
- [ ] **Verify Resend domain** — sender domain must be verified with SPF, DKIM, and bounce MX (see `email-confirmation-spec.md` → Resend Infrastructure)
- [ ] **Smoke test** — submit a commitment on the live app; confirm:
  - Both emails arrive in inbox
  - Two rows in `prayer_wall.email_logs` with `email_type = 'confirmation'` and `email_type = 'summary'`
  - `status = 'sent'` on both rows
  - `resend_message_id` populated on both rows
- [ ] **Mock mode is unaffected** — run with `VITE_USE_MOCK=true`; confirm no console errors and the form still works

---

## Files changed

| File | Change type |
|---|---|
| `supabase/migrations/018_email_logs_type.sql` | New |
| `supabase/functions/send-confirmation/index.ts` | New |
| `src/presentation/components/CommitmentForm.tsx` | Modified (2 lines) |

---

## No changes required in

| File | Reason |
|---|---|
| `supabase/functions/send-reminders/index.ts` | Unaffected; `email_logs` inserts default `email_type = 'reminder'` |
| `supabase/functions/unsubscribe/index.ts` | Existing unsubscribe flow covers both new emails |
| `src/presentation/pages/UnsubscribePage.tsx` | No change needed |
| Any domain or repository files | Per ADR-001, no new abstractions introduced |
| Any other migration files | No other schema changes needed |
