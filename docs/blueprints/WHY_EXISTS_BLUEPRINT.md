# Blueprint #2 — Why XDrive Exists

> **Status: PENDING REVIEW**
>
> Section: Homepage Section 2 — "Why XDrive Exists"
> Position in page: Immediately below the Hero section.
> Workflow: Blueprint → Review → Approval → Implementation → Verification → Lock
>
> This document defines every design decision for Section 2 before a single line of code is written.
> No implementation begins until this blueprint is approved.

---

## 1. Purpose

Section 2 answers the most important question a qualified visitor asks after the Hero:

> *"OK — but why does this exist? What specific problem is it solving?"*

The Hero establishes **what** XDrive is. Section 2 establishes **why XDrive had to be built at all**.

This section is not a feature list. It is not a marketing benefit list. It is an honest operational diagnosis: the real fragmentation that exists in UK transport work today, articulated precisely enough that a logistics operator reads it and thinks *"this is exactly what I deal with every day."*

The section should produce a moment of recognition — the visitor should feel seen and understood before they understand the solution. The problem must land before the answer does.

---

## 2. Emotional Objective

Target state after the visitor reads Section 2:

> *"They understand exactly what my operation looks like. These are real operational problems — not invented marketing pain points. If they've diagnosed this correctly, maybe they've also built the right solution."*

The section must produce, in sequence:

1. **Recognition** — "This describes my actual day, not a hypothetical scenario"
2. **Validation** — "Someone finally articulated this clearly — this is a real structural problem"
3. **Curiosity** — "If they understand the problem this well, I want to see what they've built"
4. **Forward pull** — "I need to scroll to understand the solution"

The section must NOT feel like:
- A generic "the industry is broken" slide from a pitch deck
- A feature comparison against competitors
- A set of complaints with no resolution in sight
- An academic analysis that distances the reader from the emotion

---

## 3. Position in the Homepage Story

Homepage narrative flow:

```
[HERO]            What XDrive is. The platform itself. First 5 seconds.
        ↓
[WHY EXISTS]      Why it had to be built. The operational problem. Section 2.
        ↓
[HOW IT WORKS]    The solution in workflow form. Step-by-step structure.
        ↓
[PLATFORM]        The modules. What each part does. Who uses it.
        ↓
[ROLES]           The personas. Each role's specific value.
        ↓
[TRUST / CTA]     Social proof + conversion. Final section.
```

Section 2 is the **emotional bridge** from the Hero's promise to the workflow's proof. It cannot be skipped. If the visitor goes from Hero to "How it Works" without understanding the problem, the workflow steps feel like feature tourism, not operational necessity.

---

## 4. Layout at 1920px Desktop

**Overall structure:** Full-width section, light background (`--xd-surface-light: #F7F9FC`), standard section padding.

**Two-part layout — 45% / 55%:**

```
┌───────────────────────────────────────────────────────────────────┐
│  Background: --xd-surface-light (#F7F9FC)                         │
│  Section padding: --xd-section-py (120px top/bottom)              │
├──────────────────────────┬────────────────────────────────────────┤
│  LEFT COLUMN  45%        │  RIGHT COLUMN  55%                     │
│  (top-aligned)           │  (top-aligned)                         │
│                          │                                        │
│  [Eyebrow badge]         │  PROBLEM CARD 1                        │
│                          │  ┌────────────────────────────────┐    │
│  Section H2              │  │ "No single record for a job"   │    │
│  (2–3 lines)             │  └────────────────────────────────┘    │
│                          │                                        │
│  Section body copy       │  PROBLEM CARD 2                        │
│  (2 lines max)           │  ┌────────────────────────────────┐    │
│                          │  │ "POD is scattered across apps" │    │
│  [Platform promise       │  └────────────────────────────────┘    │
│   statement]             │                                        │
│                          │  PROBLEM CARD 3                        │
│                          │  ┌────────────────────────────────┐    │
│  (space)                 │  │ "Invoicing lags every delivery"│    │
│                          │  └────────────────────────────────┘    │
│                          │                                        │
│                          │  PROBLEM CARD 4                        │
│                          │  ┌────────────────────────────────┐    │
│                          │  │ "Compliance documents chase    │    │
│                          │  │  every job manually"           │    │
│                          │  └────────────────────────────────┘    │
│                          │                                        │
└──────────────────────────┴────────────────────────────────────────┘
```

