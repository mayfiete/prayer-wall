# Prayer Wall — Modern Redesign Spec
**Date:** 2026-03-29
**Status:** Approved

## Summary

Modernise the prayer-wall app's look and feel to match the Heritage Christian Academy (HCA) brand at hcafredericksburg.org. The app lives inside the HCA website. Design inspiration drawn from DonorPerfect's fundraising SaaS and HCA's own design system. All existing functionality (stone/brick tile modes, realtime updates, commitment form, unsubscribe flow) is preserved — this is a pure visual update.

---

## Brand Tokens

All values sourced directly from hcafredericksburg.org.

| Token | Value | Usage |
|---|---|---|
| `primary` | `#5E071F` | Header gradient start, buttons, section headings, borders |
| `primary-hover` | `#A0193E` | Button hover, header gradient end |
| `navy` | `#252148` | Mock banner background, breadcrumb strong text |
| `amber` | `#FFBC7D` | Header bottom rule, toggle active, tile pulse glow, cross accent |
| `surface` | `#FFFFFF` | Card backgrounds |
| `page-bg` | `#F3F5F3` | Page background |
| `card-border` | `#F0E6E0` | Card borders |
| `body-muted` | `#7A6A5A` | Descriptive/body text |

---

## Typography

| Role | Font | Weight | Notes |
|---|---|---|---|
| Headings / UI labels / buttons | **Poppins** | 600–700 | Replaces Playfair Display for page chrome |
| Body / descriptive text | **EB Garamond** | 400 / italic | Already on HCA site; kept in project |
| Tile names | Poppins | 700 | `clamp(15px, 2.8vw, 22px)`, heavy text-shadow for texture contrast |

Replace `index.css` Google Fonts import: add Poppins 400/500/600/700; keep EB Garamond.
Update `tailwind.config.js` `fontFamily.serif` to lead with Poppins for UI, keep EB Garamond as `fontFamily.body`.

---

## Page Chrome (all pages)

### Mock Banner
- Background `#252148`, text `#FFBC7D`, Poppins 11px 600, uppercase.

### Breadcrumb
- White bar, 1px bottom border `#E5DDD7`, maroon link `#5E071F`.

### Page Header
- Gradient: `linear-gradient(135deg, #5E071F 0%, #7C1A2E 60%, #A0193E 100%)`.
- 3px amber bottom rule: `linear-gradient(90deg, #FFBC7D, #F59E0B, #FFBC7D)`.
- **Logo mark**: 80×80px circle, `rgba(255,255,255,0.13)` fill, amber border. Contains a white SVG Latin cross (32×32 viewBox, vertical bar 6px wide, horizontal bar 6px wide) with a subtle amber highlight stripe. Cross is clearly discernible at all sizes.
- Church name subtitle in EB Garamond italic.
- Stone/Brick toggle pill: dark translucent pill, amber active tab.

### Cards
- `background: white`, `border-radius: 12px`, `border: 1px solid #F0E6E0`, `box-shadow: 0 1px 6px rgba(94,7,31,0.08)`.

### Buttons (primary)
- `background: #5E071F`, `border: 2px solid #5E071F`, `color: white`.
- `border-radius: 8px`, Poppins 700, `text-transform: uppercase`, `letter-spacing: 0.6px`.
- Hover: `background: #A0193E`, `border-color: #A0193E`.
- Matches HCA site button style exactly.

---

## Tile System

### Filled Tiles (claimed names)

**Stone mode:**
- `background-image: url('/textures/stone.jpg')`, `background-size: cover`, `background-position: center`.
- `border: 2px solid #5A5A5A`.
- Overlay: `inset 0 0 0 9999px rgba(25,20,18,0.40)` — darkens slate so text is legible while texture shows through.
- Inset shadows for depth.

**Brick mode:**
- `background-image: url('/textures/brick.jpg')`, `background-size: cover`, `background-position: center`.
- `border: 2px solid #5A2C18`.
- Overlay: `inset 0 0 0 9999px rgba(35,8,0,0.42)`.

