# Email Confirmation — Supabase Actions & Changes

**Feature:** Instant confirmation email on brick/stone selection  
**Date:** 2026-07-17  

This document is the complete Supabase-specific runbook for implementing the confirmation email feature. Follow these steps in order.

---

## 1. Apply the Database Migration

**File:** `supabase/migrations/018_email_logs_type.sql`

### What it does

Adds an `email_type` column to `prayer_wall.email_logs` so that confirmation and summary emails can be distinguished from scheduled reminder emails in the audit log.

### SQL

```sql
ALTER TABLE prayer_wall.email_logs
  ADD COLUMN IF NOT EXISTS email_type TEXT NOT NULL DEFAULT 'reminder'
    CHECK (email_type IN ('reminder', 'confirmation', 'summary'));
```

### How to apply

**Option A — Supabase Dashboard (recommended for production)**

1. Open your Supabase project → **SQL Editor**
2. Paste the SQL above and click **Run**
3. Confirm the column appears under **Table Editor → email_logs**

**Option B — Supabase CLI**

```bash
supabase db push
```

Requires the Supabase CLI to be linked to your project (`supabase link --project-ref <ref>`).

### Verify

```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'prayer_wall'
  AND table_name   = 'email_logs'
  AND column_name  = 'email_type';
```

Expected result:

| column_name | data_type | column_default | is_nullable |
|---|---|---|---|
| email_type | text | 'reminder'::text | NO |

### Impact on existing data

- All existing `email_logs` rows receive `email_type = 'reminder'` as the backfill default — no data loss.
- The `send-reminders` Edge Function does not specify `email_type` on insert; it inherits the `'reminder'` default automatically — **no changes needed to that function**.

---

## 2. Deploy the New Edge Function

**Function name:** `send-confirmation`  
**File:** `supabase/functions/send-confirmation/index.ts`

### What it does

Invoked by the React frontend immediately after a successful commitment insert. Sends two emails via Resend:

1. `email_type = 'confirmation'` — short, warm acknowledgement
2. `email_type = 'summary'` — full prayer & meditation guide for the user's selected categories

### How to deploy

```bash
supabase functions deploy send-confirmation
```

Or via the Supabase Dashboard → **Edge Functions → Deploy**.

### Verify deployment

Dashboard → **Edge Functions** — `send-confirmation` should appear in the list with status **Active**.

### Runtime properties

| Property | Value |
|---|---|
| Runtime | Deno (TypeScript) |
| `verify_jwt` | `true` |
| CPU time limit | 2 s (free tier) |
| Request idle timeout | 150 s |
| Auth model | Anon JWT from frontend; service-role client for DB reads |

---

## 3. Confirm Edge Function Secrets

All required secrets are **already in use by `send-reminders`**. No new secrets need to be created. Verify they are set:

**Dashboard → Settings → Edge Functions → Secrets**

| Secret name | Example value | Status |
|---|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` | Auto-injected by runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Auto-injected by runtime |
| `RESEND_API_KEY` | `re_xxxxxxxxxxxx` | Must be set manually |
| `FROM_EMAIL` | `prayer@heritage.edu` | Must be set manually |
| `APP_URL` | `https://your-app.up.railway.app` | Must be set manually |

> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the Supabase runtime into every Edge Function — you do not manage them manually.

If `RESEND_API_KEY`, `FROM_EMAIL`, or `APP_URL` are missing, the function will still execute but Resend calls will fail. The failure is logged to `email_logs` with `status = 'failed'` and to the Edge Function log stream.

---

## 4. Database Tables Read by the New Function

The `send-confirmation` function reads from the following tables using a **service-role client** (bypasses RLS and column-level grants):

| Table | Columns read | Why service-role is required |
|---|---|---|
| `prayer_wall.commitments` | `id`, `wall_id`, `name`, `email` | `email` is hidden from the anon role via column-level grant in `001_initial_schema.sql` |
| `prayer_wall.commitment_categories` | `commitment_id`, `category_id` | Public read policy exists but service-role used for consistency |
| `prayer_wall.message_categories` | `id`, `name`, `display_order` | Public read policy exists |
| `prayer_wall.prayer_meditations` | `category_id`, `body`, `display_order` | Public read policy exists |

The function **writes** to:

| Table | Columns written | Notes |
|---|---|---|
| `prayer_wall.email_logs` | `wall_id`, `commitment_id`, `email`, `status`, `email_type`, `resend_message_id` | Written twice — once per email, regardless of success or failure |

### No new RLS policies required

The service-role key bypasses RLS entirely. The existing `email_logs_deny_all` policy continues to prevent anon/authenticated roles from reading the log table.

---

## 5. Verify the Function is Working

### Manual test via Supabase Dashboard

1. Submit a real commitment via the live app
2. Open **Dashboard → Edge Functions → send-confirmation → Logs**
3. Confirm a log line like:
   ```
   send-confirmation: commitment=<uuid> sent=2 failed=0
   ```

### Verify `email_logs` rows

```sql
SELECT commitment_id, email, status, email_type, sent_at, resend_message_id
FROM prayer_wall.email_logs
WHERE email_type IN ('confirmation', 'summary')
ORDER BY sent_at DESC
LIMIT 10;
```

Expected: two rows per commitment — one with `email_type = 'confirmation'`, one with `email_type = 'summary'`, both with `status = 'sent'` and a non-null `resend_message_id`.

### Test a failure scenario

Temporarily set `RESEND_API_KEY` to an invalid value in Edge Function secrets, submit a commitment, then verify:
- Both rows appear in `email_logs` with `status = 'failed'`
- The commitment itself was still saved successfully
- The wall updates in real time (Realtime is unaffected)

Restore the correct `RESEND_API_KEY` afterwards.

---

## 6. Existing Functions — No Changes Required

| Function | Status | Reason |
|---|---|---|
| `send-reminders` | **Unchanged** | `email_logs` inserts default to `email_type = 'reminder'`; no code edit needed |
| `unsubscribe` | **Unchanged** | Unsubscribe URL in both new emails points to the existing function |

---

## 7. Monitoring

### Edge Function logs

**Dashboard → Edge Functions → send-confirmation → Logs**

Each invocation emits a structured log line on completion:
```
send-confirmation: commitment=<uuid> sent=2 failed=0
```

Failures on individual Resend calls are logged separately:
```
Resend confirmation error: <message>
Resend summary error: <message>
```

### email_logs audit queries

**All-time confirmation send summary:**
```sql
SELECT
  email_type,
  status,
  COUNT(*) AS count
FROM prayer_wall.email_logs
WHERE email_type IN ('confirmation', 'summary')
GROUP BY email_type, status
ORDER BY email_type, status;
```

**Recent failures:**
```sql
SELECT commitment_id, email, email_type, sent_at
FROM prayer_wall.email_logs
WHERE status = 'failed'
  AND email_type IN ('confirmation', 'summary')
ORDER BY sent_at DESC
LIMIT 20;
```

---

## Summary of Supabase changes

| Change | Type | File / Location |
|---|---|---|
| Add `email_type` column to `email_logs` | DDL migration | `supabase/migrations/018_email_logs_type.sql` |
| Deploy `send-confirmation` | New Edge Function | `supabase/functions/send-confirmation/index.ts` |
| Secrets verification | Config check | Dashboard → Settings → Edge Functions → Secrets |
| No new RLS policies | None required | Service-role client used inside function |
| No new tables | None required | All required tables already exist |
| No changes to existing functions | None | `send-reminders`, `unsubscribe` untouched |