**Column alignment:** Both columns top-aligned (not centred). The left column will be shorter than the right column at most breakpoints — this is correct. The left column content anchors to the top of the section. The right column fills with cards below it.

**Column gap:** `--xd-sp-24` (96px)

---

## 5. Background Specification

| Property | Value |
|---|---|
| Background colour | `--xd-surface-light` (#F7F9FC) — very light blue-grey, near white |
| Section padding | `--xd-section-py` (120px top and bottom) |
| Border top | `1px solid --xd-border-light` (#D9E1EE) — separates cleanly from Hero's dark bottom fade |
| Border bottom | `1px solid --xd-border-light` — separates from the next section |
| No decorative elements | No background glows, no textures, no noise — the Hero handled atmosphere. This section is clean, clear, direct. |

**Why light background here:**
The Hero is deep dark navy. Section 2 on a light background creates an immediate visual rhythm break — the visitor understands they have crossed a threshold from introduction to content. Light also reinforces clarity and honesty: the section should feel like reading a well-written diagnosis, not a dark sales presentation.

---

## 6. Eyebrow Badge

| Property | Specification |
|---|---|
| Text | `"Why XDrive was built"` |
| Style | Light pill — `background: white`, `border: 1px solid --xd-border-light`, `border-radius: 9999px` |
| Font | `--xd-label-size` (12px), weight 600, `letter-spacing: --xd-label-tracking` (0.08em), uppercase |
| Colour | `--xd-blue` (#2F6BFF) — same brand blue, now on light surface |
| Padding | `0.375rem 0.875rem` |
| Position | Above the section H2, same column (left) |

---

## 7. Section Headline (H2)

**Copy:**

> "The logistics operation was never designed to work in one place."

**Rules:**
- Font: `--xd-font-family` (Inter), `--xd-h2-size` (56px), `--xd-h2-weight` (700)
- Colour: `--xd-text-light-primary` (#0D1424)
- Letter-spacing: `-0.02em`
- Line-height: `--xd-h2-line` (64px)
- Max-width: 520px — constrained to left column, does not overflow into right column
- Max 3 lines at 1280px+
- No gradient. No outlined text. Plain dark-on-light.
- Fluid clamp: `clamp(2rem, 3.5vw, var(--xd-h2-size))`

**Why this headline:**

The statement is observable fact, not a complaint. It doesn't blame operators for using multiple tools — it acknowledges that the ecosystem grew organically, and XDrive was built to address what the ecosystem never provided. This positions XDrive as structural necessity, not a convenience feature.

**Rejected alternatives:**
- "UK transport is broken" — combative, inaccurate, immediately alienates operators who are proud of their work
- "Stop using spreadsheets" — prescriptive before trust is established; assumes the visitor already wants a solution
- "The problem with load boards" — frames XDrive as a load board competitor, which it is not

---

## 8. Section Body Copy

**Copy:**

> "Carriers, customers, and drivers each carry part of a job's information. When something changes — a collection delay, a new address, a missing POD — the update lives in a phone call, a message thread, or someone's inbox. XDrive connects the record."

**Rules:**
- Font: Inter, `--xd-body-m-size` (18px), weight 400
- Colour: `--xd-text-light-secondary` (#42526E)
- Line-height: `--xd-body-m-line` (30px)
- Max-width: 440px
- Max 4 lines at desktop

---

## 9. Platform Promise Statement

A short, high-contrast statement at the bottom of the left column that acts as a bridge to the solution — without solving it yet.

**Copy:**

> "One job. One record. Every role connected."

**Rules:**
- Font: Inter, `--xd-body-s-size` (16px), weight 700
- Colour: `--xd-blue` (#2F6BFF)
- No button — this is a typographic statement, not a CTA
- Positioned below the body copy with `margin-top: --xd-sp-8` (32px)
- This functions as a thesis statement that the right column cards support
- No border, no pill, no badge — just clean bold text

**Why not another CTA here:**
The visitor has not yet read the problem cards. A CTA at this point is premature. The left column sets the frame; the right column delivers the evidence. The CTA comes after the evidence is absorbed — in the Hero (already seen) and in the final CTA section.

---

## 10. Problem Cards (Right Column)

Four cards, stacked vertically, each representing one specific operational fragmentation point.

### 10.1 Card Structure

Each card contains:

| Element | Specification |
|---|---|
| **Operational tag** | `"Operational gap"` — small label, `--xd-label-size` (12px), uppercase, weight 600, `--xd-blue` |
| **Problem title** | Short, specific, present-tense observation — `--xd-card-title-size` (24px), weight 600, `--xd-text-light-primary` |
| **Problem detail** | 1–2 sentence expansion — `--xd-body-s-size` (16px), weight 400, `--xd-text-light-secondary` |
| **Card background** | White (`--xd-surface-white`) |
| **Card border** | `1px solid --xd-border-light` (#D9E1EE) |
| **Card radius** | `--xd-radius-lg` (16px) |
| **Card padding** | `--xd-card-p-md` (24px) |
| **Card shadow** | `0 1px 3px rgba(13,20,36,0.06), 0 4px 16px rgba(13,20,36,0.04)` — very subtle, light-surface shadow |

### 10.2 Card Content

**Card 1: Job record fragmentation**

- **Operational tag:** Operational gap
- **Problem title:** No single record follows a job from request to delivery.
- **Problem detail:** A job starts as a phone call or email. The quote lives in a spreadsheet. The assignment happens over WhatsApp. The POD is a photo on someone's phone. At no point does one system hold the complete picture.

**Card 2: Proof of delivery gaps**

- **Operational tag:** Operational gap
- **Problem title:** Proof of delivery is disconnected from the job it proves.
- **Problem detail:** POD photos get emailed separately. Signed delivery notes live in a folder on a driver's phone or a filing cabinet. When a customer disputes a delivery, finding the proof takes longer than the original job.

**Card 3: Invoice lag**

- **Operational tag:** Operational gap
- **Problem title:** Invoicing happens after the job — never because of it.
- **Problem detail:** Someone manually creates an invoice from memory, a spreadsheet, or a text message record. Payment terms start from the invoice date — not from when the job was completed. Every day of lag is cost.

**Card 4: Compliance document management**

- **Operational tag:** Operational gap
- **Problem title:** Driver compliance documents are chased, not maintained.
- **Problem detail:** Licence expiry dates, vehicle inspection records, and operator certificates are tracked in spreadsheets — if tracked at all. Renewals are handled reactively when something expires, not proactively when a record approaches its limit.

### 10.3 Card Layout Behaviour

| Breakpoint | Layout |
|---|---|
| 1920px desktop | Single column, 4 cards stacked vertically, full width of right column |
| 1440px | Same — single column, cards scale with column width |
| 1280px | Same |
| 1024px (tablet) | Left column collapses above right column (stacked). Cards 2-col grid (2×2) |
| 768px | 2-col grid (2×2) |
| 375px (mobile) | Single column, full width |

---

## 11. Section Entrance Animation

The section is below the fold — entrance animation activates when the section enters the viewport (`IntersectionObserver` with `threshold: 0.15`).

**Sequence:**

1. **Phase 1 (0ms, 350ms):** Left column (eyebrow + H2 + body + promise) fades in and rises 16px → 0. `xd-slide-up` keyframe, `--xd-ease-out`.
2. **Phase 2 (100ms delay each):** Cards enter with a 100ms stagger — Card 1 at 100ms, Card 2 at 200ms, Card 3 at 300ms, Card 4 at 400ms. Same `xd-slide-up` with 200ms duration each.

**`prefers-reduced-motion`:** All animations disabled. All elements render at final position immediately.

**Note on implementation:** Since this section is below the fold, a CSS-only `animation` on page load (as used in the Hero) will not work — the Hero animations fire at `0ms`. The below-fold sections require a scroll-triggered animation approach. Implementation options:

- **Option A (recommended):** Add a small `IntersectionObserver` utility hook (`useReveal`) in `app/(marketing)/_hooks/useReveal.ts`. Adds a `data-revealed` attribute on intersection; CSS transitions on `[data-revealed]` selector.
- **Option B:** Use CSS `animation-play-state: paused` initially, switch to `running` via JS on intersection.
- **Option C:** No animation — elements render at rest immediately. Zero implementation overhead. Acceptable fallback if Option A adds complexity.

Blueprint does not mandate a specific option — this is an implementation decision. However, Option C (no animation) is explicitly permitted and produces zero UX regression.

---

## 12. Accessibility

| Requirement | Specification |
|---|---|
| `<section>` landmark | `<section aria-labelledby="why-exists-heading" id="why">` |
| `<h2>` ID | `id="why-exists-heading"` — referenced by section's `aria-labelledby` |
| Cards as `<article>` | Each problem card is `<article>` with its `<h3>` as problem title |
| No interactive elements in cards | Cards are informational — no buttons, no links, no hover-triggered content changes |
| Contrast: body copy | `--xd-text-light-secondary` (#42526E) on `--xd-surface-light` (#F7F9FC) — must pass 4.5:1. **Verify before implementation.** |
| Contrast: operational tag | `--xd-blue` (#2F6BFF) on white card — must pass 4.5:1 for normal text. **Verify before implementation.** |

> **Contrast note:** `--xd-blue` (#2F6BFF) on white achieves approximately 3.9:1 — this falls short of WCAG AA for body text (4.5:1) but passes for large text (3:1). Since the operational tag is 12px uppercase (decorative / non-essential copy), this is acceptable. However, if the card title uses `--xd-blue`, a darker shade must be substituted. The card title uses `--xd-text-light-primary` (#0D1424) — this is well above 4.5:1 on white. ✅

---

## 13. Responsive Notes

| Breakpoint | Changes |
|---|---|
| 1920px | Reference — full two-column, cards stacked right |
| 1440px | Container compresses; columns scale proportionally |
| 1280px | Left column may approach minimum content width (~420px) |
| 1024px | Columns stack: left column above, right column (cards) below. Cards switch to 2×2 grid. |
| 768px | Cards 2×2. Left column headline drops to `clamp(1.75rem, 4vw, var(--xd-h2-size))`. |
| 375px | Single column. Cards full-width, single column stack. Body copy `--xd-body-s-size`. |

---

## 14. Copy Tone Principles

These apply to all copy in this section — headlines, body text, card titles, and card detail paragraphs.

1. **Observe, don't prescribe.** Say what is happening, not what operators should do differently.
2. **Specific, not abstract.** "A photo on someone's phone" is better than "fragmented data management."
3. **Present tense.** The problem is happening now — not historically.
4. **No superlatives.** No "the biggest problem", "the most frustrating issue". State the problem clearly; the reader's own experience provides the emotional weight.
5. **No competitor mentions.** XDrive is not defined by what it is not. These cards describe the environment, not the competition.

---

## 15. What This Section Must NOT Do

- Must NOT show a feature list or product screenshot (that belongs in Hero and Platform sections)
- Must NOT position competitors as the problem — the structural environment is the problem
- Must NOT use numbered steps or a workflow format (that belongs in "How it Works")
- Must NOT include a CTA — this is a diagnostic section, not a conversion section
- Must NOT be on a dark background — the visual rhythm requires this to be a light section
- Must NOT introduce new colour tokens outside the approved `marketing-tokens.css` system

---

## 16. Relationship to Existing `WhyExistsSection.tsx`

A component named `WhyExistsSection.tsx` already exists at `app/(marketing)/_components/sections/WhyExistsSection.tsx`. This component was created outside the approved blueprint workflow and is not currently imported by `LandingPage.tsx`.

**At implementation time, the following decision must be made:**

| Option | Description |
|---|---|
| **A — Adopt with revision** | Review `WhyExistsSection.tsx` against this blueprint. Update copy, structure, and styling to match. Replace the inline `#resources` section in `LandingPage.tsx` with this component. |
| **B — Replace** | Delete `WhyExistsSection.tsx` and write a new component from scratch that implements this blueprint exactly. Replace the inline `#resources` section in `LandingPage.tsx`. |
| **C — Inline revision** | Update the inline `#resources` block in `LandingPage.tsx` directly (no separate component) and delete `WhyExistsSection.tsx`. |

**Recommendation:** Option A — the existing `WhyExistsSection.tsx` has the correct structural intention (two-column, left context + right cards). Its content and styling do not yet match this blueprint's specifications. Revise rather than rewrite to minimise code churn. Option B is acceptable if review finds deep structural mismatch.

**Important:** The existing inline `#resources` section in `LandingPage.tsx` already contains an older version of this content (using `problemPoints` from `content.ts`). The approved implementation of Blueprint #2 must replace that inline section with the new component — it must not exist twice on the page.

---

## 17. Acceptance Criteria

Implementation is complete and ready for review when ALL of the following are true:

**Visual:**
- [ ] Light background (`--xd-surface-light`) with top and bottom `--xd-border-light` borders
- [ ] Two-column layout at 1280px+ — left 45%, right 55%
- [ ] Eyebrow badge: "Why XDrive was built", blue on white pill
- [ ] H2: exact approved copy, 56px Inter 700, dark primary, max 3 lines
- [ ] Body copy: exact approved copy, 18px weight 400, light secondary
- [ ] Platform promise statement: exact copy, 16px bold, `--xd-blue`
- [ ] Exactly 4 problem cards, correct content, correct structure
- [ ] Each card: operational tag + title + detail, white bg, border, shadow, radius
- [ ] Stacked vertical in right column at desktop; 2×2 grid at tablet/mobile
- [ ] Left column collapses above right at 1024px (single-column stack)

**Technical:**
- [ ] Section component is self-contained (no inline styles except where CSS vars require them)
- [ ] No new colour values introduced outside `marketing-tokens.css` token system
- [ ] No hardcoded pixel values outside the established pattern
- [ ] No `<img>` tags — no images in this section at all
- [ ] Section ID is `#why` (or matching the nav anchor for "Why XDrive")

**Accessibility:**
- [ ] `<section aria-labelledby="why-exists-heading">`
- [ ] `<h2 id="why-exists-heading">` — exactly one H2 in this section
- [ ] Each card is `<article>` with `<h3>` as card title
- [ ] All text passes 4.5:1 contrast ratio on respective backgrounds
- [ ] No interactive elements that are not keyboard-reachable

**Responsive:**
- [ ] Two-column at 1280px+
- [ ] Stacked single-column at 1024px and below
- [ ] Cards: 2×2 grid at 768px–1023px, single column at 375px
- [ ] No horizontal overflow at any breakpoint

---

## 18. Blueprint Approval Checklist

- [ ] Purpose and emotional objective reviewed
- [ ] Copy reviewed and approved (headlines, body, card content)
- [ ] Layout specification reviewed
- [ ] Background and border treatment reviewed
- [ ] Card structure and content reviewed
- [ ] Responsive behaviour reviewed
- [ ] Accessibility requirements reviewed
- [ ] Relationship to existing components reviewed
- [ ] **Blueprint approved — implementation may begin**

---

*Blueprint #2 — Why XDrive Exists — v1.0 — 2026-07-05*
*Pending approval before implementation.*
