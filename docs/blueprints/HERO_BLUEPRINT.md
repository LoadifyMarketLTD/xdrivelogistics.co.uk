# Blueprint #1 — Hero Section

> **Status: AWAITING APPROVAL**
>
> No React code. No CSS changes. No homepage implementation.
> Implementation begins only after this blueprint is approved.

---

## 1. Purpose

The Hero section is the first and most important section of the homepage. Its job is to communicate, in under 3 seconds, that XDrive is a professional logistics management platform for transport operators — and to compel a qualified visitor to scroll further or take direct action.

The Hero does not explain the platform. It earns the right to explain it. It creates recognition and confidence immediately.

---

## 2. Emotional Objective

Target state after the visitor sees the Hero:

> *"This is a serious platform built for businesses like mine. It looks more capable than anything I've used before. I need to know more."*

The Hero must produce: **Recognition** (this is for me) + **Confidence** (this is premium and real).

It must NOT feel like a generic SaaS landing page, a logistics directory, or a consumer app.

---

## 3. Layout at 1920px Desktop

**Overall structure:** Full-viewport-height section (`100dvh`), dark background (`--xd-bg-primary: #070B14`), centred content container at `--xd-container-safe: 1320px`.

**Two-column split layout — 55% / 45%:**

```
┌─────────────────────────────────────────────────────────────────┐
│  NAV (full width, transparent over hero)                        │
├───────────────────────────────────┬─────────────────────────────┤
│  LEFT COLUMN  55%                 │  RIGHT COLUMN  45%          │
│  (vertical centre-aligned)        │  (vertical centre-aligned)  │
│                                   │                             │
│  [Eyebrow badge]                  │  [Product screenshot frame] │
│                                   │                             │
│  H1 Headline                      │  Dashboard screenshot #1    │
│  (3 lines max)                    │  with soft glow border      │
│                                   │  and subtle depth shadow    │
│  Subheadline                      │                             │
│  (2 lines max)                    │  Floating mini-badge        │
│                                   │  (live metric: e.g.         │
│  [Primary CTA] [Secondary CTA]    │  "47 jobs dispatched today")│
│                                   │                             │
│  Trust bar — 4 live stats         │                             │
│                                   │                             │
└───────────────────────────────────┴─────────────────────────────┘
│  Section gradient fade → next section                           │
└─────────────────────────────────────────────────────────────────┘
```

**Vertical rhythm:**
- Top padding: `--xd-section-py-hero` (160px) from top of content area (below nav)
- Bottom padding: 120px to gradient fade
- Gap between left and right columns: `--xd-grid-gap × 4` = ~96px
- Gap between eyebrow → headline: 16px
- Gap between headline → subheadline: 24px
- Gap between subheadline → CTAs: 40px
- Gap between CTAs → trust bar: 56px

