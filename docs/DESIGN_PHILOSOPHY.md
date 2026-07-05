# XDrive Logistics — Design Philosophy

> **Status: DRAFT — requires approval before any homepage section implementation begins.**
>
> This document must be approved in full before the Visual System is considered locked and before Hero or any homepage section is implemented.

---

## 1. Brand Personality

XDrive is a **professional logistics platform built for transport operators, not for the general public**. The brand personality is defined by four core traits:

- **Reliable** — every visual and copy decision reinforces trust. Nothing looks experimental, trendy, or playful.
- **Precise** — clean layout, tight typography, no visual noise. Every element earns its place on screen.
- **Efficient** — the interface communicates capability at a glance. Fast to read, fast to act on.
- **Human** — behind every delivery is a real driver and a real business. The brand respects that without becoming sentimental.

**What XDrive is NOT:** loud, generic, cheap-looking, cluttered, overly corporate, or flashy. It does not borrow from consumer apps or ride-share aesthetics.

---

## 2. Emotional Direction

The homepage must produce a specific emotional arc in the visitor:

1. **Recognition** — "This is for businesses like mine." (first 3 seconds)
2. **Confidence** — "This platform knows what it's doing." (first scroll)
3. **Clarity** — "I understand exactly what this does." (mid-page)
4. **Desire** — "I want my operation to look like this." (product section)
5. **Trust** — "Others are already using this successfully." (social proof)
6. **Action** — "I know exactly what to do next." (CTA)

Every section must advance this arc. If a section does not move the visitor forward emotionally, it is removed.

---

## 3. Storytelling Rules

The homepage tells one story: **XDrive turns operational chaos into a controlled, professional logistics operation.**

Narrative structure (Problem → Solution → Workflow → Product → Benefits → Trust → CTA):

- **Problem:** Transport companies are managing jobs, drivers, invoices, and compliance with spreadsheets and phone calls.
- **Solution:** XDrive is a single platform that replaces that fragmented workflow.
- **Workflow:** Here is exactly how it works — step by step.
- **Product:** Here is what it looks like inside.
- **Benefits:** Here is what changes for your business.
- **Trust:** Here is proof it works.
- **CTA:** Here is how you start.

**Rules:**
- Never start a section with a feature name. Start with the outcome for the operator.
- No jargon, acronyms, or logistics industry buzzwords without context.
- Headlines are outcomes, not descriptions. "Your drivers. Always on time." not "Driver Management Module."
- Copy is written for a fleet manager or owner-operator, not a developer.
- No passive voice in hero or section headlines.

---

## 4. Screenshot Philosophy

Screenshots are the primary visual proof that XDrive is a real, working platform. They are treated as premium assets.

**Rules:**
- Screenshots must show **real, meaningful data** — not placeholder text, not "John Doe", not empty states.
- Data in screenshots must reflect plausible real-world usage: jobs with real UK addresses, invoice amounts in GBP, driver names that could be real.
- UI must be in its **polished, production state** — no dev tools visible, no browser UI unless intentional, no unfinished UI elements.
- Screenshots are always **desktop-first at 1920×1080** unless specifically showing a mobile workflow.
- Each screenshot has **one focal point** — the relevant feature is visible and not obscured by adjacent UI.
- Screenshots are used **instead of** marketing illustrations wherever the UI can speak for itself.
- Screenshots must be **current** — outdated UI screenshots are replaced immediately when the platform changes.
- Use **subtle depth effects** (slight drop shadow, soft glow) to lift screenshots off the background, not heavy borders or clip art frames.

---

## 5. Photography Rules

Photography is used sparingly and only where screenshots cannot convey the point (e.g., the human/operational context section).

**Rules:**
- Photography must feature **real logistics context**: vans, warehouses, drivers, UK roads — not stock imagery of generic businesspeople at desks.
- Only **high-quality, high-resolution** photography (minimum 2400px wide). No pixelated, low-contrast, or obviously stock-library images.
- Color treatment: photography is desaturated slightly and overlaid with the brand dark layer to maintain visual consistency with the UI-heavy sections.
- No smiling-at-camera posed shots. Prefer **action, environment, or documentary-style** photography.
- No photography that contradicts the platform's tone — no chaotic/messy depot shots unless used deliberately to illustrate the "before" state.
- UK context is mandatory: UK number plates, UK road signs, right-hand drive vehicles where vehicles appear.
- Photography never competes with the headline or CTA for attention.

---

## 6. White-Space Philosophy

White space is not empty space — it is a structural element that communicates clarity, premium quality, and operational precision.

**Rules:**
- Every section has a defined **breathing zone**: a minimum vertical padding of `96px` (6rem) top and bottom at desktop.
- Content is never edge-to-edge. Maximum content width is `1280px`, centred. Side gutters on widescreen layouts are never less than `80px`.
- Within a section, elements are grouped by function, not packed for density. A product screenshot and its supporting copy have a minimum gap of `48px`.
- **No stacking without purpose.** If two elements are visually adjacent, there is a reason. Unrelated elements have visual separation.
- White space increases as the user scrolls deeper into the page — earlier sections are denser (information), later sections are more open (trust, CTA).
- The hero section is the most spacious section on the page. It sets the tone for what follows.
- Micro white space (letter-spacing, line-height, internal padding) must be consistent across the Visual System tokens.

