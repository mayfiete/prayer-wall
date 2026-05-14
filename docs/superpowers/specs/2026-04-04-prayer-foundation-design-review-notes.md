# Prayer Foundation / Prayer Wall — Design Review Notes & Redesign Plan

**Date:** 2026-04-04  
**Source:** Design review meeting notes (HCA Fredericksburg + Daily Raiser) on 2026-04-03  
**Status:** Pending implementation (Prayer Foundation approved; Giving Wall blocked)

This document consolidates:
- The approved visual redesign spec (2026-03-29)
- The 2026-04-03 design review outcomes
- Recommended, implementable changes to match the approved Prayer Foundation experience
- The Giving Wall “veneer” workaround plan
- Email cadence + confirmation requirements
- Admin portal requirements and deployment guidance

---

## 1) Executive Summary

### Approved: Prayer Foundation (this app)
Prayer Foundation is approved as a fully-custom app experience: **a wall of stones** that **starts blank** and **builds one stone at a time** as users commit.

### Blocked: Giving Wall (Daily Raiser)
The Giving Wall (Daily Raiser) cannot be customized due to a product strategy change. This breaks the original two-part “building narrative” (foundation stones → bricks).

### Required decision
Proceed with:
- **Cohesive visuals** but **non-interactive giving** (static Giving Wall veneer), OR
- Re-evaluate the overall strategy.

---

## 2) Product Narrative & Naming

Original vision is a two-part interactive experience:
- **Prayer Foundation:** stones → spiritual foundation
- **Giving Wall:** bricks → structure built on foundation

Given the Giving Wall restriction, the recommended path is:
- Keep Prayer Foundation as the primary interactive experience.
- Present Giving Wall as a “visual continuation” via a static veneer.

---

## 3) Prayer Foundation — UX Requirements (Approved)

### 3.1 Wall behavior: blank → grows one stone at a time
**Goal:** the wall should feel like it is *being built*, not like a pre-made grid of empty spots.

**Recommended behavior:**
- Wall renders **all claimed stones**.
- Wall renders **exactly one interactive “next available” stone**.
- Wall does **not** show a large number of additional empty stones.

This matches:
- “Wall Build: Starts blank and builds one stone at a time as users commit.”
- “Unclaimed Spots: The next available stone will be interactive for new commitments.”

### 3.2 CTA: the next stone *is* the CTA
Replace separate CTA sections (“Add your name…”) with:
- The **first / next available** stone acting as the CTA (“Place your stone”).

This matches:
- “Set first brick as ‘Place your brick’ CTA; then implement claimed-only wall.”

### 3.3 Claimed-only wall
The wall should be effectively “claimed-only”:
- Users see claimed stones and the single “place your stone” spot.
- Once claimed, it becomes a normal claimed stone.

### 3.4 Commitment entry point
When users click the “Place your stone” spot:
- Open the commitment modal/form.

Keep the existing modal/form interaction model unless HCA requests a different UX.

---

## 4) Prayer Foundation — Visual Requirements (Approved)

### 4.1 Stone assets (custom)
HCA will provide custom stone assets:
- **Single, staggered, rounded stones** (cobblestone style)
- **Inscribed names**
- File size: **<= 15 MB** per asset bundle

Implementation implications:
- Prefer **multiple stone variants** (3–8) to avoid obvious repetition.
- Use transparent PNG/WebP stones when possible so the background can be controlled.

### 4.2 Staggered stones (layout)
Stones should read like cobblestones, not perfect squares.

Recommended approach:
- Keep responsive grid for simplicity, but apply a **stagger offset** to alternating rows (or indices).
- Allow slightly larger spacing than “brick mortar” spacing.

### 4.3 Inscribed names vs placards
The 2026-03-29 redesign spec introduced a **brass placard** style.

For Prayer Foundation stones, design review notes explicitly call for:
- **Inscribed/engraved names** on stones.

Recommendation:
- Stone mode: engraved text treatment (inset shadow + highlight).
- Brick mode (if retained anywhere): placard treatment.