**Background treatment:**
- Base: `--xd-bg-primary` (#070B14)
- Radial glow behind the right-column screenshot: `rgba(47, 107, 255, 0.07)` centred at the screenshot, radius ~600px. Subtle only — never garish.
- Subtle noise texture overlay at 3% opacity for depth.
- Bottom of section fades to `--xd-bg-secondary` via a `linear-gradient` mask (80px tall) to transition into the next section.

---

## 4. Headline

**`<h1>` — primary headline**

> **"Your logistics operation,  
> under complete control."**

Rules:
- Two-line break is intentional — controlled at desktop width
- Font: `--xd-font-family` (Inter), `--xd-h1-size` (72px), weight `--xd-h1-weight` (700)
- Colour: `--xd-text-dark-primary` (#F3F7FF)
- Letter-spacing: `-0.02em` (tighten at display size)
- Line-height: `--xd-h1-line` (80px)
- Max-width: 640px (constrains to left column, never wraps to 4 lines)
- No gradient text. No outlined text. Plain white-on-dark, premium.

**Alternative headline options (for approval consideration):**

1. "Every job. Every driver. One platform." *(shorter, more rhythmic)*
2. "The platform serious transport companies rely on." *(authority-led)*
3. "Run your fleet. Own your workflow." *(action-led)*

Primary recommendation: **Option 1 above** — clarity over cleverness.

---

## 5. Subheadline

> "XDrive gives transport operators, company admins, and drivers a single platform to manage jobs, routes, documents, and invoices — from dispatch to delivery."

Rules:
- Font: Inter, `--xd-body-l-size` (20px), weight 400
- Colour: `--xd-text-dark-secondary` (#A9B7D0)
- Line-height: `--xd-body-l-line` (32px)
- Max-width: 560px
- Max 2 lines at desktop — if it wraps to 3, shorten copy
- No bold within the subheadline. The headline is bold; this is the calm explanation.

---

## 6. CTA Hierarchy

**Two CTAs side-by-side, left-aligned:**

**Primary CTA — "Request Access"**
- Style: Filled button, `--xd-blue` (#2F6BFF) background, white label
- Size: Height 52px, horizontal padding 28px
- Font: `--xd-btn-size` (16px), weight 600
- Border-radius: `--xd-radius-md` (12px)
- Hover: `--xd-blue-hover` (#2557D6), slight lift `translateY(-1px)`
- This CTA leads to the company registration / onboarding entry point

**Secondary CTA — "See how it works"**
- Style: Ghost/text button — no fill, no border. White label with an arrow icon (→, lucide `ArrowRight`, 16px)
- Size: Height 52px, left-aligned to match primary
- Font: 16px weight 500, `--xd-text-dark-secondary`
- Hover: `--xd-text-dark-primary` (brighter), arrow moves 4px right on hover
- This CTA anchors-scrolls to the Workflow section

**CTA rules:**
- No third CTA. Two maximum in the hero.
- Primary is always visually dominant. Do not equalise their weight.
- No "Start Free Trial" or "Sign Up" language — XDrive uses an approval-gated onboarding flow. "Request Access" reflects the real product flow.

---

## 7. Trust / Status Badges

**Eyebrow badge (above headline):**
- Small pill label: `"Trusted by UK transport operators"`
- Style: Dark pill, border `1px solid --xd-border-dark`, background `--xd-bg-tertiary`, text `--xd-text-dark-secondary` at `--xd-label-size` (12px), tracking `--xd-label-tracking` (0.08em), uppercase
- Green status dot (6px, `--xd-success`) on left side of pill — signals "live platform"

**Trust bar (below CTAs):**
Four live stats in a horizontal row, separated by `1px` vertical dividers (`--xd-border-dark`):

| Stat | Label |
|---|---|
| Live company count (from Supabase) | Active companies |
| Live driver count | Drivers on platform |
| Live delivered jobs (rolling 30d) | Jobs delivered |
| Live paid invoices GBP (rolling) | Invoiced & paid |

- Layout: horizontal flex row, gap `--xd-sp-8` (32px) between items
- Each stat: number in `--xd-h4-size` (30px), weight 700, `--xd-text-dark-primary`; label in `--xd-caption-size` (14px), weight 500, `--xd-text-dark-secondary`, below the number
- If live data is unavailable, stats are hidden entirely — no fake numbers, no placeholder zeros
- No animated count-up effect on first load (respects reduced-motion, avoids distraction from headline)

**Floating metric badge (on the screenshot):**
- A small floating card overlaid bottom-left of the screenshot
- Shows one live stat: e.g. `"47 jobs active right now"` or `"Last delivery: 4 min ago"`
- Style: `--xd-bg-tertiary` background, `--xd-shadow-card`, rounded `--xd-radius-md`, padding `--xd-card-p-sm`
- Green pulse dot (6px) + label in `--xd-caption-size`, text `--xd-text-dark-primary`
- Signals that the platform is real and active, not a demo

---

## 8. Product Visual Direction

The right column shows **a single, premium screenshot** of the XDrive platform — the most visually impressive view that demonstrates real operational capability at a glance.

**Recommended view:** The **Dispatcher Dashboard** or **Job Management board** — a dense, data-rich view showing multiple active jobs with driver assignments, statuses, and timestamps.

**Why this view, not the hero / onboarding screen:**
- Data-rich UI visually signals capability more than a welcome screen
- The dispatcher view is the operational core — it's what the buyer (fleet manager, company owner) uses daily
- It differentiates XDrive immediately from a simple load board or form-based app

**Screenshot treatment:**
- Screenshot sits inside a dark rounded frame (`--xd-radius-xl`, 18px), bordered `1px solid --xd-border-dark`
- Shadow: `--xd-shadow-screenshot`
- Blue glow: `--xd-shadow-glow-blue` applied subtly
- Served at 2x retina resolution as WebP via `next/image`
- Subtle top bar (3 dots — macOS-style traffic lights) to signal "real software on a real screen"
- Fills ~90% of right column width at desktop (~540px display width)
- Slight rotation: `rotateY(-3deg) rotateX(1deg)` CSS 3D transform — very slight perspective tilt. Must be flat for `prefers-reduced-motion`.

---

## 9. Image / Screenshot Requirements

**Primary screenshot asset:**

| Property | Requirement |
|---|---|
| View | Dispatcher job board or equivalent dense operational UI |
| Export dimensions | 1200×860px at 2x (2400×1720px source) |
| Format | WebP (compressed), fallback PNG |
| Max file size | 180KB WebP |
| Data shown | Real UK job data: real addresses, GBP amounts, real driver names (not placeholder) |
| UI state | Logged-in, active session, no empty states, no error states |
| Browser chrome | Hidden — screenshot is of the app UI only, not the browser window |

**Floating badge asset:**

| Property | Requirement |
|---|---|
| Type | Live data rendered in DOM (not a screenshot) |
| Design | Small card component, not an image |

**Background:**
No photographic background image in the hero. Background is CSS-only (`--xd-bg-primary` + radial glow + noise texture). Ensures fast load and no layout shift.

---

## 10. Motion Behaviour

**On page load — coordinated entrance in three phases:**

1. **Phase 1 (0–300ms):** Left column content fades in and rises 16px → 0 (`opacity: 0→1`, `translateY(16px→0)`, `ease-out`)
2. **Phase 2 (150–500ms, overlapping):** Right column screenshot fades in and rises 24px → 0 (same easing, slight delay)
3. **Phase 3 (400–700ms):** Floating badge on screenshot fades in separately

**Scroll parallax:** None. No parallax on screenshot or content.

**CTA hover states:**
- Primary CTA: `translateY(-1px)`, 150ms `ease-out`
- Secondary CTA: arrow moves `translateX(4px)`, 150ms `ease-out`

**Screenshot hover:** `translateY(-4px)` + `--xd-shadow-card-hover`, 200ms ease.

**`prefers-reduced-motion`:** All transforms and animations disabled. Elements appear at final position instantly.

---

## 11. Responsive Notes

Desktop-first at 1920px. Responsive behaviour noted for completeness only.

| Breakpoint | Layout change |
|---|---|
| 1440px | Container stays `1320px` wide, columns compress proportionally. Screenshot scales down. |
| 1280px | Left/right column gap reduces to 64px. Screenshot scales to ~480px wide. |
| 1024px (tablet) | Stack to single column. Screenshot moves below the copy. Screenshot width: 100% of column. Trust bar becomes 2×2 grid. |
| 768px | Headline scales to `--xd-h2-size` (56px). Subheadline to `--xd-body-m-size` (18px). |
| 375px (mobile) | Headline scales to 36px / weight 700. CTA buttons stack vertically, full-width. Screenshot shown but clipped to top ~60% height. Trust bar stacks to 2-col. Floating badge hidden. |

**Mobile critical rule:** Primary CTA must be visible above the fold on 375×812 without scrolling.

---

## 12. Acceptance Criteria

Implementation is complete and ready for approval when ALL of the following are true:

**Visual:**
- [ ] Background is `--xd-bg-primary` with radial glow and noise texture
- [ ] Two-column layout renders correctly at 1920, 1440, 1280px
- [ ] Headline is 72px Inter 700, correct colour, max 2 lines at 1280px+
- [ ] Subheadline is 20px Inter 400, secondary colour, max 2 lines
- [ ] Primary CTA is `--xd-blue` filled, secondary CTA is ghost with arrow
- [ ] Eyebrow badge renders above headline
- [ ] Trust bar shows live data or is hidden (no fake numbers)
- [ ] Screenshot is inside the correct frame (rounded, bordered, shadow + glow)
- [ ] Floating badge appears on screenshot (live data or hidden)
- [ ] Screenshot has the very slight 3D perspective tilt

**Technical:**
- [ ] Screenshot served via `next/image` as WebP, with `priority` prop
- [ ] Screenshot file size ≤ 180KB
- [ ] No layout shift (CLS = 0) — `width`/`height` defined on `<Image />`
- [ ] No `<img>` tags — only `next/image`

**Motion:**
- [ ] Load animation plays on first render (phase 1 + 2 + 3 timing)
- [ ] `prefers-reduced-motion` disables all transforms
- [ ] CTA hover states work
- [ ] Screenshot hover lift works

**Accessibility:**
- [ ] `<section>` has `aria-label="Hero"`
- [ ] `<h1>` is the only `<h1>` on the page
- [ ] Screenshot `<Image />` has descriptive `alt` text
- [ ] Primary CTA focus ring is visible, high-contrast
- [ ] All text passes 4.5:1 contrast ratio against background
- [ ] Keyboard navigation reaches both CTAs

**Responsive:**
- [ ] Single-column stack layout at 1024px and below
- [ ] Primary CTA visible above fold on 375px mobile
- [ ] Floating badge hidden on mobile
- [ ] Hero height does not exceed `100dvh` on any breakpoint

**Lighthouse (desktop):**
- [ ] Performance ≥ 90
- [ ] Accessibility ≥ 95
- [ ] LCP (the hero screenshot) ≤ 2.5s

---

## Approval

- [ ] **Hero blueprint approved — implementation may begin**
