# XDrive Mobile Web Release Gate — 2026-09-04

## Scope

This gate covers the responsive web platform served from `www.xdrivelogistics.co.uk` on a mobile browser. It does **not** merge or alter `/super-admin`, and it does **not** claim parity for the separate Expo/Android app under `apps/driver-mobile`.

Canonical baseline: `main` at `00b87880b4723185b0b5d2909005660795be3da6`.

## What is already shared automatically between desktop and mobile web

The mobile browser uses the same Next.js application and routes as desktop. Functional changes merged to `main` therefore exist on both desktop and mobile web unless a responsive/UI defect prevents access or use.

Examples currently covered by the same route/runtime on mobile web:
- authenticated workspace navigation;
- `/settings/billing`;
- Driver / Owner Driver workspace;
- Customer workspace;
- Broker workspace;
- Carrier / company workspace;
- Fleet / operations surfaces;
- public login/register/contact/privacy/subscription terms routes.

## Existing responsive foundations verified in source

- `WorkspaceShell.module.css` collapses multi-column workspace/settings layouts under 820px and adjusts page/KPI spacing under 560px.
- Driver, Customer and Broker surfaces have role-specific responsive media rules.
- `playwright.config.ts` already includes a `mobile-safari` project using iPhone 13 emulation.
- `e2e/workspace-visual-auth-gate.spec.ts` validates role fixtures at 390x844, but explicitly is not authenticated-runtime proof.

## New release gate added on this branch

`e2e/mobile-web-release-gate.spec.ts` adds a dedicated 390x844 mobile web gate that checks:

1. Public routes load without 5xx responses.
2. Public routes do not create document-level horizontal overflow.
3. Failed network requests fail the gate.
4. Deterministic role fixtures for carrier, broker, customer, driver, fleet and operations remain usable at 390px when `E2E_VISUAL_FIXTURE=true`.
5. Workspace navigation remains visible and scrollable when its content exceeds the viewport.
6. Notifications remain reachable in the mobile workspace shell.

## Authenticated-runtime gate still required

A complete Production PASS must additionally exercise real authenticated sessions for commercial roles. This requires approved test credentials/session provisioning and must verify at minimum:

- Driver / Owner Driver: dashboard, More menu, Membership & Billing, Jobs, Quotes, Messages, Vehicle, Documents, Invoices, Notifications, Account.
- Customer: dashboard, loads, quotes, bookings/tracking, disputes, account, Membership & Billing.
- Broker: dashboard, enquiries/loads/quotes/jobs, directory/customers, disputes/finance/account, Membership & Billing.
- Company owner/admin / carrier: operational workspace, finance/account/settings, Membership & Billing.
- Fleet/operations: role navigation, job/driver operational surfaces and mobile overflow/interaction behavior.
- Forms/modals: keyboard-safe layout, touch targets, scroll containment, fixed/sticky controls and no blocked primary actions.
- Billing: terms checkbox, Add payment method, redirect to Stripe Checkout, return to `/settings/billing`, portal access once a Stripe Customer exists.

Authenticated runtime must not be declared PASS from fixture screenshots alone.

## Separate native Driver app

The Expo/Android app is a separate runtime. Existing repo documentation still marks some native-mobile functions as partial/missing (quote lifecycle backend, booking/POD segmentation, persisted preferences and related wiring). Those gaps are not hidden by a mobile-web PASS and need their own release gate.

## Release policy

- No automatic merge to `main` from this audit branch.
- No visual changes to `/super-admin`.
- No fabricated jobs, activity, users or transactions.
- Mobile web PASS requires both structural/fixture checks and authenticated real-route verification.
