# XDrive Brand Master Pack Integration - 2026-10-30

AGENT PREFLIGHT
Target product: WEB
Scope document: docs/agent-scopes/web.md
Base branch: main
HEAD SHA: 3aae85baf8b7f01d834e91834c8ff4a21e82beb2

Intended file list
- public/xdrive-logo-primary.svg - canonical scalable website logo
- public/xdrive-mark.svg - canonical XD logomark
- public/favicon.svg - vector favicon
- public/favicon.ico - generated multi-size favicon if tooling supports it; otherwise existing ICO retained
- public/apple-touch-icon.png - Apple touch icon generated from canonical mark
- public/icon-192.png - PWA icon
- public/icon-512.png - PWA icon
- public/icons/* - PWA any/maskable icon set
- public/manifest.webmanifest - PWA manifest
- public/safari-pinned-tab.svg - Safari pinned tab
- public/browserconfig.xml - Windows tile metadata
- public/brand/* - canonical brand vectors and tokens
- public/og-xdrive-1200x630.png - Open Graph image
- app/layout.tsx - metadata / manifest / icon references only

Allowlist
- public/**
- app/layout.tsx
- AUTONOMOUS_EXECUTION_CHECKPOINT.md

Denylist
- supabase/**
- database/**
- middleware.ts
- package.json
- package-lock.json
- .github/workflows/**

Shared-contract impact
- Root package.json: no
- Root lockfile: no
- middleware.ts: no
- Supabase migrations: no
- Shared lib helpers: no
- GitHub Actions workflows: no

Required checks
- protected workspace invariant PowerShell gate
- npm run lint
- npm run typecheck
- npm run test:unit
- npm run build
- direct inspection of generated assets and manifest

Production safety
- Supabase migration applied to production: NO
- Production data operation: NO

Mobile source boundary
- Current main does not contain historical apps/driver-mobile or android-native source trees. This task integrates the shared web/PWA brand assets that exist in current main and will not fabricate a native-app source integration.


## 2026-10-30 follow-up: dynamic Open Graph + native source audit

Base main before follow-up: d555ee890fa2f5336001cb4bf7d6a04d2c88defe

Additional intended files
- app/social-page/[page]/opengraph-image.tsx - use Master Pack logo and official palette
- app/social/[visual]/opengraph-image.tsx - use Master Pack logo/mark and official palette
- app/api/social-card/route.tsx - use Master Pack mark and official palette

Native source audit evidence
- GitHub repositories visible for XDrive: xdrivelogistics.co.uk, xdrivelogistics, app.xdrivelogistics.co.uk.
- Current main of xdrivelogistics.co.uk has no apps/driver-mobile or android-native source trees.
- D:\XDrive-Native-Reconstruction-20261024 is not a git repository and its audit explicitly states it is an offline reconstruction prototype, not the authoritative native source.
- Installed OPPO package evidence: co.uk.xdrivelogistics.driver.nativepreview.testlab; APK backup at D:\XDrive-OPPO-Installed-Apk-Audit\base.apk.
- Decompiled Java is reference-only, not buildable original Kotlin source.
- No authoritative iOS source was identified in connected GitHub repositories or targeted local searches.
- Therefore native Android/iOS branding must not be claimed integrated until authoritative buildable source is recovered.

Follow-up checks required
- protected invariant gate
- lint
- typecheck
- production build
- deploy to main
- live fetch/visual verification of dynamic Open Graph image


Follow-up verification results
- protected invariant gate: PASS
- npm run lint: PASS
- npm run typecheck: PASS
- npm run build: PASS (BUILD_EXIT=0)
- dynamic OG routes compile as edge routes
- full unit suite is known to contain unrelated baseline failures from the preceding brand integration run; no OG-specific unit suite exists, so live runtime rendering is the acceptance test for this follow-up.

Final social-card renderer remediation
- Root cause of /api/social-card 500: Satori/ImageResponse rejected width: fit-content and a mixed text/span div without explicit flex display.
- Remediation: replaced fit-content with alignSelf:flex-start and added explicit display:flex to mixed text/span footer.
- Local runtime verification:
  - /social-page/home/opengraph-image: HTTP 200
  - /social/platform/opengraph-image: HTTP 200
  - /api/social-card?...: HTTP 200
- Visual inspection: canonical XD mark, XDrive Logistics branding, official navy/blue/orange palette rendered correctly.
- Post-remediation protected gate: PASS
- Post-remediation lint: PASS
- Post-remediation typecheck: PASS
- Post-remediation production build: PASS (BUILD_EXIT=0)
