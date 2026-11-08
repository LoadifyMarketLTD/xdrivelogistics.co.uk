# XDRIVE LOGISTICS — MASTER 3150 EXECUTION BLUEPRINT

**Status:** Mandatory owner-approved work method, 8 November 2026. **Audience:** every agent inheriting Master Workspace implementation or verification in any future chat. **Purpose:** deliver approved original 3150, not a visual approximation, on the eight in-scope tabs across all seven desktop workspaces, while preserving the operational platform.

> **Non-negotiable:** The owner has repeatedly requested **REPLACE the legacy page with the ACTUAL approved 3150 components and complete behavior, not rebuild it from memory**. A matching sidebar or card does **not** constitute parity. An HTTP 200, a successful build, or an unassertive Playwright test is **not** a delivery. Every button, modal, tab, field, route, workflow and backend permission must be verified **in Opera and in PowerShell** on LIVE, not merely on a local demo.

## 0. Instruction precedence and safety

1. The user's **latest explicit instructions**, root `AGENTS.md`, `docs/CURRENT_AGENT_EXECUTION_POLICY_2026-11-04.md`, and the latest verified `origin/main` state govern execution. This blueprint is the latest **task-specific** specification for these eight tabs; it does not override security protections or authorize unrelated work.
2. Approved visual/behavioral source: `http://127.0.0.1:3150/try-xdrive-company-demo` and **the source files that render it** (`app/try-xdrive-demo/components/` plus its styles). Screenshots are supporting evidence, not substitute source code. The original demo dataset is NOT a live data source.
3. Production target: `https://www.xdrivelogistics.co.uk`; repo: `LoadifyMarketLTD/xdrivelogistics.co.uk`, branch `main`; Netlify production deploy must be verified at the exact commit SHA.
4. **Strict scope of eight sidebar tabs ONLY:** Dashboard; Post Load; Loads; Quotes; Bookings; My Fleet; Drivers; Diary. The **other nine tabs are outside scope**: Invoices, Network & Tools, Directory, Live Availability, Return Journeys, Freight Vision, Messages, Notifications, Reports. Their assets, routes, workflows and code must not be modified under this task. Do not modify shared code in a way that changes those nine tabs.
5. **ABSOLUTELY DO NOT TOUCH THE APPROVED STANDALONE DRIVER PWA 1099**: no modifications, tests that change its state, assets, routes, configuration, reimplementation, deployment changes or additions. The **desktop Owner Driver / Company Driver workspaces** may be included in their eight approved tabs; these are distinct from standalone PWA1099. Guard paths before staging/committing.
6. Keep all real XDrive production data, existing RLS, approved Post Load behavior, Company/Carrier permissions, archived documents, and all business operations. No fictional jobs/quotes/bookings, demo service accounts, fabricated locations or placeholder IDs in LIVE. Preserve in-production workflow and visual state until replacement is validated.
7. GitHub Actions remain disabled; PowerShell local tests are required. No force-push, destructive reset, disabling tests, changing production schema/RLS, copying service-role keys into client bundles, or synthetic production CRUD as a shortcut. Production E2E is read-only unless explicitly separately authorized with isolated, controlled transactions and cleanup rules.
8. If the original 3150 UI and current security/API implementation conflict, **preserve the original UI behavior and current secure backend semantics**; implement an adapter or make the discrepancy explicit. Never gain PASS by removing a protection, suppressing a button without review, or hiding an unfinished backend.

## 1. Seven desktop workspaces; one shared component system

| Workspace | In scope | RBAC characteristics to prove |
| --- | --- | --- |
| Company / Carrier | Eight tab presentation; permitted routes and features | Company load creation, quoting, awarding where authorized; driver/vehicle allocation, fleet management |
| Customer / Shipper | Same component design; correct Customer semantics | Create/manage own loads, receive/manage quotes, award, monitor bookings, only own company data |
| Broker | Same original design; brokerage permissions | Broker load/quote/award/booking flow, member role and company-boundary restrictions |
| Fleet Manager / Carrier | Same original design | Fleet, drivers, dispatch/quotes on behalf of company only where authorized |
| Dispatcher | Same original design | Post load/quote/award/booking/diary/assignment as authorized; no unauthorized administration |
| Owner Driver (desktop) | Same original design | Quote in own/company capacity, own fleet/vehicle and bookings; authorized posting; separate from standalone PWA 1099 |
| Company Driver (desktop) | Same original design for authorized screens | Quote in company name when permitted; sees assigned work; cannot post loads or obtain company admin privileges |