---

## 7. Iconography Rules

Icons are a supporting element, not a decorative one. They assist comprehension, they do not replace copy.

**Rules:**
- One icon library only: the project uses a single, consistent icon set (default: `lucide-react`). No mixing of icon sets.
- Icons are used **only** when they add meaning — e.g., alongside a feature label to reinforce category. Never as decoration.
- Icon size is constrained: `16px` inline, `20px` standalone label companion, `24px` feature card, `32px` max in any non-illustration context.
- Icons are **monochrome** using the brand palette — no multicolour icons except in the specific accent-highlight context.
- Icon stroke weight must match across all usages. Default: `1.5px` stroke.
- No custom-drawn icons unless approved. Prefer standard lucide equivalents, even if imperfect, over inconsistent custom SVGs.
- Icon-only buttons must have accessible labels (`aria-label`).

---

## 8. Illustration Policy

XDrive does not rely on illustrations as a primary visual element.

**Policy:**
- Illustrations are **prohibited** as hero visuals or primary section visuals. Screenshots replace them.
- If an illustration is required (e.g., empty state, onboarding step, flow diagram), it must be **line-art style** with a limited palette drawn from the brand token set.
- Illustrations are never used where a screenshot can be used. Screenshots are always preferred.
- No isometric 3D illustrations. No cartoon characters. No abstract blob/shape illustrations.
- If a product flow or process must be illustrated (e.g., a "how it works" diagram), use a **structured, typographic step diagram** with connector lines — not pictograms or scene illustrations.
- Third-party illustration packs are not permitted. All illustrations, if needed, are purpose-made for XDrive.

---

## 9. Accessibility Standards

XDrive targets **WCAG 2.1 Level AA** as a minimum, with Level AAA where achievable without visual compromise.

**Standards:**
- **Colour contrast:** minimum 4.5:1 for body text, 3:1 for large text and UI components, against their background.
- **Focus indicators:** all interactive elements must have a visible, high-contrast focus ring. Not hidden, not styled to 1px.
- **Keyboard navigation:** all interactive homepage elements are reachable and operable via keyboard alone.
- **Alt text:** every meaningful image has descriptive alt text. Decorative images use `alt=""`.
- **Motion:** all animations and transitions respect `prefers-reduced-motion`. No animation is required for usability.
- **Font size:** body text minimum `16px` (1rem). No text below `14px` on any content area.
- **Semantic HTML:** sections use correct landmark elements (`<header>`, `<main>`, `<section>`, `<nav>`, `<footer>`). No `<div>` soup for structural content.
- **Headings:** one `<h1>` per page, logical heading hierarchy throughout.
- **Link text:** no "click here" or "read more" links. Link text must describe the destination.
- **Forms:** all form inputs have associated `<label>` elements. Error messages are descriptive.
- Accessibility is validated with automated tooling (axe, Lighthouse) and manual keyboard testing before any section is marked complete.

---

## 10. Performance-First Image Strategy

Images are the primary performance risk on the homepage. Every image decision has a performance implication.

**Strategy:**
- All images are served via `next/image` (`<Image />`) which enforces WebP/AVIF, lazy loading, and responsive `srcset` by default.
- Screenshots are exported at **2x (retina) resolution** and compressed to WebP. No uncompressed PNG for production.
- Hero and above-the-fold images use `priority` prop on `<Image />` to preload. All others are lazy-loaded.
- Maximum image file sizes: hero background `< 200KB`, section screenshots `< 150KB` each, photography `< 250KB`.
- No images wider than their display container. Use `sizes` prop on `<Image />` to reflect actual display width.
- No base64-embedded images in CSS or JSX for anything above `1KB`.
- All images have defined `width` and `height` (or `fill` with a sized container) to prevent layout shift (CLS = 0 target).
- No `<img>` tags — only `<Image />` from `next/image`.
- Lighthouse Performance score target: **≥ 90** on desktop, **≥ 75** on mobile before homepage is considered ready.
- Image assets live in `/public/images/homepage/` with a flat, descriptive naming convention: `{section}-{descriptor}-{variant}.webp` (e.g., `hero-dashboard-desktop.webp`).

---

## Approval Checklist

Before any homepage section implementation begins, confirm:

- [ ] Brand personality reviewed and approved
- [ ] Emotional direction arc reviewed and approved
- [ ] Storytelling rules reviewed and approved
- [ ] Screenshot philosophy reviewed and approved
- [ ] Photography rules reviewed and approved
- [ ] White-space philosophy reviewed and approved
- [ ] Iconography rules reviewed and approved
- [ ] Illustration policy reviewed and approved
- [ ] Accessibility standards reviewed and approved
- [ ] Performance-first image strategy reviewed and approved
- [ ] **Full Design Philosophy approved — Hero section may now begin**
