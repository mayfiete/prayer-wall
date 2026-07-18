# Email Confirmation — Resend Infrastructure & Interactions

**Feature:** Instant confirmation email on brick/stone selection  
**Date:** 2026-07-17  

This document covers every Resend-specific configuration, API interaction, and operational concern for the confirmation email feature. It assumes Resend is already in use for the `send-reminders` function; shared infrastructure is noted where applicable.

---

## 1. Resend Account Prerequisites

### Sender domain verification

Every email sent by this feature uses the address stored in the `FROM_EMAIL` Edge Function secret (e.g. `prayer@heritage.edu`). The domain must be **verified** in Resend before any email is delivered from it. Without verification, Resend falls back to its shared `@resend.dev` domain, which significantly increases the chance of landing in spam.

**Dashboard location:** Resend → **Domains** → Add Domain

Three DNS records must exist at your domain registrar:

| Record type | Host / Name | Value | Purpose |
|---|---|---|---|
| `TXT` | `resend._domainkey.<yourdomain>` | DKIM public key — provided by Resend after domain creation | Proves the email cryptographically originates from your domain |
| `TXT` | `@` (or `<yourdomain>`) | SPF record: `v=spf1 include:amazonses.com ~all` | Authorises Resend's Amazon SES sending infrastructure |
| `MX` | `bounce.<yourdomain>` | Resend bounce MX — provided by Resend | Routes hard bounce notifications back to Resend for tracking |

DNS propagation typically takes 5–30 minutes. Resend's dashboard shows a green verified badge per record once propagation is confirmed.

> If `send-reminders` is already delivering email from the same `FROM_EMAIL` domain, this domain is already verified and no new DNS records are needed.

### API key

The `RESEND_API_KEY` (format: `re_xxxxxxxxxxxxxxxxxxxx`) is a project-scoped key created in Resend → **API Keys**.

- The same key used by `send-reminders` is reused by `send-confirmation` — no new key is required.
- The key is stored as a Supabase Edge Function secret and is **never exposed to the browser**.
- The key grants permission to send email only. It does not grant access to contacts, domains, or account settings unless explicitly scoped.

---

## 2. API Calls Made by `send-confirmation`

The function makes **two sequential POST requests** to Resend's v1 emails endpoint — one per commitment. Both calls happen inside the same Edge Function invocation.

### Email #1 — Confirmation

```
POST https://api.resend.com/emails
Authorization: Bearer <RESEND_API_KEY>
Content-Type: application/json

{
  "from": "Prayer Wall <prayer@heritage.edu>",
  "to": ["<recipient email>"],
  "subject": "Your prayer stone has been placed",
  "html": "<confirmation email HTML>",
  "tags": [
    { "name": "type", "value": "confirmation" }
  ]
}
```

### Email #2 — Prayer & Meditation Summary

```
POST https://api.resend.com/emails
Authorization: Bearer <RESEND_API_KEY>
Content-Type: application/json

{
  "from": "Prayer Wall <prayer@heritage.edu>",
  "to": ["<recipient email>"],
  "subject": "Your prayers & meditations",
  "html": "<summary email HTML>",
  "tags": [
    { "name": "type", "value": "summary" }
  ]
}
```

### Sequencing

The two calls are **sequential, not parallel** — Email #1 is awaited before Email #2 is dispatched. This ensures the confirmation arrives first. The total additional latency from making two calls instead of one is approximately 150–300 ms inside the Edge Function, which is imperceptible to the user since the frontend fires the function call asynchronously.

---

## 3. Resend Response Handling

### Success response (HTTP 200)

```json
{
  "id": "re_xxxxxxxxxxxxxxxxxxxxxx"
}
```

The `id` value is the Resend message identifier. It is stored in `prayer_wall.email_logs.resend_message_id` for each email. This ID can be used in the Resend dashboard to look up the exact delivery event for any individual send.

### Failure response (HTTP 4xx / 5xx)

```json
{
  "name": "validation_error",
  "message": "Invalid `to` field."
}
```

On failure:
- The `status` column in `email_logs` is set to `'failed'`
- `resend_message_id` is set to `null`
- The error message is logged to the Supabase Edge Function log stream
- The function continues to attempt the second email independently

---

## 4. The `tags` Field

Both emails include a `tags` array:

```json
"tags": [{ "name": "type", "value": "confirmation" }]
// or
"tags": [{ "name": "type", "value": "summary" }]
```

Tags appear in the Resend dashboard **Emails** view as a filterable label. This allows an operator to filter `type:confirmation` or `type:summary` across all sends without needing to query the Supabase `email_logs` table. Tags are also available in Resend webhook payloads for downstream processing.

---

## 5. Delivery Lifecycle

After `send-confirmation` POSTs to Resend, the following events occur inside Resend's infrastructure:

```
send-confirmation Edge Function
        │
        │  POST /emails
        ▼
   Resend API layer
        │  validates request, authenticates API key, queues message
        ▼
   Resend sending infrastructure (Amazon SES)
        │  SMTP handoff to recipient mail server
        ▼
   Recipient mail server
        │
        ├─ Accepted → status: Delivered
        ├─ Soft bounce (mailbox full, temp unavailable) → Resend retries
        └─ Hard bounce (address does not exist) → status: Bounced
                                                  → Resend records bounce
                                                  → Webhook fires (if configured)
```

