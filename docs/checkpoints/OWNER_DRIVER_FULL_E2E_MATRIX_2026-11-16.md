# XDrive Owner Driver: complete shell audit / E2E matrix

Date: 16 November 2026. Branch: `recovery/pr807-owner-cx-20261116`. Local QA: `http://127.0.0.1:5301`.

## Result and scope
**GO for continued isolated QA; NO-GO for claiming full transactional E2E.** All tests were read-only against a preview connected to XDrive Production Supabase. Business mutations and money transfers were not performed.

- Discovered **43 routes** (39 static and 4 dynamic).
- **39/39 static routes loaded** using an authenticated browser. Post Load had one navigation abort in a mass sweep; an isolated retest succeeded with HTTP 200 and 110 visible controls.
- **1152 visible controls** inventoried (many shared shell duplicates). **49 safe tab/menu clicks** performed. Inventory and clicks are not proof of persistent function.
- **Action Centre 8/8 read-only tests PASS:** 16 actions, five open, date/view filters, Refresh and DB68930A Open details navigation.
- No authenticated business-state write or payment E2E was performed; no Production deployment, main merge or DB migration.

## Static route matrix
| Route | Authenticated page load | Visible controls | Safe interactions |
|---|---|---:|---:|
| `/driver` | PASS_RENDER | 33 | 1 |
| `/driver/account` | PASS_RENDER | 17 | 0 |
| `/driver/account/legal-agreements` | PASS_RENDER | 23 | 0 |
| `/driver/account/profile` | PASS_RENDER | 17 | 0 |
| `/driver/action-centre` | PASS_RENDER | 25 | 7 |
| `/driver/availability` | PASS_RENDER | 28 | 0 |
| `/driver/availability/live` | PASS_RENDER | 40 | 0 |
| `/driver/change-password` | PASS_RENDER | 23 | 0 |
| `/driver/directory` | PASS_RENDER | 40 | 0 |
| `/driver/documents` | PASS_RENDER | 22 | 0 |
| `/driver/drivers` | PASS_RENDER | 17 | 0 |
| `/driver/drivers-vehicles` | PASS_RENDER | 24 | 0 |
| `/driver/event-log` | PASS_RENDER | 30 | 0 |
| `/driver/finance` | PASS_RENDER | 32 | 7 |
| `/driver/fleet` | PASS_RENDER | 17 | 0 |
| `/driver/freight-vision` | PASS_RENDER | 36 | 0 |
| `/driver/history` | PASS_RENDER | 49 | 9 |
| `/driver/jobs` | PASS_RENDER | 37 | 8 |
| `/driver/load-alerts` | PASS_RENDER | 33 | 0 |
| `/driver/loads` | PASS_RENDER | 45 | 1 |
| `/driver/loads/directory` | PASS_RENDER | 17 | 0 |
| `/driver/loads/search` | PASS_RENDER | 45 | 0 |
| `/driver/messages` | PASS_RENDER | 18 | 1 |
| `/driver/more` | PASS_RENDER | 17 | 0 |
| `/driver/nearby` | PASS_RENDER | 41 | 0 |
| `/driver/network` | PASS_RENDER | 23 | 0 |
| `/driver/notifications` | PASS_RENDER | 24 | 0 |
| `/driver/official-pwa-live` | PASS_RENDER | 17 | 0 |
| `/driver/post-load` | PASS_RENDER_RETEST | 110 | 1 |
| `/driver/profile` | PASS_RENDER | 25 | 0 |
| `/driver/quotes` | PASS_RENDER | 33 | 5 |
| `/driver/reports` | PASS_RENDER | 24 | 0 |
| `/driver/returns` | PASS_RENDER | 39 | 1 |
| `/driver/settings` | PASS_RENDER | 24 | 7 |
| `/driver/settings/billing` | PASS_RENDER | 24 | 0 |
| `/driver/support` | PASS_RENDER | 27 | 0 |
| `/driver/vehicle-readiness` | PASS_RENDER | 19 | 0 |
| `/driver/vehicles` | PASS_RENDER | 18 | 1 |
| `/driver/won-work` | PASS_RENDER | 19 | 0 |

