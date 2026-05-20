# XDrive Logistics — Product & Technical Roadmap

This roadmap captures practical next steps inspired by the older repository review, while keeping `xdrivelogistics.co.uk` as the production source of truth.

## 1) Frontend Structure Cleanup (Incremental)
- Standardize reusable UI and section boundaries under `app/(marketing)/_components/{ui,sections}`.
- Expand shared client logic in `app/hooks` (contact links, common mobile interactions).
- Continue moving repeated legal/content strings to `app/config/company.ts`.

## 2) Driver UX Simplification
- Evolve `/driver` into a mobile-first quick action hub (Active Jobs, History, Earnings, Jobs).
- Keep existing `/driver/jobs` flow stable while reducing taps for core actions.
- Add lightweight in-app guidance for first-time drivers.

## 3) Auth & Security Hardening
- Add optional MFA for owner/admin roles.
- Introduce stricter session observability (login anomaly alerts, audit-ready event trails).
- Extend route and role verification test coverage around protected paths.

## 4) Documentation Workflow
- Keep legal/contact values aligned with `COMPANY_CONFIG` as canonical source.
- Maintain one release checklist for contact consistency, route protection, and regression checks.
- Continue using focused, production-safe incremental refactors instead of broad rewrites.