**Role policy:** same canonical components, layouts, nav, forms and detail modals. Only accessible data, actions, enabled/hidden states and relevant role-specific text differ under RBAC. Do not create seven copies of each page, seven different modal implementations, or a second visual identity. For roles without an operation, show the approved restricted/disabled/omitted action consistently; never fabricate a success path.

## 2. Eight-tab feature and acceptance inventory

| Tab | Original 3150 feature inventory to migrate and verify | Operational integration proof |
| --- | --- | --- |
| **Dashboard** | Original cards, metrics, navigation, secondary details, counters, responsive behavior | Real tenant KPIs, valid links into the other seven scoped pages, no fake totals |
| **Post Load** | Entire approved On Demand / Regular Load / Daily Hire forms, field groups, validations, 15-min scheduling, documents, address protection and submit/confirm | Allowed-role POST with real API, VAT/terms as authorized, no Target Price, saved job persists and is immediately visible in Loads; no Company Driver posting |
| **Loads** | Exact original `DemoExchangeBoard`, `XDriveLoadCard`, `DemoTransportDetails`, filters (from/to/radius/vehicle/service/date), five top tabs, sort, list/map, card buttons, status and modal | Actual `jobs` and related data; public town/outcode before award, authorized full details afterward; accurate service/status, price/terms/cargo; every filter ACTUALLY filters; map ACTUALLY works or is marked FAIL; action destinations correct |
| **Quotes** | Full original quotes cards, status tabs/counters, Company/Customer/Broker/Driver actions; Quote Now 3150 **four tabs** (Quote, Load Details, Route & Map, Company), notes, ETA, vehicle, validity and all original dialogs | `job_bids` real fetch/submit, genuine company/member attribution, Customer review/shortlist/reject/award per role, correct persistence and quote status updates |
| **Bookings** | Six approved tabs (All, Pending Allocation, Allocated, In Progress, Completed, Cancelled), five KPI tiles, filters, calendar/list switch, card actions, original View Details and Booking Details, assignment dialogs | Real booking status transitions, driver/vehicle assignment, correct authorized docs/POD/invoice links and accurate counters; no demo bookings |
| **My Fleet** | Exact approved 3150 fleet listing, vehicle cards, dialogs, forms, documents, status and selection | Real `vehicles` ownership, permitted editing, documents, no cross-company fleet visibility |
| **Drivers** | Exact approved 3150 drivers list, details, allocation/edit forms, eleven required document types as applicable | Real `drivers`/company links, invitations and permissions, assignment, document validation/persistence |
| **Diary** | Approved nine tabs: All, Unallocated, Allocated, In Progress, Completed, Cancelled, Expired, Awaiting Feedback, Recent Feedback; canonical cards, calendar/list, details/actions | Accurate job filtering and status counts, linked bookings and driver/vehicle events, no misclassified or missing jobs |

**Important role nuance:** original Company 3150 demo may show Quote Now for carriers. A Customer must not gain Carrier quote privileges simply because the original component contains that button; the visual component must be reused while the real action/visibility follows RBAC. Conversely, actions authorized for Customer must not disappear in the process of replacing a page. Every exception requires recorded evidence.

## 3. Mandatory execution loop — repeat for EVERY tab x workspace

### Gate A — Inventory and visual comparison, before editing

1. Read the owner's current instructions and `AGENTS.md`; inspect `git status`, `git log`, exact `origin/main`, worktrees and latest Netlify production deploy. Open the approved original **3150** and corresponding **LIVE** workspace route in separate Opera tabs.
2. On EACH page navigate or refresh, **wait at least 2–4 seconds after navigation and until live data has stabilized**, then capture actual screenshot. Do this on desktop and at a mobile/narrow viewport relevant to desktop responsive behavior (not standalone PWA1099). Compare header, sidebar, typography, spacing, card dimensions, filters, tabs, counters, content, status, buttons, modals, overlays, focus and scrollbar behavior.
3. Click **every functional element** in each tab and every secondary tab/modal, including nested controls and Cancel/Close. Use a read-only account for production; if a button would mutate data, validate safely in an isolated authenticated environment or mark as BLOCKED with evidence.
4. Record an **explicit discrepancy ledger**: route, workspace, expected 3150, current LIVE, severity (P0/P1/P2), exact source component/handler, associated API/RLS, screenshot, owner and regression test. Do not start an unrelated tab until the current discrepancy has a root cause.
5. Verify the original component's real source, not only screenshots. Trace imported children/styles/modals/handlers. Identify independent legacy routes and duplicate UI; identify files/commands touching prohibited routes BEFORE editing.

