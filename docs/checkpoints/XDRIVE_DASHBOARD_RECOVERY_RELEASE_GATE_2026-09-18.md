# XDrive Dashboard Recovery - Final Release Gate

Date: 2026-09-18
Branch: hotfix/fleet-compliance-dashboard-20260917
Validated final merge SHA: b0529f46d313f1595c33bfec3265380d0c28fd23
Latest main integrated: 1d88544cc7f02e5f114dc8665a3e912a03c972f9

## Release-gate result

PASS for the combined web-platform branch.

The dashboard recovery branch now includes the current remote main, including the CSP/auth fixes and the later Customer, Driver, POD, invoice and collection-handover changes.

## Static / compile gates

- Global ESLint: PASS
- TypeScript tsc --noEmit: PASS
- git diff --check: PASS
- Next.js production build: PASS
- Next.js version: 15.5.25
- Static pages generated: 168/168
- Protected workspace CSP nonce contract: PASS

The static-page count is intentionally lower than earlier builds because protected Admin, Broker, Customer and Driver workspace layouts render dynamically so request-specific CSP nonces can be applied safely.

## Web contract gate

- Test files: 256/256 PASS
- Tests: 1777/1777 PASS

The web gate excludes only suites that require Android/Expo source trees absent from this web-only clone.

## Operational workflow gate

20 suites / 107 tests PASS covering:

- Post Load
- Marketplace quote guards
- Customer quote comparison
- Award authority and lifecycle integrity
- Fleet operational eligibility and double-booking guard
- Server-authoritative dashboard mutations
- Driver assigned-job presentation and job-action lifecycle
- POD truth and Platform Owner POD review
- Invoice generation and canonical invoice states
- Invoice register truth
- Customer invoice projection
- Payment terms
- Driver finance invoice contract

## Current main features preserved during reconciliation

The true remote main was 14 commits ahead of the earlier local tracking ref. All were integrated:

- aab2a3d2 - Customer notifications and load actions
- 78b5122b - Customer diary booking action
- 255bef95 - Customer disputes route access
- a58e6a63 - Customer messages/event-log access
- 2e91fb7d - Driver mobile booking commercial presentation
- 4587ea1b - Driver stage navigation with Google Maps/Waze
- 0bad0f2b - Driver POD staged evidence confirmation
- 952b20a2 - Auto invoice POD snapshot
- 38b66a72 - Finance events removed from Driver Alerts
- 6fe9330d - Secure Driver mobile documents
- de497d86 - Explicit Driver job acceptance
- db85d4ad - Structured Driver collection handover
- d1c00104 - Netlify retry after clean build
- 1d88544c - Migration encoding fix for Netlify release gate

The merge had three conflict zones. They were manually reconciled rather than resolved with blanket ours/theirs:
- Workspace notifications API
- Workspace notification inbox
- Customer operational page changes

The final notification solution preserves server authority and also supports the newer unread-count/root actions required by current main.

## Dependency security

npm audit: 0 vulnerabilities.

- critical: 0
- high: 0
- moderate: 0
- low: 0

Validated dependency versions include:
- Next.js 15.5.25
- PostCSS 8.5.28
- Sharp 0.35.4
- Nanoid 3.3.19

## Migration encoding gate

- SQL migrations with UTF-8 BOM: 0
- Dashboard job-document migration BOM removed
- Current main collection-handover migration included
- Netlify migration-encoding failure pattern not present in this branch

Relevant dashboard migration:
20260917175510_align_job_documents_canonical_contract_20260917.sql

Production already records migration version 20260917175510. The source encoding correction does not reapply or change SQL semantics.

## Server-authority remediation completed

Critical browser writes were moved behind authenticated server routes for:

- Driver / Vehicle deletion
- Company registration and membership creation
- Admin commercial quotes
- Job document persistence
- Admin Job creation / editing / Exchange visibility
- Driver bid withdrawal
- Driver notifications
- Shared Customer / Broker / Admin notifications
- Finance invoice create / edit

## Fleet / readiness

- Canonical Driver operational readiness remains server-authoritative.
- Fleet Manager uploads evidence but cannot approve own compliance.
- Driver + canonical active Vehicle allocation is revalidated server-side.
- Fleet degraded states expose partial/unavailable document truth rather than fabricated green states.
- Fleet/workspace hook dependencies are stable and prior hook warnings are closed.

## Reconciled regression guards

Two legacy contract assertions were updated after current main changed the architecture intentionally:

1. Carrier/Fleet navigation now verifies unread notification counts through the server-authoritative /api/workspace/notifications?mode=count endpoint rather than requiring a browser-side notifications table query.
2. Storage evidence path testing now recognises staged collection/stop folders while preserving the company/job first two path segments required by RLS.

Both updated contracts pass.

## Scope boundaries

1. This checkpoint does not claim Android/Expo application validation. Native-only suites requiring source trees absent from this clone are outside this web release gate.
2. No destructive production E2E was executed against real users, jobs, invoices, PODs or memberships.
3. Ambiguous/inactive profiles without verifiable company membership were deliberately not auto-repaired or assigned invented roles.
4. Local static build warns that SUPABASE_SERVICE_ROLE_KEY is not present locally; admin operations therefore remain disabled during static generation. This is expected and not a compile failure.
5. Next.js reports that its ESLint plugin is not detected in the current ESLint configuration; the project-wide ESLint command itself passes.
6. This branch includes current main but is not yet merged back into main.

## Evidence summary

- Global lint: PASS
- Typecheck: PASS
- Web test files: 256/256 PASS
- Web tests: 1777/1777 PASS
- Operational workflow tests: 107/107 PASS
- npm audit: 0 vulnerabilities
- Migration BOM scan: 0
- Production build: PASS
- Static generation: 168/168
