# Social page-faithful previews

Scope: public social sharing only.

- Social image URLs are page-specific and versioned to avoid stale crawler cache reuse.
- Pricing preview mirrors the live Pricing page visual and real plan prices.
- Shared marketing-page previews mirror the live MarketingDetailPage structure: XDrive header/navigation, Early Access band, real page kicker/title/intro, CTA treatment and page-specific flow cards.
- No middleware, auth, Supabase, billing, Stripe, protected workspace or unrelated production behavior is changed.
- Visible share platforms remain Facebook, LinkedIn, WhatsApp, Instagram, TikTok and Email only.
- Release gate: canonical Netlify exact-head deploy preview. GitHub Actions is not used as a gate.
