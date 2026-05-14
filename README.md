# Prayer Wall

Prayer Wall is a React + TypeScript app built with Vite. It supports running against Supabase **or** in a fully in-memory **mock mode** for local development.

## Prerequisites

- Node.js (LTS recommended)
- npm

## Quick start (mock mode — no Supabase required)

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Create your local env file:

   - Copy `.env.example` to `.env.local`
   - Set `VITE_USE_MOCK=true`

3. Start the dev server:

   ```bash
   npm run dev
   ```

4. Open the URL printed by Vite (usually `http://localhost:5173`).

## Running with Supabase

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env.local` and set:

- `VITE_USE_MOCK=false`
- `VITE_SUPABASE_URL` (your Supabase project URL)
- `VITE_SUPABASE_ANON_KEY` (your anon key)
- `VITE_ORG_ID` (UUID)
- `VITE_WALL_ID` (UUID)
- `VITE_ORG_NAME` (optional display name)

3. Start the dev server:

   ```bash
   npm run dev
   ```

Supabase setup notes live in:

- `docs/supabase-setup.md`
- `docs/architecture.md`

## Environment variables

This app uses Vite env vars (must be prefixed with `VITE_`). See `.env.example` for the canonical list.

- `VITE_USE_MOCK`
  - `true`: runs entirely without Supabase (all data in-memory)
  - `false`: requires Supabase env vars below
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (required when not in mock mode)
- `VITE_ORG_ID` / `VITE_WALL_ID` (used to scope wall + categories)
- `VITE_ORG_NAME` (optional)

## Scripts

- `npm run dev` — start Vite dev server
- `npm run build` — typecheck + production build
- `npm run preview` — preview the production build locally
- `npm run lint` — run ESLint

## Deployment

This repo includes `railway.json` for Railway deployment. For Supabase Edge Functions and schema migrations, see the `supabase/` directory.