### 4.4 Toggle: stones vs bricks
Design review notes imply Prayer Foundation is stones-first.

Decision options:
- **Option A (recommended):** Prayer Foundation becomes stones-only; remove or hide brick mode.
- Option B: Keep the toggle for internal/testing, but default to stones and avoid mixing the story.

---

## 5) Commitment Form — Copy & Behavior Changes

### 5.1 Copy updates
Current UI copy references “weekly reminders.” This must change.

Required changes:
- Confirmation text: “You will receive **monthly** prayer reminders…”

### 5.2 Immediate confirmation email (required)
Add an **immediate confirmation email** upon sign-up.

Email content requirements:
- Confirms the user’s name was placed
- Sets expectation: monthly reminders (not weekly)
- Includes unsubscribe link

---

## 6) Email System — Cadence & Content

### 6.1 Reminder cadence
- Change from weekly to **monthly**.

### 6.2 Newsletter content workflow
- Ivy will provide monthly prayer-donor newsletter copy
- Ivy will provide quarterly praise report copy
- Terry sends/distributes

Implementation suggestion:
- Store monthly/quarterly copy as editable content blocks in the admin portal.

---

## 7) Admin Portal — Requirements

### 7.1 Purpose
A dedicated portal for HCA staff to manage:
- Text content (newsletter/praise report)
- Assets (stone/brick images)
- Prayer categories

### 7.2 Features (minimum scope)
- **Drag-and-drop** content updates (practically: reorderable blocks + editable text fields)
- **Asset uploads** (stone variants, brick wall veneer image)
- **Prayer category management** (create, rename, enable/disable, reorder)

### 7.3 App separation
Recommendation: **separate admin app** (separate frontend) to avoid shipping admin UI in the public bundle.

Update per latest decision:
- Admin URL will be **public**, but must be gated by authentication/authorization.

### 7.4 Security model
- Supabase Auth for staff login
- Strict RLS policies so only staff can write admin-managed tables

---

## 8) Giving Wall — Blocked, Veneer Workaround

### 8.1 Constraint
Daily Raiser Giving Wall is not customizable.

### 8.2 Workaround concept
- A **static custom image** that looks like the Giving Wall
- Users click through to the **standard Daily Raiser giving form**
- After gifts, HCA staff manually update the image

### 8.3 Practical implementation options
- **Simplest:** Admin uploads a new wall image after editing names in Canva/Photoshop.
- **More advanced:** Admin enters names in the portal and the system generates a new image (canvas render) for publishing.

Trade-off:
- Cohesive visuals but no interactive “claiming” in the giving flow.

---

## 9) Deployment & Testing Notes

### 9.1 Deploy Prayer Foundation; send link to Ivy
Once the wall changes are implemented:
- Deploy
- Send link to Ivy for UX testing

### 9.2 Known code/schema alignment risk
Before deploying any email/edge function changes, verify table/schema names.

This repo’s SQL migration creates tables under the `prayer_wall` schema, such as:
- `prayer_wall.commitments`
- `prayer_wall.email_logs`

However, the current Edge Function code references different names (e.g., `prayer_commitments`, `email_logs`, `church_id`).

Action:
- Align Edge Functions with the actual schema, or update schema to match the functions.

---

## 10) Action Items (from meeting)

### Terry
- Deploy Prayer Foundation; send link to Ivy; then Ivy tests UX
- Add immediate confirmation email to Prayer Foundation signup flow
- Implement drag-and-drop admin for Prayer Foundation content
- Set first brick/stone as CTA; implement claimed-only wall
- Implement brick placards and stone inscriptions
- Send updated Giving Wall veneer example (single brick) to Ivy
- Update recurring meeting to Thu 2:30 with Ivy

### Ivy
- Send monthly prayer-donor newsletter copy
- Send quarterly praise report copy
- Send stone/brick assets (<=15 MB)

---

## 11) Open Questions

1) Prayer Foundation: stones-only, or keep brick toggle?
2) Giving Wall veneer: image-only upload, or admin-driven name layout/render?
3) Admin portal: what staff roles exist (1 admin vs multiple) and what permissions are needed?
