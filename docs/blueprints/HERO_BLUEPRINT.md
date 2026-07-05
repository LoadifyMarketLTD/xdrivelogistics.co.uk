# Blueprint #1 — Hero Section (Revised)

> **Status: AWAITING APPROVAL — Revision 2**
>
> No React code. No CSS changes. No homepage implementation.
> Implementation begins only after this blueprint is approved.
>
> **Revision 2 changes from Revision 1:**
> - §4 Headline strengthened to communicate XDrive's unique operational value
> - §7 Trust indicators replaced with permanent Early Access indicators (no live numbers)
> - §8 Product visual replaced with Hero Product Composition (full ecosystem)
> - §9 Image requirements updated for multi-panel composition
> - §3 Layout diagram updated for composition visual
> - §3 (new) Hero Background specification added
> - §6 (new) Navigation specification added
> - §13 (new) Hero Success Metrics added
> - Floating live-number badge replaced with truthful Workflow Status badge

---

## 1. Purpose

The Hero section is the first and most important section of the homepage. Its job is to communicate, in under 5 seconds, that XDrive is a complete logistics operating system — not a simple load board, not a form tool, not another SaaS dashboard — and to compel a qualified transport operator to request access or scroll to understand more.

The Hero does not explain the platform. It proves it exists and works. It creates immediate recognition, confidence, and desire.

---

## 2. Emotional Objective

Target state after the visitor sees the Hero:

> *"This was built specifically for operations like mine. It handles everything from marketplace to proof of delivery to invoicing — in one place. I haven't seen anything like this before. I need to get access."*

The Hero must produce, in sequence:
1. **Recognition** — "This is for transport operators, not generic users"
2. **Scope** — "This covers the entire workflow, not just one part"
3. **Confidence** — "This is a real, complete platform — not a prototype"
4. **Desire** — "I want my operation running on this"

It must NOT feel like a generic SaaS landing page, a load board, a courier directory, or a consumer logistics app.

---

## 3. Layout at 1920px Desktop

**Overall structure:** Full-viewport-height section (`100dvh`), dark background (`--xd-bg-primary: #070B14`), centred content container at `--xd-container-safe: 1320px`.

**Two-column split layout — 50% / 50%:**

```
┌────────────────────────────────────────────────────────────────────┐
│  NAV: Logo left │ Links centre │ "Request Access" CTA right        │
│  (transparent background, border-bottom on scroll)                 │
├──────────────────────────────────┬─────────────────────────────────┤
│  LEFT COLUMN  50%                │  RIGHT COLUMN  50%              │
│  (vertical centre-aligned)       │  (vertical centre-aligned)      │
│                                  │                                 │
│  [Eyebrow badge]                 │  [Hero Product Composition]     │
│                                  │                                 │
│  H1 Headline                     │  ┌──────────────────────────┐  │
│  (2 lines max)                   │  │  PRIMARY: Dispatch board │  │
│                                  │  │  (large, prominent)      │  │
│  Subheadline                     │  └──────────────────────────┘  │
│  (2 lines max)                   │   ┌─────┐ ┌─────┐ ┌────────┐  │
│                                  │   │Job  │ │Driver│ │Finance │  │
│  [Primary CTA] [Secondary CTA]   │   │Board│ │Mobile│ │Invoice │  │
│                                  │   └─────┘ └─────┘ └────────┘  │
│  [Trust indicator strip]         │                                 │
│                                  │  [Workflow status badge]        │
│                                  │                                 │
└──────────────────────────────────┴─────────────────────────────────┘
│  Section gradient fade → next section                              │
└────────────────────────────────────────────────────────────────────┘
```

**Vertical rhythm:**
- Nav height: 64px (fixed, transparent over hero background)
- Top padding: `--xd-section-py-hero` (160px) from top of content area (below nav)
- Bottom padding: 120px to gradient fade
- Gap between left and right columns: `--xd-sp-24` (96px)
- Gap between eyebrow → headline: 16px
- Gap between headline → subheadline: 24px
- Gap between subheadline → CTAs: 40px
- Gap between CTAs → trust indicator strip: 48px
- Gap between primary screenshot → secondary screenshot row: 12px
- Secondary screenshot row height: ~180px (proportionally scaled from primary)

---

## 3a. Hero Background Specification

The background is the atmospheric foundation of the entire hero. It establishes depth, premium tone, and visual identity before the visitor reads a single word.

