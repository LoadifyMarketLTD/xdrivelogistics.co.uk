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
