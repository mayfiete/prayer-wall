# Prayer Foundation & Giving Wall

A React and TypeScript application that helps an organization build a visible community of prayer supporters and donors. The **Prayer Foundation** displays a stone for each prayer commitment; the **Giving Wall** displays a brick for each recorded gift. Both products share presentation components, theme controls, and infrastructure.

The frontend is built with Vite and Tailwind CSS. Supabase provides the database, authentication, Storage, Realtime, and Deno Edge Functions. Stripe handles hosted payment checkout, and Resend delivers email. Public views can also run with in-memory mock repositories for local development.

## Contents

- [Products and features](#products-and-features)
- [Architecture](#architecture)
- [User journeys](#user-journeys)
- [Routes](#routes)
- [Local development](#local-development)
- [Configuration](#configuration)
- [Database and migrations](#database-and-migrations)
- [Edge Functions and email](#edge-functions-and-email)
- [Deployment](#deployment)
- [Verification and troubleshooting](#verification-and-troubleshooting)
- [Security posture and remaining work](#security-posture-and-remaining-work)
- [Repository guide](#repository-guide)

## Products and features

### Prayer Foundation

Visitors select one or more prayer categories, enter their name and email, and add a stone to the foundation. Names appear publicly; email addresses are not displayed on the wall. New commitments arrive through Supabase Realtime.

After signup, the app requests a confirmation email and a prayer guide containing category meditations. Scheduled reminders use active categories and rhythms, with personal prayer points included where available. Participants can unsubscribe from reminders through an email link.

The prayer admin area includes:

- **Categories:** create, rename, reorder, activate, and manage categories, their meditations, and rhythm assignments.
- **Rhythms:** configure daily, weekly, or monthly schedules, local send times, timezones, activation, and end dates.
- **Stonemasons:** manage prayer participants, prayer points, and individual rhythm assignments.
- **Assets:** upload wall textures and logos.
- **Theme:** edit colors, fonts, layout settings, and interface copy with live preview.
- **Emails:** edit sender name, shared wording, confirmation, prayer guide, and reminder copy for this wall.

The current reminder worker selects recipients through **category-to-rhythm assignments**. Individual rhythm assignments exist in the admin and database, but the worker does not currently use `commitment_rhythms` to select recipients.

### Giving Wall

Visitors choose a preset or custom gift amount, enter a required first name and optionally a last name. The frontend combines these into the name sent to Checkout; it currently does **not** offer an Anonymous toggle. In Supabase mode, the app redirects them to **Stripe-hosted Checkout** to enter payment details.

A verified, paid Checkout event records the donation and a linked commitment. Realtime then updates the giving wall, and the webhook requests a thank-you email. A successful donation does **not** subscribe the donor to prayer reminders.

The giving admin area includes Rhythms, Assets, Theme, Emails, and **Bricklayers**. The Emails tab edits this wall's sender name, shared wording, and donation thank-you text. The Bricklayers view lists recorded donations, amounts, dates, processor references, email opt-out status, and a total. A Rhythms tab is available, but the current email worker is a category-based prayer reminder worker; a separate recurring donor-email campaign is not implemented.

### Shared presentation

Both public walls use `WallHeader`, `WallBanner`, `WallGrid`, `WallBrick`, and the shared modal and form controls. `useWallLayout` measures the grid container with `ResizeObserver`, adapts the number and size of tiles, and observes live theme changes. The configured row count acts as a maximum; narrower containers use fewer columns. Alternate rows retain their stagger except in a single-column layout.

Public headers and forms adapt to narrow screens. Dialog content scrolls within the available viewport height while keeping the close button visible. Themes and cached assets are separated by wall, with Storage folders such as `prayer/stone`, `prayer/logo`, `giving/stone`, and `giving/logo`.

## Architecture

```mermaid
graph TD;
    Visitor["Visitor"] --> Public["Prayer Foundation / Giving Wall"]
    Admin["Administrator"] --> AdminUI["Admin pages"]
    subgraph Frontend["React frontend - Vite and TypeScript"]
        AdminUI["Admin pages"]
        Public --> Shared["Shared components and responsive grid"]
        Public --> Hooks["Hooks and AppContext"]
        Hooks --> UseCases["Application use cases"]
        UseCases --> Ports["Domain repository and payment interfaces"]
        Wiring["container.ts - selects adapters"] -.-> UseCases
        Ports --> Mock["In-memory repositories and simulated payments"]
        Ports --> Repos["Supabase repositories"]
        Ports --> Gateway["StripeCheckoutGateway"]
    end
    subgraph Backend["Supabase"]
        Auth["Auth"]
        DB["Postgres - prayer_wall schema"]
        Storage["Storage - textures and logos"]
        Realtime["Realtime subscriptions"]
        Functions["Deno Edge Functions"]
        Cron["Hourly pg_cron / pg_net"]
        Vault["Vault - scheduler credentials"]
    end
    AdminUI --> Auth
    AdminUI --> DB
    AdminUI --> Storage
    Repos --> DB
    DB --> Realtime
    Realtime --> Hooks
    Storage --> Shared
    Gateway --> Functions
    Public -->|Confirmation request| Functions
    Vault --> Cron
    Cron --> Functions
    Functions --> DB
    Functions --> Resend["Resend email delivery"]
    Functions -->|Create Checkout Session| Stripe["Stripe-hosted Checkout"]
    Stripe -->|Signed webhook| Functions
```

The public business flows follow a layered architecture:

| Layer | Location | Responsibility |
| --- | --- | --- |
| Domain | `src/domain/` | Entities, repository/payment interfaces, and domain errors. |
| Application | `src/application/` | Use cases and input DTOs for commitments, categories, meditations, checkout, and opt-out. |
| Infrastructure | `src/infrastructure/` | Supabase and mock adapters, payment gateways, theme handling, database types, and dependency wiring. |
| Presentation | `src/presentation/` | React pages, components, hooks, and context. |
| Server functions | `supabase/functions/` | Privileged payment persistence, email delivery, and opt-out endpoints. |

[`container.ts`](src/infrastructure/container.ts) chooses mock or Supabase adapters and constructs the use cases exposed through `useContainer()`. Admin pages also use the Supabase client directly for management operations. The frontend is a single-page application; there is no separate Express or Python application server.

## User journeys

### Prayer signup and reminders

```mermaid
graph TD;
    Form["Name, email, selected categories"] --> Validate["SubmitPrayerCommitment validates input"]
    Validate --> Save["Create commitment and category links"]
    Save --> Realtime["Realtime updates the foundation"]
    Save --> Confirm["send-confirmation"]
    Confirm --> Welcome["Confirmation and prayer-guide emails"]
    Confirm --> Logs["email_logs"]

    Cron["Hourly scheduler"] --> Due["send-reminders checks local hour, cadence, and end date"]
    Due --> Categories["Find categories assigned to due rhythms"]
    Categories --> Participants["Find subscribed commitments with reminders active"]
    Participants --> Content["Build meditations and personal prayer points"]
    Content --> Email["Send through Resend"]
    Email --> Logs
    Email --> Unsubscribe["Participant follows unsubscribe link"]
    Unsubscribe --> Disable["Set reminder_active to false"]
```

Prayer signup writes the commitment and category links in separate database requests. Email delivery is requested after the signup succeeds; the displayed success message is not proof of successful email delivery. Check `email_logs` and Edge Function logs when diagnosing email issues.

### Donation checkout

```mermaid
sequenceDiagram
    participant Visitor
    participant App as Giving Wall
    participant Checkout as create-donation-checkout
    participant Stripe
    participant Webhook as giving-wall-webhook
    participant DB as Supabase Postgres
    participant Thanks as send-donation-thanks
    participant Mail as Resend

    Visitor->>App: Choose amount, first name, optional last name
    App->>Checkout: Request Checkout Session
    Checkout->>Stripe: Create hosted Checkout Session
    Stripe-->>Checkout: Session URL
    Checkout-->>App: Redirect URL
    App-->>Visitor: Open Stripe-hosted Checkout
    Visitor->>Stripe: Complete payment
    Stripe-->>App: Redirect to success or cancelled URL
    Stripe->>Webhook: Signed Checkout event
    Webhook->>Webhook: Validate signature, mode, paid status, and wall
    Webhook->>DB: Audit event and call record_paid_donation
    DB-->>Webhook: Donation and linked commitment
    DB-->>App: Realtime donation insert
    App-->>Visitor: Display brick
    Webhook->>Thanks: Request thank-you email for a new donation
    Thanks->>Mail: Send thank-you email
    Thanks->>DB: Record email status
```

Stripe's redirect and webhook are independent; the brick can appear after the visitor returns. The redirect does not create a donation. The webhook handles `checkout.session.completed` and `checkout.session.async_payment_succeeded`, and only records paid sessions. Event auditing and an idempotent database function protect against duplicate payment records on retries.

Only the webhook's service-role path may create production donations. The `record_paid_donation` function creates the donation and linked commitment in one transaction. The commitment has `reminder_active = false`. The webhook supports anonymity metadata for legacy/other callers and uses a name from Checkout metadata or Stripe billing details when available, but the current frontend does not expose anonymity.

## Routes

| Path | Purpose |
| --- | --- |
| `/`, `/prayer` | Public Prayer Foundation. |
| `/commit` | Alternate prayer commitment entry page. |
| `/giving` | Public Giving Wall and checkout entry. |
| `/giving?checkout=success` | Checkout return message; the donation arrives separately through the webhook. |
| `/giving?checkout=cancelled` | Cancelled checkout return message. |
| `/admin`, `/prayer/admin` | Prayer administration. |
| `/giving/admin` | Giving administration. |
| `/unsubscribe?id=<commitment-id>` | Stop prayer reminders. |
| `/unsubscribe?donation=<donation-id>` | Opt out of donation emails. |

Admin login uses Supabase email/password authentication and checks the configured `VITE_ADMIN_EMAIL` in the browser. This is only a UI guard: some database and Storage policies grant privileges to **every** authenticated Supabase user, regardless of that email. See [Security posture and remaining work](#security-posture-and-remaining-work) before creating additional accounts.

## Local development

### Prerequisites

- Node.js **22 or newer** and npm, including for the Node-based Edge Function regression tests.
- A Supabase project for persisted data and admin functionality.
- Access to the Supabase CLI for function deployment; it is not needed for the mock public views.

### Start with mock public views

```bash
npm ci
```

Copy [`.env.example`](.env.example) to `.env.local`. For example, in PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Set `VITE_USE_MOCK=true`. Keep the example organization and prayer wall IDs to use the seeded mock data. **Remove or leave blank `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for an entirely offline public-view demo.** The shared client is still created when both variables are supplied, and the prayer form can attempt a confirmation-function call through that client even in mock mode.

```bash
npm run dev
```

Open the address printed by Vite, usually `http://localhost:5173`, and visit `/` and `/giving`. Mock data is in memory and resets on reload. Mock Realtime simulates new entries. The giving wall uses a simulated payment form: `4242 4242 4242 4242` approves and `4000 0000 0000 0002` declines; no payment processor is called.

**Mock mode covers the public use cases, not the admin screens.** Admin pages require a configured Supabase client and an authorized account. In PowerShell environments that block `npm.ps1`, use `npm.cmd` for the same commands.

### Run with Supabase

1. Prepare the schema and wall records using the migration guidance below.
2. Set `VITE_USE_MOCK=false` and replace the example project URL, anon key, organization ID, and wall IDs with actual values.
3. Configure an admin account, Storage bucket, and Realtime for `commitments` and `donations` as needed.
4. Deploy the required Edge Functions and configure their secrets.
5. Restart Vite after changing `.env.local`.

Supabase mode requires the configured wall IDs to exist in the database. The placeholder UUIDs in `.env.example` are not production records.

## Configuration

### Frontend environment

Vite embeds `VITE_*` values into the browser bundle at build time. Set them before building and rebuild when deployment values change. Keep server credentials out of these variables.

| Variable | Purpose |
| --- | --- |
| `VITE_USE_MOCK` | Exactly `true` selects in-memory repositories; unset or `false` selects Supabase. |
| `VITE_SUPABASE_URL` | Supabase project URL. |
| `VITE_SUPABASE_ANON_KEY` | Browser anon/public API key, subject to database permissions. |
| `VITE_ORG_ID` | Organization for prayer categories and administration. |
| `VITE_WALL_ID` | Prayer wall ID. |
| `VITE_ORG_NAME` | Organization display name. |
| `VITE_GIVING_WALL_ID` | Giving wall ID for the public wall, theme, and admin. Mock public checkout supplies its own ID. |
| `VITE_GIVING_ORG_ID` | Optional giving-admin organization override; falls back to `VITE_ORG_ID`. |
| `VITE_ADMIN_EMAIL` | Email allowed by the frontend admin guard. |
| `VITE_ASSETS_BUCKET` | Storage bucket for textures and logos. Code defaults to `wall-assets`; the example uses `prayer-wall-images`. Match the bucket you provision. |

### Edge Function secrets

Set these in **Supabase Dashboard → Edge Functions → Secrets**:

| Secret | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Email delivery through Resend. |
| `FROM_EMAIL` | Verified sender; the configured sending domain is `prayerrhythm.com`, using `noreply@prayerrhythm.com`. |
| `APP_URL` | Frontend origin for Checkout return URLs and email links. |
| `CRON_SECRET` | Value required in the reminder function's `x-cron-secret` header. |
| `SUPABASE_WALL_ID` | Prayer wall theme lookup in the reminder worker. |
| `STRIPE_MODE` | `test` or `live`; defaults to `test`. |
| `STRIPE_SECRET_KEY` | Server-side Stripe key matching the selected mode. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the matching Stripe webhook endpoint. |
| `GIVING_WALL_ID` | Must match `VITE_GIVING_WALL_ID` and the database giving wall. |
| `ORG_NAME` | Organization name used in Checkout line items. |

The Edge runtime provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Every database client must use `db: { schema: 'prayer_wall' }`.

Stripe keys and Stripe JS do not belong in the frontend or `.env.local`. Supabase mode uses hosted Checkout. Test mode prevents real charges, but test payments still create normal donation records and trigger real thank-you emails: use a separate test project/wall and controlled email addresses. Live payments require explicit `STRIPE_MODE=live` and matching live credentials. See the [Stripe setup and test guide](docs/giving-wall-stripe-test-mode.md).

## Database and migrations

Application tables live in the **`prayer_wall`** Postgres schema. The current unified-wall model uses `walls.app_type` to distinguish `prayer` and `giving` records.

| Tables | Role |
| --- | --- |
| `organizations`, `walls` | Organization and wall identities. |
| `commitments`, `commitment_categories` | Prayer participants and chosen categories; paid donations also have linked commitments. |
| `message_categories`, `prayer_meditations`, `prayer_points` | Shared prayer content and personal prayer needs. |
| `email_rhythms`, `category_rhythms`, `commitment_rhythms` | Schedule definitions and assignments. |
| `wall_theme` | Per-wall presentation settings and public interface copy. |
| `email_copy` | Per-wall, admin-edited plain-text email wording overrides (migration `034`). |
| `donations` | Paid amounts in cents, currency, display name, payment references, and linked commitments. |
| `webhook_events` | Stripe event audit and processing status. |
| `email_logs` | Delivery attempts, email types, statuses, and provider message IDs. |

[`src/infrastructure/supabase/types.ts`](src/infrastructure/supabase/types.ts) is **manually maintained**. Update it whenever a migration adds a table, column, or changes a database function used by the app. Public repositories select permitted columns explicitly; for example, public commitment queries exclude email and the private separate name fields.

### Applying schema changes

Migrations are **not automatically applied**. Review the numbered SQL files in [`supabase/migrations/`](supabase/migrations/) and run the applicable files manually in the Supabase SQL Editor. After schema changes, refresh PostgREST:

```sql
NOTIFY pgrst, 'reload schema';
```

The directory contains historical alternatives and two files numbered `018`; do not treat it as a blindly replayable migration chain. In particular:

- `019_grant_service_role_schema.sql` is required for Edge Functions to access the application schema.
- `023_giving_walls_table.sql` and `027_donations_fk_giving_walls.sql` describe the historical separate-table model. The current unified-wall deployment did not use that model. Do not apply those files to it.
- `026_giving_wall_stripe.sql` adds the Stripe event audit, donation-email support, and donation Realtime publication.
- `028_fix_cron_reminders.sql` replaces the broken scheduler configuration from `012` with Vault-backed hourly calls. Create its required Vault secrets first.
- `029_walls_app_type.sql` establishes the current discriminator and refuses to run if a separate `giving_walls` table exists. Existing separate-table installations require reconciliation first.
- Apply `030_donation_commitments.sql`, `031_donation_full_name.sql`, and `032_restore_commitment_public_reads.sql` in that order for current donation persistence and public commitment reads.
- Apply `033_restrict_donation_public_reads.sql` after `024` to remove broad donation SELECT grants; **do not rerun `024` afterward**. It allows only an explicit public column projection. Run the disposable-stack API/Realtime privacy tests below to verify effective grants.
- Apply `034_email_copy.sql` for admin email editing. The table is not publicly readable, but its write policies currently trust any authenticated user; see [Security posture and remaining work](#security-posture-and-remaining-work).

The migration headers and [giving-wall setup guide](docs/giving-wall-stripe-test-mode.md) explain prerequisites and deployment order. The older [Supabase setup notes](docs/supabase-setup.md) provide background but contain historical names and scheduling examples; use the current files above for migrations and cron setup.

## Edge Functions and email

| Function | Caller and responsibility |
| --- | --- |
| `send-confirmation` | Prayer form after signup; sends confirmation and prayer-guide emails and records results. |
| `send-reminders` | Hourly scheduler; finds due category rhythms and active recipients, sends prayer reminders, and updates logs/reminder timestamps. |
| `create-donation-checkout` | Giving form through `StripeCheckoutGateway`; validates input and mode and creates a hosted Checkout Session. |
| `giving-wall-webhook` | Stripe; verifies signatures and payment state, audits events, persists donations, and requests thank-you emails. |
| `send-donation-thanks` | Webhook; sends a thank-you email and records delivery state. |
| `unsubscribe` | Opt-out endpoint supporting both products; the giving frontend uses it because browsers cannot update donation rows. |

The prayer frontend currently disables reminders through its repository; the `unsubscribe` Edge Function also supports commitment IDs for direct endpoint use.

### Editable email wording

The **Emails** tab on each admin page edits that wall's copy in `prayer_wall.email_copy`. Prayer and giving have separate wall IDs and separate overrides. Unsaved fields show “edited”; save persists differences from the shipped defaults and clears that indicator. Reset all to defaults must also be saved. Existing emails are not changed; new emails read overrides at send time. `{{name}}` and `{{amount}}` are substituted where supported; wording is plain text and HTML-escaped, not an HTML editor. Layout and logo live in `supabase/functions/_shared/email-layout.ts`; shipped defaults and field definitions live in `supabase/functions/_shared/email-copy.ts`.

Apply migration `034` and reload the PostgREST schema before using the editor. After changing shared layout or shipped defaults, redeploy **all three** email functions (`send-confirmation`, `send-reminders`, `send-donation-thanks`); deploying the frontend alone cannot change function code. Database overrides take effect for the next email without a function redeploy, provided the copy-aware function is deployed. Check Edge Function logs for `email_copy` query errors: the senders currently fall back to defaults on query failure. Donation thank-yous are one-time sends, so a saved edit does not resend an already sent receipt.

### Reminder scheduling

Migration `028` schedules `send-reminders` **hourly**, using `pg_cron` and `pg_net`. Supabase Vault must contain:

| Vault name | Value |
| --- | --- |
| `project_url` | Supabase project URL. |
| `cron_secret` | The same value as the Edge Function `CRON_SECRET`. |

The worker matches the rhythm's local **hour**, cadence, timezone, and optional end date. It does not provide minute-precision delivery. Category-to-rhythm assignments and `reminder_active` determine recipients. Use `cron.job_run_details`, `net._http_response`, `prayer_wall.email_logs`, and Edge Function logs to trace scheduling and delivery.

Automatic Bible verse lookup was **discontinued in September 2026**. The `_shared/*bible*` and `prayer-search-*` files remain dormant; provider failures return no passage, allowing reminder emails to continue. Do not configure `API_BIBLE_KEY` or `YOUVERSION_APP_KEY`.

## Deployment

### Frontend

[`railway.json`](railway.json) builds the app with `npm run build` and serves `dist/` with an SPA fallback on Railway's assigned port. Set the frontend environment variables in the hosting environment before building. The fallback is needed so direct requests to routes such as `/giving` and `/prayer/admin` resolve to the app.

For a local production preview:

```bash
npm run build
npm run preview
```

### Supabase functions

Schema changes and Edge Function releases are separate from frontend deployment. After configuring the project and secrets, deploy the needed functions with your project reference:

```bash
npx supabase functions deploy send-confirmation --project-ref YOUR_PROJECT_REF
npx supabase functions deploy send-reminders --project-ref YOUR_PROJECT_REF --no-verify-jwt
npx supabase functions deploy unsubscribe --project-ref YOUR_PROJECT_REF --no-verify-jwt
npx supabase functions deploy send-donation-thanks --project-ref YOUR_PROJECT_REF
npx supabase functions deploy giving-wall-webhook --project-ref YOUR_PROJECT_REF --no-verify-jwt
npx supabase functions deploy create-donation-checkout --project-ref YOUR_PROJECT_REF
```

The reminder function authenticates with `x-cron-secret`; the webhook authenticates with `Stripe-Signature`, so neither relies on a Supabase user JWT. The unsubscribe endpoint supports links opened without a signed-in session. Other browser-invoked functions use the configured Supabase client's credentials.

For the current checkout name flow, apply the required schema first, deploy the webhook before the checkout function, then release the frontend. Register the Stripe endpoint at `https://YOUR_PROJECT_REF.supabase.co/functions/v1/giving-wall-webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Redeploy modified functions; frontend deployment alone does not update them.

## Verification and troubleshooting

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite development server. |
| `npm run build` | TypeScript project build and production assets. |
| `npm run preview` | Preview built frontend locally. |
| `npm run lint` | Repository ESLint check. |
| `node --test tests/*.test.mjs` | Frontend/use-case regressions, including checkout naming, donation loading, and responsive layout calculations. Checkout naming tests currently expect an obsolete optional Full Name/Anonymous UI and fail on the required first/optional last name form. |
| `node --test supabase/functions/stripe-mode.test.mjs` | Stripe test/live mode guards with external services mocked. |
| `node --test supabase/functions/email-layout.test.mjs` | Email layout, copy defaults, escaping, and mocked sending; sends no emails. |
| `node --test supabase/functions/donation-persistence.test.mjs` | Donation persistence migration integration checks against disposable Postgres; requires `DONATION_TEST_CONTAINER`. |
| `node --test supabase/functions/donation-access.test.mjs` | API/Realtime donor privacy on a disposable local Supabase CLI stack; requires the `DONATION_ACCESS_TEST_*` variables below. |

There is no `npm test` script. The regression tests require installed dependencies and do not submit real payments. Responsive tests exercise the actual grid code with mocked DOM/React boundaries; they do not replace visual browser testing. Check both walls at phone, tablet, and desktop widths, resize an already-open page, and open forms in a short viewport.

The donation persistence integration test requires Docker and `DONATION_TEST_CONTAINER` set to a **fresh, disposable Postgres container with logical replication enabled**. It creates roles and applies schema changes through `docker exec`; never point it at a real project. Without that environment variable, the integration test is skipped. The API/Realtime test requires a fresh disposable local Supabase CLI stack with `prayer_wall` exposed as an API schema: set `DONATION_ACCESS_TEST_CONTAINER` to its database container, `DONATION_ACCESS_TEST_URL` to its loopback API URL, `DONATION_ACCESS_TEST_ANON_KEY` to its anon key, and `DONATION_ACCESS_TEST_JWT_SECRET` to its JWT secret. It inserts synthetic donations directly; never use production credentials.

| Symptom | Checks |
| --- | --- |
| Missing Supabase configuration | Use mock mode for public demos or set the project URL and anon key; admin requires Supabase. |
| Empty wall or permission errors | Verify wall IDs, exposed `prayer_wall` schema, grants/RLS, and applicable migrations. Confirm `032` for public commitment reads and `033` for donation privacy. |
| Email text saved but outgoing email unchanged | Confirm migration `034`, matching prayer/giving wall ID, and redeployed copy-aware email functions; inspect function logs for a failed `email_copy` read. Already sent donation receipts are not resent. |
| Payment completed but no brick | Inspect Stripe delivery, `webhook_events`, function logs, matching wall IDs/mode, and migrations `030`–`032`; verify donation Realtime. |
| Reminders do not arrive | Check migration `028`, Vault/Edge secret agreement, active category rhythms, subscription status, and scheduler/function logs. |
| Resend returns 403 | Check the verified sending domain and matching `FROM_EMAIL`. |
| Texture or logo is missing | Match `VITE_ASSETS_BUCKET`, Storage policies, and the appropriate prayer/giving asset folders. |
| ESLint fails loading `reactHooks.configs.flat.recommended` | The current ESLint configuration expects an export missing from the installed React Hooks plugin. This is a tooling configuration issue; a passing build does not mean lint passed. |

## Security posture and remaining work

**Do not treat the current deployment as security-audited.** This section describes code and migrations in this repository, not independently verified production permissions, secrets, rate limits, or compliance status. The anon key and every `VITE_*` setting are public browser configuration; never use frontend email checks as authorization. Keep service-role, Resend, and Stripe secrets only in server-side secret stores. Use separate test and live projects and rotate exposed credentials.

Implemented safeguards include Stripe-hosted Checkout (no app-owned card entry in Supabase mode), raw-body webhook signature and timestamp checks, paid-session/wall/mode validation, and idempotent donation recording. Migration `033` is intended to restrict browser donation reads to an explicit public projection, and email templates escape untrusted text. Verify the actual deployed policies and Realtime payloads with disposable-stack tests before relying on them; a code review alone does not prove production migration state.

**Known gaps to address before claiming admin or email security:**

- **Admin authorization (high priority):** `AdminAuthGuard` checks `VITE_ADMIN_EMAIL` only in the browser. `034_email_copy.sql`, as well as existing admin table and Storage policies, grant access to *any* authenticated Supabase user; `webhook_events` raw Stripe payloads are also readable by authenticated users. Enforce an admin role/allowlist in server-side RLS and Storage policies and review grants for all admin tables. Restrict account creation and access operationally in the meantime; a UI-only change is insufficient.
- **Email invocation (high priority):** `send-donation-thanks` checks UUID format but not that its caller is the webhook/service role. JWT verification alone may accept a public anon token. `send-confirmation` can be invoked for an existing commitment without owner authorization and has no resend/rate limit. Add function-level caller authorization and abuse controls while preserving the intended signup flow.
- **Donation opt-out:** `send-donation-thanks` checks `thank_you_sent` but not `email_opt_out`; an unsent donation that has opted out can still receive a thank-you on invocation. Enforce the flag before sending and test this path.
- **Public data and retention:** Migration `033` intentionally makes `processor_ref` and `email_opt_out` publicly readable. Decide whether these belong on the public API; if not, publish a narrower corrective migration and align browser projections and privacy tests. Webhook auditing retains raw signed Stripe events (which can contain donor details); set an access/retention policy.
- **Operations:** Check effective anon/authenticated/service-role database grants, Storage policies, Edge Function JWT settings, function logs, and any project-side abuse/rate limits in the actual environment. Do not infer them from migration filenames. Mock checkout must not be enabled on a public production build. Hosted Checkout reduces card-handling scope but does not establish PCI compliance.

## Repository guide

```text
src/
  domain/                 Entities, interfaces, and errors
  application/            Use cases and DTOs
  infrastructure/         Supabase adapters, mocks, gateways, theme, container
  presentation/
    components/           Shared wall, form, and admin-auth components
    hooks/                Data loading, Realtime, theme, responsive layout
    pages/                Public routes and administration
    context/              AppProvider and useContainer
supabase/
  functions/              Deno Edge Functions, shared helpers, regression tests
  migrations/             Manually applied SQL changes
public/                   Bundled fonts and textures
tests/                    Frontend and use-case regression tests
docs/                     Setup guides, decisions, and historical design notes
```

When adding a repository, provide both mock and Supabase implementations and wire both branches of `container.ts`. Never place a mock repository in its production branch. Use **Stonemasons** in prayer admin UI, **stones/foundation** in public prayer copy, and **Bricklayers** only for the Giving Wall. Follow [AGENTS.md](AGENTS.md) for repository-specific rules.

Further reading:

- [Clean architecture decision](docs/decisions/001-clean-architecture.md)
- [Application schema decision](docs/decisions/002-prayer-wall-schema.md)
- [Mock versus Supabase repository wiring](docs/decisions/003-mock-vs-supabase-repos.md)
- [Giving Wall architecture history and amendments](docs/decisions/004-giving-wall-architecture.md)
- [Stripe setup, rollout, and test procedure](docs/giving-wall-stripe-test-mode.md)
- [Unified-wall migration background](docs/future_enhancements/001-unified-walls-table.md)
- [Confirmation email implementation notes](docs/email-confirmation-implementation.md)

Some older design documents describe proposed behavior rather than the current implementation. Use the source code, applicable migration headers, and this README together when operating or extending the app.