### Gate B — Actual original replacement and real-data adapter

1. **Use the original 3150 component code and original styles**, or extract the exact component into a production-safe shared module without changing approved markup/design/behavior. Replace the legacy route import and eliminate shadow legacy components *only after proving they are unused by permitted/in-scope consumers*.
2. Implement ONE canonical component per shared feature, called by all seven eligible desktop workspaces. No approximate JSX recreation, copied mock objects, legacy modal behind View Details, or sidebar-only parity.
3. Build a typed **real data adapter** between Supabase/API and the original 3150 presentation model. For every displayed field maintain a `source_table.column -> DTO -> rendered UI -> verification` trace. Real values must drive service classifications, status/counters, driver/vehicle, company, member ID, cargo, weight/dimensions, price/payment terms, pickup/delivery and dates. `Not recorded` is allowed ONLY when a field is demonstrably absent, not because the agent could not map it.
4. **Tenant/privacy:** preserve JWT, authenticated Supabase queries, RLS and company isolation. Before award, only town/outcode to unauthorized viewers; after award only authorized parties receive full address and contact. No private address inserted into public card titles/tooltips, map requests, DOM data attributes, URLs or telemetry.
5. **Real controls:** filters must alter result sets; radius must compute a genuine location/distance predicate or remain FAIL; Map View must display a working map or remain FAIL; sort must sort correctly; status tabs must apply exact agreed classifications; every action must navigate, persist or deliberately reject by RBAC. Never interpret a visible button as working functionality.
6. Trace complete transaction `Load -> Quote -> Award -> Booking -> Collection -> Delivery -> POD -> Invoice` across the eligible desktop roles at the boundary, without modifying standalone PWA1099. Review API responses and state persistence, not just front-end routing.

### Gate C — verification in code, PowerShell and Opera

