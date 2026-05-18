# Email Rhythm Mechanism

## Overview

Prayer reminders are delivered on a configurable cadence (daily, weekly, or monthly) using a combination of **Supabase Edge Functions**, **pg_cron**, and **Resend** (transactional email API). No third-party email marketing platform is required.

---

## Architecture

```
┌─────────────────────────────────┐
│        Admin Portal             │
│   Rhythms tab → saves cadence   │
│   to prayer_wall.email_rhythms  │
└────────────┬────────────────────┘
             │ writes
             ▼
┌─────────────────────────────────┐
│   Supabase Postgres             │
│   prayer_wall.email_rhythms     │  ← cadence, day, time, timezone
│   prayer_wall.commitments       │  ← who is on the wall + email
│   prayer_wall.prayer_meditations│  ← scripture + prayer text
│   prayer_wall.email_logs        │  ← delivery audit trail
└────────────┬────────────────────┘
             │ pg_cron triggers every minute
             ▼
┌─────────────────────────────────┐
│   pg_cron job (runs @ * * * *)  │
│   Calls Edge Function via       │
│   net.http_post() or            │
│   supabase_functions.http_request│
└────────────┬────────────────────┘
             │ invokes
             ▼
┌─────────────────────────────────┐
│   Supabase Edge Function        │
│   send-prayer-reminders         │
│                                 │
│  1. Query email_rhythms for     │
│     walls due to send right now │
│  2. For each due wall:          │
│     a. Fetch active commitments │
│     b. For each commitment:     │
│        - Pick a prayer          │
│          meditation from their  │
│          categories             │
│        - Render email template  │
│        - POST to Resend API     │
│        - Log to email_logs      │
└────────────┬────────────────────┘
             │ delivers
             ▼
┌─────────────────────────────────┐
│   Resend (resend.com)           │
│   Transactional email delivery  │
│   Handles: SPF, DKIM, bounces   │
└─────────────────────────────────┘
```

---

## Components

### 1. `prayer_wall.email_rhythms` table
Stores the cadence configuration per wall set by the admin:

| Column | Type | Description |
|---|---|---|
| `cadence` | `ENUM('daily','weekly','monthly')` | How often to send |
| `day_of_week` | `SMALLINT 0–6` | Used when cadence = weekly (0 = Sunday) |
| `day_of_month` | `SMALLINT 1–28` | Used when cadence = monthly |
| `send_time` | `TIME` | Local time to send (e.g. `09:00`) |
| `timezone` | `TEXT` | IANA timezone (e.g. `America/New_York`) |
| `is_active` | `BOOLEAN` | Master on/off switch |

### 2. pg_cron job
Installed via the Supabase dashboard (Database → Extensions → `pg_cron`).

The cron job fires **every minute** and calls the Edge Function. The Edge Function itself determines whether any wall's rhythm is due at the current UTC moment by converting `send_time + timezone` to UTC and comparing.

```sql
SELECT cron.schedule(
  'prayer-reminder-check',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/send-prayer-reminders',
    headers := '{"Authorization": "Bearer <service-role-key>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

> **Note:** Use the **service role key** only inside the pg_cron job — it runs entirely server-side and is never exposed to the browser.

### 3. Edge Function — `send-prayer-reminders`
Located at `supabase/functions/send-prayer-reminders/index.ts` (to be created).

**Logic:**
1. Query all `email_rhythms` where `is_active = true`
2. For each rhythm, convert `send_time` in its `timezone` to UTC and check if it matches the current UTC minute (±1 minute window to handle clock drift)
3. For due walls, fetch all commitments with `reminder_active = true`
4. For each commitment, join their `commitment_categories` → `message_categories` → `prayer_meditations`, select one active meditation at random per category
5. Render a plain-text + HTML email from a template
6. POST to `https://api.resend.com/emails` with the Resend API key
7. Insert a row into `email_logs` with status `sent` or `failed`

### 4. Resend
[Resend](https://resend.com) is the email delivery provider. It provides:
- Simple REST API (`POST /emails`)
- Verified sender domain (requires DNS records: SPF, DKIM)
- Bounce and complaint webhooks (can update `reminder_active = false` on bounce)
- Free tier: 3,000 emails/month, 100/day

**Required secrets** (set in Supabase Dashboard → Edge Functions → Secrets):
```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
SENDER_EMAIL=prayer@heritage.edu
SENDER_NAME=Heritage Christian Academy
```

---

## Data Flow for a Single Email

```
commitment (name="James T.", email="james@example.com")
  ↓  has categories: [Health, Family]
  ↓  active meditations for Health:
       "James 5:14-15 — Father, we lift up every need..."
  ↓  Edge Function builds email:

Subject: Your weekly prayer reminder — Heritage Christian Academy

Hi James,

Thank you for standing on the prayer wall this week.

This week's prayer for Health:
  James 5:14-15 — "Is anyone among you sick? Let them call
  the elders of the church to pray over them." Father, we
  lift up every need for physical and emotional healing.

—
Heritage Christian Academy Prayer Foundation
Unsubscribe: https://wall.heritage.edu/unsubscribe?token=<jwt>
```

---

## Unsubscribe Flow

Each email footer contains a signed unsubscribe link (`/unsubscribe?token=<jwt>`). The token encodes the `commitment_id`. The `UnsubscribePage` component already exists in the app — it sets `reminder_active = false` on the commitment row.

---

## Setup Checklist

- [ ] Enable `pg_cron` extension in Supabase (Dashboard → Database → Extensions)
- [ ] Enable `pg_net` extension (required for `net.http_post`)
- [ ] Run migration `004_email_rhythms.sql`
- [ ] Create Resend account and verify sender domain
- [ ] Set `RESEND_API_KEY`, `SENDER_EMAIL`, `SENDER_NAME` as Edge Function secrets
- [ ] Deploy Edge Function `send-prayer-reminders`
- [ ] Register the pg_cron job (SQL above)
- [ ] Set the rhythm in Admin → Rhythms tab
- [ ] Monitor `prayer_wall.email_logs` for delivery status

---

## Future Enhancements

- **Per-person cadence** — allow each committer to choose their own frequency at sign-up
- **Bounce handling** — Resend webhook auto-sets `reminder_active = false` on hard bounce
- **Email preview** — admin can send a test email to themselves from the Rhythms tab
- **Open tracking** — use Resend's tracking pixel to measure engagement
