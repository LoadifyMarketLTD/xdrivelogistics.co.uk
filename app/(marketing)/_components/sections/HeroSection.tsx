import Image from 'next/image';
import Link from 'next/link';
import { Fragment } from 'react';
import { ArrowRight } from 'lucide-react';

const TRUST_INDICATORS = [
  {
    label: 'Built for UK haulage',
    sub: 'Compliant with UK operator requirements',
  },
  {
    label: 'End-to-end workflow',
    sub: 'Marketplace to invoicing in one platform',
  },
  {
    label: 'No spreadsheets',
    sub: 'Replace fragmented tools with one system',
  },
  {
    label: 'Approval-gated access',
    sub: 'Every operator is reviewed before onboarding',
  },
] as const;

export function HeroSection() {
  return (
    <section
      aria-label="Hero"
      className="relative min-h-dvh overflow-hidden bg-xd-bg-primary"
      id="platform"
    >
      {/* ── Background layers (CSS-only, no images) ───────────────────── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {/* Primary radial glow — brand blue, right-of-centre */}
        <div
          className="absolute"
          style={{
            left: '75%',
            top: '45%',
            width: 700,
            height: 700,
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            background:
              'radial-gradient(circle, rgba(47,107,255,0.09) 0%, transparent 70%)',
          }}
        />
        {/* Secondary radial glow — deep indigo, upper-left */}
        <div
          className="absolute"
          style={{
            left: '20%',
            top: '25%',
            width: 500,
            height: 500,
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            background:
              'radial-gradient(circle, rgba(80,50,180,0.05) 0%, transparent 70%)',
          }}
        />
        {/* Fine noise texture overlay */}
        <svg
          className="absolute inset-0 h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
          style={{ opacity: 0.035 }}
        >
          <filter id="xd-hero-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#xd-hero-noise)" />
        </svg>
        {/* Subtle horizontal scan line at 55% height */}
        <div
          className="absolute inset-x-0"
          style={{
            top: '55%',
            height: 1,
            background: 'rgba(47,107,255,0.06)',
          }}
        />
        {/* Bottom gradient fade to next section */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: 120,
            background:
              'linear-gradient(to bottom, transparent, var(--xd-bg-secondary))',
          }}
        />
      </div>

      {/* ── Content grid ─────────────────────────────────────────────── */}
      <div
        className="xd-container relative flex min-h-dvh flex-col justify-center"
        style={{
          paddingTop:
            'calc(var(--xd-nav-height) + var(--xd-section-py-hero))',
          paddingBottom: 'var(--xd-sp-30)',
        }}
      >
        <div className="grid items-center gap-[var(--xd-sp-24)] lg:grid-cols-2">

          {/* ════════════════════════════════════
              LEFT COLUMN
          ════════════════════════════════════ */}
          <div style={{ maxWidth: 620 }}>

            {/* Eyebrow badge — Phase 1 */}
            <div className="xd-hero-phase-1">
              <span className="xd-hero-eyebrow">
                <span className="xd-hero-eyebrow__dot" />
                Now in Early Access — UK transport operators
              </span>
            </div>

            {/* H1 Headline — Phase 1 */}
            <h1
              className="xd-hero-phase-1 mt-4 tracking-[-0.02em] text-xd-text-dp"
              style={{
                fontFamily: 'var(--xd-font-family)',
                fontSize: 'clamp(2.25rem, 5vw, var(--xd-h1-size))',
                lineHeight: 'var(--xd-h1-line)',
                fontWeight: 'var(--xd-h1-weight)',
                maxWidth: 620,
              }}
            >
              One platform for the entire{' '}
              <br className="hidden md:block" />
              logistics operation.
            </h1>

            {/* Subheadline — Phase 1 */}
            <p
              className="xd-hero-phase-1 mt-6 text-xd-text-ds"
              style={{
                fontFamily: 'var(--xd-font-family)',
                fontSize: 'var(--xd-body-l-size)',
                lineHeight: 'var(--xd-body-l-line)',
                fontWeight: 'var(--xd-body-l-weight)',
                maxWidth: 560,
              }}
            >
              From job marketplace to proof of delivery, driver compliance to
              automated invoicing — XDrive connects every part of your
              transport operation in one place.
            </p>

            {/* CTAs — Phase 4 */}
            <div className="xd-hero-ctas xd-hero-phase-4 mt-10">
              <Link href="/register" className="xd-btn xd-btn--primary">
                Request Access
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href="#workflow" className="xd-btn--ghost-arrow">
                See how it works
                <span className="xd-btn-arrow" aria-hidden="true">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </a>
            </div>

            {/* Trust indicator strip — Phase 4 */}
            <div className="xd-trust-strip xd-hero-phase-4 mt-12">
              {TRUST_INDICATORS.map((item, i) => (
                <Fragment key={item.label}>
                  {i > 0 && (
                    <div
                      className="xd-trust-strip__divider"
                      aria-hidden="true"
                    />
                  )}
                  <div>
                    <span className="xd-trust-item__label">{item.label}</span>
                    <span className="xd-trust-item__sub">{item.sub}</span>
                  </div>
                </Fragment>
              ))}
            </div>
          </div>

          {/* ════════════════════════════════════
              RIGHT COLUMN — Product Composition
          ════════════════════════════════════ */}
          <div className="relative">

            {/* Primary panel — Dispatcher / Job Board (Phase 2) */}
            <div className="xd-panel-primary xd-hero-phase-2 relative">
              <div className="xd-browser-frame">
                {/* macOS traffic-light chrome */}
                <div className="xd-browser-chrome" aria-hidden="true">
                  <span className="xd-browser-chrome__dot xd-browser-chrome__dot--red" />
                  <span className="xd-browser-chrome__dot xd-browser-chrome__dot--amber" />
                  <span className="xd-browser-chrome__dot xd-browser-chrome__dot--green" />
                </div>
                {/* Screenshot — 5:3 aspect ratio */}
                <div
                  className="relative w-full xd-panel-primary-clip"
                  style={{ aspectRatio: '5/3' }}
                >
                  <Image
                    src="/hero-dispatch-control.webp"
                    alt="XDrive Dispatcher Job Board showing multiple active jobs with driver assignments, status badges, and UK route details"
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover object-top"
                  />
                </div>
              </div>

              {/* Workflow Status Badge — overlaid bottom-right of primary panel */}
              <div className="xd-workflow-badge xd-hero-phase-4" aria-label="Platform workflow overview">
                <div className="xd-workflow-badge__steps">
                  <span>Marketplace</span>
                  <span className="xd-workflow-badge__arrow" aria-hidden="true">→</span>
                  <span>Dispatch</span>
                  <span className="xd-workflow-badge__arrow" aria-hidden="true">→</span>
                  <span>POD</span>
                  <span className="xd-workflow-badge__arrow" aria-hidden="true">→</span>
                  <span>Invoice</span>
                </div>
                <p className="xd-workflow-badge__sub">Full workflow — one platform</p>
              </div>
            </div>

            {/* Secondary panels row — hidden below 768 px via CSS */}
            <div className="xd-secondary-row">

              {/* Panel 2A — Marketplace / Job Creation (Phase 3a) */}
              <div
                className="xd-panel-secondary xd-browser-frame xd-hero-phase-3a"
                style={{ flex: '31 31 0', minWidth: 0 }}
              >
                <div className="relative" style={{ aspectRatio: '4/3' }}>
                  <Image
                    src="/marketplace-loading.webp"
                    alt="XDrive job marketplace showing transport job creation form with collection and delivery address fields"
                    fill
                    sizes="(max-width: 1024px) 33vw, 17vw"
                    className="object-cover object-top"
                  />
                </div>
              </div>

              {/* Panel 2B — Driver Mobile App (Phase 3b) */}
              <div
                className="xd-panel-mobile xd-mobile-frame xd-hero-phase-3b"
                style={{ flex: '28 28 0', minWidth: 0 }}
              >
                <div className="relative" style={{ aspectRatio: '9/16' }}>
                  <Image
                    src="/xdrive-driver-workspace-real.webp"
                    alt="XDrive driver mobile app showing an active job card with Accept, Navigate and POD action buttons"
                    fill
                    sizes="(max-width: 1024px) 28vw, 14vw"
                    className="object-cover object-top"
                  />
                </div>
              </div>

              {/* Panel 2C — Finance / Invoice (Phase 3c) */}
              <div
                className="xd-panel-secondary xd-browser-frame xd-hero-phase-3c"
                style={{ flex: '31 31 0', minWidth: 0 }}
              >
                <div className="relative" style={{ aspectRatio: '4/3' }}>
                  <Image
                    src="/xdrive-finance-records-real.webp"
                    alt="XDrive finance view showing a generated invoice with job reference, GBP amount, company name and payment status"
                    fill
                    sizes="(max-width: 1024px) 33vw, 17vw"
                    className="object-cover object-top"
                  />
                </div>
              </div>

            </div>
          </div>
          {/* end right column */}

        </div>
      </div>
    </section>
  );
}