**Layers (bottom to top):**

1. **Base colour:** `--xd-bg-primary` (#070B14) — near-black navy. The darkest point of the page. Fills the entire section.

2. **Primary radial glow — blue, right-of-centre:**
   - Centre: aligned to the middle of the right column (approximately 75% from left, 45% from top of section)
   - Colour: `rgba(47, 107, 255, 0.09)` — the brand blue at very low opacity
   - Radius: 700px circular
   - Falloff: smooth radial gradient to transparent
   - Purpose: creates the feeling that the product composition is lit from within

3. **Secondary radial glow — deep indigo, upper left:**
   - Centre: approximately 20% from left, 25% from top
   - Colour: `rgba(80, 50, 180, 0.05)` — deep purple-indigo at near-invisible opacity
   - Radius: 500px
   - Purpose: creates asymmetric depth. The background is not flat or symmetrical.

4. **Noise texture overlay:**
   - A fine grain texture (SVG `feTurbulence` or CSS `background-image` approach — implementation TBD)
   - Opacity: 3–4%
   - Purpose: prevents the background from looking like a flat CSS gradient. Adds the micro-texture of premium dark UI.

5. **Horizontal scan line — very subtle:**
   - A single horizontal line at approximately 55% of the section height
   - `1px`, `rgba(47, 107, 255, 0.06)`, full width
   - Purpose: reinforces the tech/precision aesthetic. Optional — include only if it does not look gratuitous.

6. **Bottom gradient fade:**
   - `linear-gradient(to bottom, transparent, --xd-bg-secondary)` starting at 85% of section height
   - Height: 120px
   - Purpose: seamless transition to the next section without a hard edge.

**What the background must NOT do:**
- Must not use a photographic image
- Must not be animated (no moving particles, no animated gradients)
- Must not use a grid pattern, dot matrix, or geometric shapes — these are overused SaaS clichés
- Must not compete with the product composition for visual attention
- Must be CSS-only, with zero external image assets

---

## 4. Headline

**`<h1>` — primary headline**

> **"One platform for the entire  
> logistics operation."**

Rules:
- Two-line break is intentional — controlled at desktop width
- Font: `--xd-font-family` (Inter), `--xd-h1-size` (72px), weight `--xd-h1-weight` (700)
- Colour: `--xd-text-dark-primary` (#F3F7FF)
- Letter-spacing: `-0.02em` (tighten at display size)
- Line-height: `--xd-h1-line` (80px)
- Max-width: 620px (constrains to left column, never wraps to 3 lines at 1280px+)
- No gradient text. No outlined text. Plain white-on-dark, premium.

**Why this headline over the previous version:**
- "Your logistics operation, under complete control" is a generic SaaS control-plane statement — could apply to any SaaS product in any industry.
- "One platform for the entire logistics operation" communicates XDrive's **specific unique value**: end-to-end coverage of the whole logistics workflow, from marketplace to finance. No competitor does all of this in one place. That is the differentiator.
- "Entire logistics operation" signals scope: Marketplace + Dispatch + Driver + POD + Finance + Fleet. The right-column composition immediately proves it.

**Rejected alternatives:**
- "Every job. Every driver. One platform." — rhythmically good but undersells scope (sounds like driver/job management only)
- "The platform serious transport companies rely on." — authority claim with no substance on first impression; reads as marketing copy
- "Run your fleet. Own your workflow." — vague, sounds like a slogan, not a product statement

---

## 5. Subheadline

> "From job marketplace to proof of delivery, driver compliance to automated invoicing — XDrive connects every part of your transport operation in one place."

Rules:
- Font: Inter, `--xd-body-l-size` (20px), weight 400
- Colour: `--xd-text-dark-secondary` (#A9B7D0)
- Line-height: `--xd-body-l-line` (32px)
- Max-width: 560px
- Max 2 lines at desktop — if it wraps to 3, shorten copy
- No bold within the subheadline. The headline is bold; this is the calm, precise elaboration.
- The subheadline deliberately echoes the six workflow stages visible in the product composition (Marketplace → Dispatch → Driver → POD → Finance → Fleet), reinforcing what the visitor sees on the right.

---

## 6. Navigation Specification

The navigation is part of the Hero section. It occupies the topmost 64px of the `100dvh` viewport and is transparent over the hero background.

**Layout (1920px desktop):**

```
┌──────────────────────────────────────────────────────────────────────┐
│  [XDrive logo + wordmark]   [Platform] [How it works] [Pricing]  [Request Access ▶]  │
│  Left-aligned               Centre-aligned (flex)                Right-aligned        │
└──────────────────────────────────────────────────────────────────────┘
```

**Logo:**
- XDrive logotype (wordmark), left-aligned
- Height: 28px
- Colour: `--xd-text-dark-primary` (#F3F7FF)
- No icon-only mark — wordmark always appears in nav

**Navigation links (centre):**
- Items: `Platform`, `How it works`, `Pricing` (or equivalent top-level anchors — final labels TBD per sitemap)
- Font: `--xd-body-s-size` (16px), weight 500, `--xd-text-dark-secondary`
- Hover: `--xd-text-dark-primary`, no underline, 150ms transition
- Active/current: `--xd-text-dark-primary`, weight 600
- Gap between items: `--xd-sp-8` (32px)
- No dropdowns in the nav at this stage

**Right-side CTA:**
- Label: `"Request Access"`
- Style: filled, `--xd-blue` (#2F6BFF), white label, height 40px, horizontal padding 20px
- Border-radius: `--xd-radius-md` (12px)
- Font: 14px weight 600
- Hover: `--xd-blue-hover`, `translateY(-1px)`, 150ms
- This is a **smaller, nav-scaled version** of the hero primary CTA. Same destination (onboarding entry).

**Scroll behaviour:**
- **At rest (top of page):** nav background is fully transparent. The hero background shows through.
- **On scroll (any downward movement):** nav gains a `backdrop-filter: blur(12px)` + background `rgba(7, 11, 20, 0.85)` + `border-bottom: 1px solid --xd-border-dark`. This transition is 200ms `ease`.
- The nav becomes a sticky frosted-glass element as soon as the visitor scrolls.
- The nav CTA remains visible at all times on all sections (sticky nav carries the primary conversion path throughout the page).

**Mobile nav (≤ 768px):**
- Logo left, hamburger icon right (`--xd-text-dark-primary`, lucide `Menu`, 24px)
- Hamburger opens a full-screen overlay menu (dark, `--xd-bg-primary`)
- Full-screen menu contains: nav links stacked vertically + "Request Access" CTA at bottom, full-width

---

## 7. Trust Indicators

> **Design principle for Early Access:** No live numerical stats are shown. Numbers on an early-access platform can undermine credibility if they are small, volatile, or absent. Permanent, qualitative trust indicators communicate authority without depending on scale.

**Eyebrow badge (above headline):**
- Pill label: `"Now in Early Access — UK transport operators"`
- Style: Dark pill, border `1px solid --xd-border-dark`, background `--xd-bg-tertiary`, text `--xd-text-dark-secondary` at `--xd-label-size` (12px), tracking `--xd-label-tracking` (0.08em), uppercase
- Blue status dot (6px, `--xd-blue-soft`) on left side of pill — signals active development, not a demo
- The phrase "Early Access" is honest, deliberate, and positions XDrive as a platform worth waiting for

**Trust indicator strip (below CTAs):**

Four permanent, always-true indicators in a horizontal row, separated by `1px` vertical dividers (`--xd-border-dark`):

| Indicator | Supporting line |
|---|---|
| Built for UK haulage | Compliant with UK operator requirements |
| End-to-end workflow | Marketplace to invoicing in one platform |
| No spreadsheets | Replace fragmented tools with one system |
| Approval-gated access | Every operator is reviewed before onboarding |

- Layout: horizontal flex row, `--xd-sp-8` (32px) gap
- Each indicator: short label in `--xd-body-s-size` (16px), weight 600, `--xd-text-dark-primary`; supporting line in `--xd-caption-size` (14px), weight 400, `--xd-text-dark-secondary`, below
- These indicators are **static copy** — no API calls, no conditionals, no data dependency
- They communicate identity and positioning, not scale
- The four indicators directly echo the four emotions defined in §2 (Recognition, Scope, Confidence, Desire)

---

## 8. Hero Product Composition

The right column shows a **Hero Product Composition** — a curated multi-panel arrangement of screenshots representing the complete XDrive ecosystem in a single visual. This replaces the single Dispatcher Dashboard from Revision 1.

**Why a composition, not a single screenshot:**
- A single dashboard screenshot shows one role and one moment in the workflow
- The composition shows the full lifecycle: Marketplace → Dispatch → Driver → POD → Finance → Fleet
- This directly answers "what does this platform actually do?" without requiring the visitor to read the subheadline
- The composition is the visual proof of the headline: "One platform for the entire logistics operation"

**Composition structure (right column, 50% width ≈ 640px at 1920px):**

```
┌────────────────────────────────────────┐
│                                        │
│   PRIMARY PANEL                        │
│   Dispatcher / Job Board               │
│   ~640px wide × ~380px tall            │
│   (dominant visual, full width)        │
│                                        │
└────────────────────────────────────────┘
┌──────────────┐ ┌──────────┐ ┌─────────┐
│ SECONDARY A  │ │SECONDARY │ │SECONDARY│
│ Job creation │ │ Driver   │ │ Invoice │
│ / Marketplace│ │ mobile   │ │ / Finance│
│ ~200px wide  │ │ view     │ │ ~180px  │
│              │ │ ~180px   │ │         │
└──────────────┘ └──────────┘ └─────────┘
                                         
   [Workflow Status Badge — bottom right]
```

**Panel descriptions:**

*Primary panel — Dispatcher/Job Board:*
- View: Job management board. Multiple active jobs visible with: driver names, job status badges (In Transit, Collected, Delivered, Pending Assignment), origin/destination addresses, collection times.
- This is the command centre. It communicates operational complexity and control.
- Treatment: dark rounded frame (`--xd-radius-xl`), `1px solid --xd-border-dark`, `--xd-shadow-screenshot`, `--xd-shadow-glow-blue`
- Slight 3D tilt: `rotateY(-4deg) rotateX(2deg)` — more pronounced than secondary panels
- macOS-style traffic-light top bar
- Width: 100% of right column
- Height: 55% of composition height

*Secondary panel A — Job Marketplace / Job Creation:*
- View: The customer-facing job posting form or marketplace listing view — shows a job being created with address, goods type, vehicle requirement fields.
- Represents: **Marketplace** layer of the ecosystem
- Treatment: same frame treatment as primary, but smaller. `rotateY(-2deg)` only.
- Width: ~31% of right column

*Secondary panel B — Driver Mobile:*
- View: The driver mobile app interface — a job card with Accept/Navigate/POD actions visible.
- Represents: **Driver** layer of the ecosystem
- Treatment: shown in a mobile-portrait frame (rounded corners, no traffic lights — mobile phone proportions). Slight tilt.
- Width: ~28% of right column

*Secondary panel C — Finance / Invoice:*
- View: Invoice or billing summary — a generated invoice with job reference, GBP amount, company name, due date.
- Represents: **Finance** layer of the ecosystem
- Treatment: same frame as panel A, slight tilt.
- Width: ~31% of right column

**Gap between primary and secondary panels:** 10px

**Vertical alignment of secondary panels:** top-aligned to each other, gap between secondary panels: 8px

**Overall composition dimensions:**
- Total width: fills right column (~640px display at 1920)
- Total height: ~580px display at 1920

**Workflow Status Badge (overlaid on composition, bottom-right of primary panel):**
- See §7a below

**Screenshot export requirements for each panel:** See §9.

---

## 7a. Workflow Status Badge

This replaces the "floating live metric badge" from Revision 1. It is a truthful operational indicator that does not depend on live data or platform scale.

**Design:**
- Small floating card, overlaid bottom-right on the primary panel
- Label: `"Marketplace → Dispatch → POD → Invoice"` or rendered as four small step-pills with arrows between them
- Sub-label: `"Full workflow — one platform"` in `--xd-caption-size`
- Style: `--xd-bg-tertiary` background, `--xd-shadow-card`, `--xd-radius-md`, `--xd-card-p-sm`, `1px solid --xd-border-dark`
- Colour accent: thin left border `3px solid --xd-blue`
- This badge is **static** — it communicates the workflow structure, not a live count
- Always shown. Never hidden. Always truthful regardless of platform scale or usage.
- No pulse animation. No spinner. No live data dependency.

---

## 9. Image / Screenshot Requirements

All screenshots must be taken from the live, production-state XDrive platform with real (but anonymised) UK logistics data. No placeholders, no empty states, no error states.

**Primary panel — Dispatcher Job Board:**

| Property | Requirement |
|---|---|
| View | Job management board, multiple active jobs |
| Data | Real UK addresses, GBP values, plausible driver names, mixed status badges |
| Export dimensions | 1280×760px display, 2x source (2560×1520px) |
| Format | WebP compressed, fallback PNG |
| Max file size | 200KB WebP |
| Browser chrome | Hidden |

**Secondary panel A — Marketplace / Job Creation:**

| Property | Requirement |
|---|---|
| View | Job creation form or marketplace listing — fields populated with realistic UK job data |
| Export dimensions | 640×460px display, 2x source |
| Format | WebP, max 100KB |
| Browser chrome | Hidden |

**Secondary panel B — Driver Mobile:**

| Property | Requirement |
|---|---|
| View | Driver app — job card with actions visible, job in progress |
| Export dimensions | 320×560px display (portrait), 2x source |
| Format | WebP, max 80KB |
| Frame | Mobile phone frame (rounded rect, no traffic lights) |
| Browser chrome | Hidden |

**Secondary panel C — Finance / Invoice:**

| Property | Requirement |
|---|---|
| View | Generated invoice — job reference, company name, GBP amount, due date |
| Export dimensions | 640×460px display, 2x source |
| Format | WebP, max 100KB |
| Browser chrome | Hidden |

**Background:** CSS-only — no photographic hero background. Zero image assets for background layer.

---

## 10. Motion Behaviour

**On page load — coordinated entrance in three phases:**

1. **Phase 1 (0–350ms):** Left column content (eyebrow + headline + subheadline) fades in and rises 16px → 0 (`opacity: 0→1`, `translateY(16px→0)`, `cubic-bezier(0.16, 1, 0.3, 1)` — ease-out spring)
2. **Phase 2 (200–600ms, overlapping):** Primary panel screenshot fades in and rises 24px → 0 (same easing, 200ms delay after phase 1 start)
3. **Phase 3 (400–750ms):** Secondary panels fade in individually with 60ms stagger between each (A, B, C). Rise 16px → 0.
4. **Phase 4 (600–900ms):** CTAs and trust indicator strip fade in. Workflow status badge fades in.

**Scroll parallax:** None.

**CTA hover states:**
- Primary CTA: `translateY(-1px)`, `box-shadow` intensifies slightly, 150ms `ease-out`
- Secondary CTA: arrow moves `translateX(4px)`, 150ms `ease-out`

**Primary panel hover:** `translateY(-4px)` + `--xd-shadow-card-hover`, 200ms ease. Subtle lift — the composition responds to cursor attention.

**Secondary panel hover:** `translateY(-3px)` + `--xd-shadow-card-hover`, 200ms ease.

**`prefers-reduced-motion`:** All transforms and phased animations disabled. All elements render at final opacity and position immediately. No stagger, no movement.

---

## 11. Responsive Notes

Desktop-first at 1920px. Responsive behaviour noted for completeness; not the primary design target.

| Breakpoint | Layout change |
|---|---|
| 1440px | Container stays `1320px`. Left/right columns compress proportionally. Composition panels scale. |
| 1280px | Column gap reduces to 64px. Primary panel ~520px wide. Secondary panels scale proportionally. |
| 1024px (tablet) | Stack to single column. Composition moves below the copy. Primary panel: 100% column width. Secondary panels: horizontal row below primary, each 33% width. Trust strip: 2×2 grid. |
| 768px | Headline: `--xd-h2-size` (56px). Subheadline: `--xd-body-m-size` (18px). Secondary panels hidden — only primary panel shown. |
| 375px (mobile) | Headline: 36px / 700. CTAs: stacked vertically, full-width. Only primary panel shown, clipped to top 55% height. Trust strip: 2-col. Workflow status badge: visible, repositioned below composition. Nav: hamburger menu. |

**Mobile critical rule:** Primary CTA must be visible above the fold on 375×812 without scrolling.

---

## 12. Acceptance Criteria

Implementation is complete and ready for approval when ALL of the following are true:

**Visual:**
- [ ] Background: `--xd-bg-primary` + dual radial glows + noise texture + horizontal scan line (if approved) + bottom fade
- [ ] Two-column layout renders correctly at 1920, 1440, 1280px
- [ ] Headline is 72px Inter 700, correct colour, max 2 lines at 1280px+
- [ ] Subheadline is 20px Inter 400, secondary colour, max 2 lines
- [ ] Primary CTA is `--xd-blue` filled, secondary CTA is ghost with arrow
- [ ] Eyebrow badge renders above headline — "Early Access" copy, blue dot
- [ ] Trust indicator strip shows all 4 permanent indicators (static, no data dependency)
- [ ] Hero Product Composition renders with primary + 3 secondary panels
- [ ] All panels are inside correct frames (rounded, bordered, shadow + glow)
- [ ] Primary panel has 3D tilt; secondary panels have lighter tilt
- [ ] Workflow Status Badge renders correctly, static, always visible
- [ ] macOS-style traffic light top bar on desktop-frame panels
- [ ] Mobile frame (portrait) on driver panel
- [ ] Nav is transparent at rest, frosted-glass on scroll

**Technical:**
- [ ] All screenshots served via `next/image` as WebP, primary with `priority` prop
- [ ] Primary panel file size ≤ 200KB; secondary panels ≤ 100KB each
- [ ] Driver mobile panel ≤ 80KB
- [ ] No layout shift (CLS = 0) — `width`/`height` defined on all `<Image />`
- [ ] No `<img>` tags — only `next/image`
- [ ] Nav scroll behaviour implemented (transparent → frosted-glass transition)

**Motion:**
- [ ] Four-phase load animation plays on first render (correct timing and stagger)
- [ ] `prefers-reduced-motion` disables all transforms and stagger
- [ ] CTA hover states work
- [ ] Primary + secondary panel hover lift works

**Accessibility:**
- [ ] `<section>` has `aria-label="Hero"`
- [ ] Nav has `<nav>` landmark and `aria-label="Main navigation"`
- [ ] `<h1>` is the only `<h1>` on the page
- [ ] All screenshot `<Image />` components have descriptive `alt` text
- [ ] Primary CTA focus ring is visible and high-contrast
- [ ] All text passes 4.5:1 contrast ratio
- [ ] Keyboard navigation reaches nav links, both hero CTAs, and nav CTA
- [ ] Mobile hamburger menu is keyboard-accessible and has `aria-label`

**Responsive:**
- [ ] Single-column stack layout at 1024px and below
- [ ] Secondary panels hidden at 768px and below
- [ ] Only primary panel visible on mobile, clipped correctly
- [ ] Primary CTA visible above fold on 375×812
- [ ] Hero height does not exceed `100dvh` on any breakpoint
- [ ] Mobile nav hamburger opens full-screen overlay

**Lighthouse (desktop):**
- [ ] Performance ≥ 90
- [ ] Accessibility ≥ 95
- [ ] LCP (primary panel screenshot) ≤ 2.5s
- [ ] CLS = 0

---

## 13. Hero Success Metrics

These define exactly what a visitor must understand within the **first 5 seconds** of seeing the Hero. If any of these are not achieved, the Hero has failed — regardless of whether the acceptance criteria above are met.

**What the visitor must understand within 5 seconds:**

| # | Understanding | How it is communicated |
|---|---|---|
| 1 | *"This is a logistics platform — not a generic SaaS tool"* | Headline ("logistics operation"), subheadline ("transport operation"), composition screenshots showing real logistics UI |
| 2 | *"This covers the entire operation, not just one part"* | Composition: 4 panels representing Marketplace, Dispatch, Driver, Finance. Subheadline lists the full chain. |
| 3 | *"This is real software, in production, working right now"* | Screenshots show real UK job data, not mockups. macOS/mobile frames signal "real app." Eyebrow badge says "Early Access" — honest, not "coming soon." |
| 4 | *"This was built for UK transport operators, not the US market or generic logistics"* | Eyebrow badge: "UK transport operators". Subheadline: UK-specific terminology. Screenshots: GBP values, UK address format. |
| 5 | *"I know exactly what to do next"* | Two clearly hierarchical CTAs: "Request Access" (primary) and "See how it works" (secondary). One is the action; one is the escape hatch. |

**Testing this:**
The 5-second test is conducted by showing the Hero to someone unfamiliar with XDrive for exactly 5 seconds, then asking:
1. What does this product do?
2. Who is it for?
3. Does it look like a real, working product?
4. What would you do next on this page?

If ≥ 3 of 5 understandings are not reported correctly, the Hero composition, headline, or visual direction must be revised before launch.

---

## Approval

- [ ] **Hero blueprint approved — implementation may begin**