## Dynamic detail route matrix
| Route pattern | Initial deep data gate | Notes |
|---|---|---|
| `/driver/jobs/[id]` | FAIL_STUCK_LOADING | Originally stuck >18 s in job loading; separate longer browser trace completed; code fix in ecd52689, browser retest base job details loaded |
| `/driver/loads/[id]` | RENDERED_DETAIL_CONTENT | HTTP 200; initial deep check ended while load body was still loading |
| `/driver/finance/invoices/[id]` | RENDERED_DETAIL_CONTENT | Real invoice detail loaded |
| `/driver/finance/invoices/[id]/edit` | RENDERED_DETAIL_CONTENT | Invoice edit form displayed real data |

## Full clickable control inventory
**File:** `C:\Users\xdriv\Desktop\XDrive-PR807-CX-Recovered-Preview-20261116\_audit\pr807-e2e-20261116\ALL_VISIBLE_CONTROLS.csv`

For each initially visible a/button/input/select/textarea/summary/role button or tab, the file records route, element, role, label, href, type, disabled state, available options and truthful verification class. `INVENTORIED_ONLY` / `PERSISTENT_ACTION_UNTESTED` are explicitly **NOT PASS**. Nested menus, popovers, modal steps, state-dependent actions, keyboard-only controls, drag/drop, file pickers and missing-data screens remain to be fully exercised.

## Business workflows still requiring persisted E2E evidence
1. **Post Load / Book Direct:** field-by-field validation, route/mileage/prices, vehicle capacity, draft/submit/duplicate rejection, owner/carrier role and delivery of an actual published booking.
2. **Loads:** categories, filters, search, Load Details, Quote Now modal, accepted/declined/withdrawn and other company/driver isolation.
3. **Quotes:** every state, submission, revision, acceptance/decline, price propagation, notifications and audit history.
4. **My Jobs:** assignment, on my way, arrival, loaded, in transit, delivered, multi-drop, Undo, execution milestones and booking-sheet verification.
5. **Diary:** every filter, paging, sorting, list/calendar, job detail, feedback, POD, download and invoice actions in real/empty/error states.
6. **Action Centre:** every event type/CTA, persistence and server-side stale failure handling.
7. **POD:** photo uploads, recipient signature, hard-copy requirement, date/time, failed requests, drafts, archived record and double-click safety.
8. **Finance/Stripe:** PDF/VAT 0/5/20%, invoices, mail send, payment status and webhook reconciliation with Stripe TEST MODE ONLY.
9. **Other shell:** Directory, Availability, Fleet, Return Journeys, Messages, Notifications, Account, Settings, More, Support, Documents, Reports; desktop/tablet/mobile, accessible keyboard, role permissions, error states.

## Safety and blockers
The available Supabase branch snapshots report MIGRATIONS_FAILED; the authorized Windows machine lacks Supabase CLI, Docker and psql. The local Next preview points to an existing production dataset, so real transactions cannot be treated as disposable fixtures. Establish a separate, verified non-Production DB + Stripe test-mode before allowing automated commercial writes.

## Evidence locations
- `action-centre-readonly.json` in the QA evidence folder
- `route-controls-batch1.json` in the QA evidence folder
- `route-controls-batch2.json` in the QA evidence folder
- `route-controls-postload.json` in the QA evidence folder
- `dynamic-detail-deepcheck.json` in the QA evidence folder
- `job-detail-network-diagnostic.json` in the QA evidence folder
- `ALL_VISIBLE_CONTROLS.csv` in the QA evidence folder
- `FULL_E2E_SUMMARY.json` in the QA evidence folder

## Final DB68930A progressive-render retest

- Local recovery branch commit: `ecd52689`, updated file `app/components/workspace/DriverJobExecutionPage.tsx`, changes limited to rendering authorized booking base data before optional `/sheet` and `/driver/web/jobs` enrichments; multi-stop readiness remains fail-closed.
- Authenticated Edge/Playwright test deliberately delayed both optional auxiliary API requests by 9,500 ms; actual booking header, reference, transport details and POD section became visible after **6,830 ms**, before delayed requests completed. `loadingGone=true`, `hasRealReference=true`, `hasTransportData=true`, `hasPodSection=true`, `showsPodStatus=true`, JS errors = 0, business writes = 0.
- Reproducible browser QA evidence stored in `_audit/pr807-e2e-20261116/job-progressive-gate.json` and screenshot `job-progressive-after-fix.png` under the C: preview worktree.
- Targeted TypeScript: zero errors; ten PR807 recovery static assertions pass.
- These proofs do **not** complete stateful POD/Invoice/Stripe E2E, which require isolated non-Production DB and test credentials. Do not conflate initial-state control inventory with validation of all actions.