All of these events are visible in the Resend dashboard under **Emails**, identified by the `resend_message_id` stored in `email_logs`.

---

## 6. Free Tier Capacity

The `send-confirmation` function sends **2 emails per commitment**. The existing `send-reminders` function also sends via the same account.

| Resend free tier limit | Value | Combined headroom |
|---|---|---|
| Monthly emails | 3,000 | ~1,000 new commitments/month with room for reminders |
| Daily emails | 100 | ~40 new commitments/day before hitting the cap |
| API rate limit | 2 requests/second | Sequential sends (2 per function call) are well within this |

For a typical single-church deployment these limits are not a concern. If the wall grows substantially, upgrading to Resend's **Pro plan ($20/month)** raises limits to 50,000 emails/month with no daily cap.

---

## 7. Email HTML Design

Both templates follow the visual language of the existing `send-reminders` emails to ensure inbox consistency. Key CSS values:

| Element | Style |
|---|---|
| `font-family` | `Georgia, 'Times New Roman', serif` |
| `max-width` | `560px`, `margin: 32px auto` |
| Header background | `#9a3412` (deep earth red) |
| Header subheading text | `#fca5a5` (light rose) |
| Header title | `#ffffff`, `font-weight: normal`, 22px |
| Body text | `#44403c`, 15px, `line-height: 1.7` |
| Category label | `#9a3412`, 12px, bold, uppercase, `letter-spacing: 0.08em` |
| Meditation paragraph spacing | `margin: 0 0 1.2em` — produces the paragraph-break separation |
| Category divider | `<hr>` with `border-top: 1px solid #e7e5e4; margin: 24px 0` |
| Footer background | `#fafaf9` |
| Footer text / unsubscribe link | `#a8a29e`, 12px |

### Unsubscribe link

Both emails include a footer unsubscribe link:

```
{APP_URL}/unsubscribe?id={commitment_id}
```

This routes to `UnsubscribePage.tsx` in the React app, which calls the existing `unsubscribe` Edge Function and sets `reminder_active = false` on the commitment. No new unsubscribe infrastructure is required.

This link satisfies **CAN-SPAM** and **GDPR** requirements for a functional opt-out mechanism in every commercial/transactional email.

---

## 8. Inbox Behaviour

Because both emails share the same `from` address and are sent to the same recipient within seconds of each other, most email clients will **thread them together**. The confirmation appears first; the summary appears beneath it in the same thread.

If this threading behaviour reduces the perceived importance of the summary email (it may be overlooked inside the confirmation thread), the mitigation is to introduce a deliberate delay between the two sends:

```typescript
await new Promise((resolve) => setTimeout(resolve, 5000)); // 5-second delay
```

This is noted as a future enhancement in the spec but is **not implemented** in the current version.

---

## 9. Resend Dashboard — Day-to-Day Monitoring

### Viewing sent emails

**Resend → Emails**

Filter by tag `type:confirmation` or `type:summary` to isolate confirmation sends from scheduled reminder sends.

Each row shows:
- Recipient address
- Subject line
- Sent timestamp
- Delivery status (Delivered / Bounced / Failed)
- Tags

Clicking a row shows the full event timeline and a rendered preview of the HTML.

### Identifying a specific send

Cross-reference the `resend_message_id` stored in `prayer_wall.email_logs` with the **Message ID** field in Resend's email detail view to trace any individual send end-to-end.

```sql
SELECT resend_message_id, email, status, email_type, sent_at
FROM prayer_wall.email_logs
WHERE commitment_id = '<uuid>'
ORDER BY sent_at;
```

---

## 10. Future: Bounce Webhook

Resend supports sending webhook events to a configured URL when a bounce or complaint occurs. This is not implemented in the current version but is the recommended next step for production hardening.

### Recommended setup (future milestone)

1. Create a new Edge Function `handle-bounce` that:
   - Validates the Resend webhook signature (using `Resend-Signature` header)
   - On `email.bounced` event type with `bounce_type = 'hard'`: sets `reminder_active = false` on the matching commitment
   - Updates `email_logs.status` to `'bounced'` for the affected row
2. Register the function URL in Resend → **Webhooks → Add Endpoint**
3. Subscribe to events: `email.bounced`, `email.complained`

Until this is implemented, hard bounces are visible in the Resend dashboard but do not automatically suppress future reminder emails to that address.

---

## Summary of Resend actions required

| Action | Required now | Notes |
|---|---|---|
| Verify sender domain (SPF, DKIM, bounce MX) | **If not already done** | Already done if `send-reminders` is delivering |
| Confirm `RESEND_API_KEY` is set as Supabase secret | **Yes** | Same key as `send-reminders` |
| Confirm `FROM_EMAIL` is set as Supabase secret | **Yes** | Same value as `send-reminders` |
| Create new Resend API key | **No** | Existing key reused |
| Configure bounce webhook | **No — future** | See §10 above |
| Enable open/click tracking | **No — optional** | Off by default in Resend |