**Content on filled tiles (both modes):**
- SVG Latin cross icon (22×22px): white bars with amber highlight stripe, `filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6))`. Replaces the old `✦` star.
- Name text: Poppins 700, `clamp(15px, 2.8vw, 22px)`, white, `text-shadow: 0 1px 3px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.7)`.
- Name split across two lines (first name / last name) as before.

### Empty Tiles (unclaimed)

**Both modes:**
- `background-image: url('/textures/prayer_hands.jpg')`, `background-size: cover`, `background-position: center 65%` — positions the bronze sculptural hands (lower portion of photo) into the tile frame.
- `border: 2px solid #C0B090` (stone) / `#C0A080` (brick) — warm neutral, distinct from filled tiles.
- **No colour overlay** — the photo shows exactly as shot (bronze hands on cream).
- `cursor: pointer`.
- Hover: `translateY(-2px)`, border becomes `#FFBC7D`, amber glow ring `0 0 0 2px rgba(255,188,125,0.5)`.
- First empty tile: amber pulse animation (box-shadow ring pulses 0→5px at 50% of 2.2s cycle).
- No text or icon — the photo is the affordance.

### Material-change animation
Keep existing `material-change` keyframe (brightness flash) on `.tiles-changing .tile-base` when toggling modes.

---

## Commitment Modal & Form

- Modal backdrop: `bg-black/70 backdrop-blur-sm` (unchanged).
- Modal panel: white, `border-radius: 14px`, maroon gradient header (`#5E071F → #7C1A2E`), white Poppins title, ✕ close button.
- Field labels: Poppins 11px 700, `#5E071F`, uppercase, `letter-spacing: 0.4px`.
- Inputs: `background: #FDFAF8`, `border: 1.5px solid #E5DDD7`, `border-radius: 7px`.
- Category chips: maroon fill + white text (active); white + `#E5DDD7` border (inactive).
- Submit button: full-width primary button style.
- Success state: keep `CheckCircle2` icon, swap amber-500 → `#FFBC7D`, update text colours to maroon.

---

## Unsubscribe Page

Replace the current `bg-stone-950` dark theme with the light brand theme:
- Page background `#F3F5F3`, card white.
- Success icon colour `#FFBC7D` (amber).
- Headings `#5E071F`, body text `#7A6A5A`.
- Buttons use primary style.

---

## Files to Change

| File | Change |
|---|---|
| `src/index.css` | Replace Google Fonts import (add Poppins); update CSS custom props and component classes |
| `tailwind.config.js` | Add Poppins to fontFamily; update colour palette with HCA tokens |
| `src/presentation/pages/WallPage.tsx` | New header, breadcrumb, card layout, `LogoMark` → SVG cross |
| `src/presentation/pages/CommitmentPage.tsx` | Match header style; grid unchanged |
| `src/presentation/pages/UnsubscribePage.tsx` | Light theme replacing dark stone theme |
| `src/presentation/components/PrayerBrick.tsx` | SVG cross on filled tiles; prayer_hands.jpg on empty tiles |
| `src/presentation/components/ui/Button.tsx` | HCA button tokens |
| `src/presentation/components/ui/Modal.tsx` | Maroon gradient header, light panel |
| `src/presentation/components/ui/Input.tsx` | Parchment bg, maroon labels |
| `src/presentation/components/CategorySelector.tsx` | Maroon active chip style |
| `src/presentation/components/MockBanner.tsx` | Navy bg, amber text |

---

## Cleanup

- `src/presentation/components/PrayerHandsIcon.tsx` — currently renders an SVG icon on empty tiles. Remove once `PrayerBrick.tsx` uses the photo background; remove the `prayer-hands-icon` CSS class from `index.css`.

---

## Out of Scope

- No changes to routing, data fetching, realtime logic, or domain/application layers.
- No new features or pages.
- Tile grid columns and breakpoints unchanged (`grid-cols-4 sm:grid-cols-6 md:grid-cols-8`).