1. Unit/contract tests for field mapping, services, statuses, formats, conversion, RBAC, privacy and all eight-tab invariants. Include regression tests for the actual failures, not tests that only assert that strings exist in source files.
2. TypeScript, scoped ESLint, Vitest, Playwright browser E2E, protection scripts, production build. **Required gate:**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-protected-workspace-invariants.ps1
npm run build
```

3. In Opera, verify the local/preview and LIVE page with a real authenticated session. Wait 2–4 seconds, capture both original and candidate, check actual counters, click all tab/filter/modal/action permutations. A read-only path such as `/customer/loads` must still be verified from a Customer account, not from a Carrier session.
4. Verify backend independently using PowerShell/API and authoritative Supabase schema/query tools. Test role-scoped reads and company isolation; never test user permissions with a service-role credential. Confirm persistence by reloading after safely authorized mutations.
5. Capture artifacts: screenshots with timestamp, baseline and target URL, exact SHA, test logs and counts, role used, route and expected/actual values, failure screenshots, and deployment ID. Do not expose personal data or secrets in public artifacts.
6. After every fix, run impacted and previously passed regressions to catch cross-workspace failures. Do not mark a whole page PASS if only its root layout or the first modal passed.

### Gate D — release and post-deploy verification

1. Edit in a fresh isolated worktree from current `origin/main`; never overwrite another agent's branch, dirty files or PowerShell session. Use your **own** PowerShell process, not existing sessions. Fetch and reconcile newly published commits before release. Explicitly inspect `git diff --name-only`, `git diff --check` and all PWA/out-of-scope paths.
2. Make an atomic, reversible commit per validated change. A Netlify Deploy Preview is a **preview**; a Draft PR is **not production**. Owner expects approved passing changes published sequentially, not withheld indefinitely in local copies.
3. After tests PASS and code review: publish to `main` using normal non-force Git procedure according to repo permissions, with exact SHA and push result. No GitHub Actions. Preserve branch/revert possibility.
4. In Netlify confirm the production deploy corresponds to that SHA and shows **Published**, not Building/Queued. Confirm URL/resources and then run authenticated read-only browser acceptance on `www.xdrivelogistics.co.uk`. If deployment fails, diagnose and fix; do not declare success.
5. If LIVE does not show the intended change after 2–4 seconds, test cache and site alias, verify exact deployed SHA and correct route, and inspect real source. Never tell the owner to refresh as a substitute for doing the verification yourself.
6. Only then mark that change **LIVE VERIFIED** and proceed to the next discrepancy/tab. Failure after publication triggers rollback or forward fix under safeguards and immediate regression.

## 4. Objective PASS/FAIL and completion rubric

A matrix entry is PASS only if **all applicable** checks have evidence:

- Visual parity against original 3150 root **and** nested children, details, dialogs, validation, responsive layout.
- All visible actions are functional (including Save/Cancel/Close/Back); no fake tabs, decoration-only filters, dead buttons, placeholder map or silent errors.
- Real authenticated data, correct field mapping, proper status classifications and counters; no demo/test records presented as production business records.
- API/RLS/tenant isolation and role authorization tests; pre/post-award privacy verified.
- Persistence after refresh where a state change is applicable; no destructive production tests by default.
- TypeScript/ESLint/Vitest/relevant Playwright, protected invariants and production build all PASS.
- Netlify **Published** from intended main SHA, followed by live browser acceptance under the correct role.

Status vocabulary: `NOT STARTED`, `IN AUDIT`, `FAIL (reproduced)`, `BLOCKED (reason/evidence)`, `FIXED LOCAL`, `PREVIEW PASS`, `MAIN PUSHED / DEPLOYING`, `LIVE VERIFIED`. Never count `BLOCKED`, skipped, source-text-only, cached preview or local-only tests as PASS. **100/100** means every applicable acceptance cell `LIVE VERIFIED`, no open P0/P1 errors, all relevant E2E transaction paths and permission boundaries proven. A 7 x 8 = **56 route/role combinations** is the *minimum* coverage unit; each contains multiple sub-tabs/modals/actions, expanding into hundreds of assertions.

## 5. Ordered remediation: priorities and known failures

**First repair current published Customer Loads, then systematically replace remaining tabs for all seven roles through the shared components.** Recommended dependency order: shared 3150 components and data contracts -> Customer Loads -> all-role Loads -> Post Load -> Quotes -> Bookings -> Diary -> My Fleet -> Drivers -> Dashboard, with urgent security/transaction failures handled before visual polish.

Known LIVE Customer Loads audit findings (2026-11-08, original comparison in Opera + PowerShell):

| ID | Defect | Required verification |
| --- | --- | --- |
| CL-01 | View Details and View Load behave identically | Every action has approved, distinct semantics and correct route/modal |
| CL-02 | Radius selector unused in real filter predicate | Changing radius changes eligible results correctly or is FAIL |
| CL-03 | Map View is placeholder | Real map, markers and navigation function or is FAIL |
| CL-04 | Member ID hardcoded `Not recorded` | Real authorized member/company identity mapped, never fabricated |
| CL-05 | Modal uses UUID instead of commercial load reference | Exact business ref consistent between card and modal |
| CL-06 | Corrupted separator / glyphs | No mojibake or malformed symbols in LIVE DOM/screenshot |
| CL-07 | Distinct operational statuses collapsed into `Awarded` | Correct authoritative stages and badges throughout filters/cards/modal |
| CL-08 | Full addresses/contact always hidden, even for authorized Customer-owned jobs | Permission-sensitive disclosure post-award and for own authorized loads |
| CL-09 | Search Loads notice written to state but not shown | Visible feedback and actual filtered results after action |

Additional earlier risk: initial real-data adapter set `service='Not recorded'`, leading to incorrect service counters. Commit `694a6ab1` mapped actual Supabase `load_type`/`service_mode` (and cargo/weight) and is LIVE; validate counts against DB, not the original **demo** totals. Preserve genuinely correct 30 On Demand / 0 Same Day / 0 Next Day if DB supports it; never manufacture demo totals (56 / 18 / 19 / 19). Audit all statuses and cargo explicitly. These nine issues are **NOT resolved merely because source/UI was replaced**.

## 6. Agent ownership, concurrency and no interference

- One lead/merge coordinator owns shared architecture, integration matrix and main release order. Agents may own separate **tab/workspace audit batches** but must coordinate shared component changes with the lead before editing them.
- A scope owner logs exact paths and branch; another agent must not modify a file being actively edited without explicit coordination. Different PowerShell sessions and isolated Git worktrees; no GitHub Actions.
- Any agent who spots a bug outside the eight authorized tabs **records it, but does not modify it**. Never touch standalone Driver PWA1099.
- A fix to a shared helper is allowed only if it demonstrably does not change any prohibited tab/PWA behavior; otherwise create a scoped adapter and test.
- Avoid parallel production pushes against a stale `main`; fetch/reconcile each time and publish in controlled sequence. No force pushes.
- No automatic deployment of one agent's unreviewed work by another agent. Each publish includes a SHA, test evidence, live URL and Netlify deploy ID.

## 7. Persistent handoff contract (mandatory at every checkpoint)

Update `AUTONOMOUS_EXECUTION_CHECKPOINT.md` in the authorized working tree with:

1. **Task/scope:** the exact eight tabs, seven workspaces, nine excluded tabs and PWA1099 prohibition.
2. **Repo/worktree:** device/path, branch, base/HEAD/current origin/main SHAs, dirty/untracked files, protected components.
3. **Baseline:** original 3150 URL, images/source components, production route, timestamps.
4. **Matrix:** completed checks per workspace/tab/subtab/modal/action; failures and screenshots; no blanket PASS.
5. **Implementation:** changed files, adapter source columns, APIs/RLS, rationale and test additions.
6. **Evidence:** commands/results of TypeScript, ESLint, Vitest, Playwright, protected gate, build, Opera screenshot, authenticated source data, production state and Netlify SHA.
7. **Release:** local-only/PR/commit/main push/Netlify Published/LIVE VERIFIED distinctions.
8. **Next exact action:** one reproducible action and unfinished items, with no implied background continuation.

Sample checkpoint:

```text
TAB=Customer Loads | ROLE=Customer | STATUS=FAIL (CL-02 radius, CL-03 map)
ORIGINAL=http://127.0.0.1:3150/try-xdrive-company-demo
LIVE=https://www.xdrivelogistics.co.uk/customer/loads
GIT=<current SHA/branch> | NETLIFY=<deploy ID/status>
CODE=<specific files> | EVIDENCE=<screenshot/test-log paths>
PASS=<specific assertion counts> | FAIL=<reproduced IDs> | BLOCKED=<reasons>
NEXT=implement real radius predicate and assert results change for two values
OUT_OF_SCOPE=standalone PWA1099 + 9 other sidebar tabs (unchanged)
```

At start of every NEW chat, instruct the next agent: **Read `AGENTS.md`, this blueprint, and the latest checkpoint. Recheck GitHub `origin/main` and Netlify LIVE, compare original 3150 against the two Opera tabs after 2–4 seconds; reproduce open failures before writing code. Continue the same inspect -> replace original -> real backend -> test -> live verify loop. Never claim completion by inference from old chat.**

## 8. Immediate handoff baseline (as last confirmed 8 November 2026)

- GitHub production main **`694a6ab1f1161c18e6e6d9c1fe75f19a1212ec46`** at the last verified push; Netlify deployment **`6af0391dc2bd2dba1697a75c`** reported Published; must refresh these references on takeover.
- `/customer/loads` now directly renders the approved original `DemoExchangeBoard` via `Company3150LiveProvider`; a real-data adapter uses current `jobs`, the typed `load_type`, `service_mode`, `weight_kg`, etc. This is **not full functional acceptance** because CL-01..CL-09 are still open.
- The historical draft **PR #769** has been closed/superseded after direct commit to main; do not re-merge or restore its older branch.
- Earlier authenticated LIVE Playwright was 2/2 PASS for **page presence and basic detail display only**, NOT the full nine-issue functional audit. A reported 15/15 unit suite is likewise not end-to-end certification.
- A separate Booking Details candidate worktree existed at `D:\XDrive-Master3150-Bookings-20261108`; its unpublished state must be verified against CURRENT main and 3150 before use; no automatic cherry-pick.
- Owner's most recent user screenshot comparison confirms LIVE Customer Loads versus original 3150 differs functionally. Begin with CL-01..CL-09 and demonstrate both visual and operational parity, not yet another sidebar/card makeover.

**Final owner acceptance:** eight canonical approved tab implementations, used in all seven desktop workspaces, connected to real secure XDrive data, all relevant controls operational, no demo data, no cross-role visual drift, PWA1099 and the other nine tabs untouched, and every deployed feature verified visually and functionally in LIVE. Anything short of that is *partial*.