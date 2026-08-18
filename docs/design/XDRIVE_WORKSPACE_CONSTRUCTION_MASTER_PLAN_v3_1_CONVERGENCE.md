# XDRIVE LOGISTICS
# WORKSPACE CONSTRUCTION MASTER PLAN
## v3.1 — CONVERGENCE & LAUNCH CLOSURE

Status: **CONTROLLING AMENDMENT TO v3 FOR PR #357**

This document does not replace the visual, structural and workspace requirements in `XDRIVE_WORKSPACE_CONSTRUCTION_MASTER_PLAN_v3.md`. It updates the execution protocol and records owner-approved business clarifications discovered during implementation. Where this document conflicts with procedural wording in v3, **v3.1 controls for PR #357**. Where it is silent, v3 remains controlling.

The purpose of v3.1 is **finish, simplify, correct and stabilise the existing XDrive product**. It is not an expansion programme.

---

# 1. LAUNCH-CLOSURE PRINCIPLE

From this point forward every proposed change is classified as exactly one of:

- **KEEP** — existing behaviour/implementation is correct and should remain.
- **FIX** — existing behaviour is incorrect, inconsistent, unsafe or incomplete and must be corrected.
- **REQUIRED** — a missing capability is necessary for the current Web/Mobile operational flow to function truthfully and safely.
- **DEFER** — useful future capability that is not required to complete and launch the current platform.

No DEFER item may enter PR #357 merely because Courier Exchange has it.

Courier Exchange / Transport Exchange Group public material is an **operational benchmark and research source**, not an automatic feature backlog. XDrive product truth, approved owner decisions and this Master Plan control implementation.

---

# 2. EXECUTION MODE — AUTONOMOUS + BRANCH GUARD

The implementation agent has two simultaneous responsibilities:

1. **XDrive implementation engineer** — implement the smallest correct solution.
2. **XDrive Branch Guard** — independently inspect its own source/diff after each logical commit and correct deviations before continuing.

For every logical commit:

`inspect canonical contract → implement minimal change → inspect diff → self-audit → correct if required → continue`

The Branch Guard must stop advancement when it detects:

- `/super-admin` changes;
- work/merge on `main`;
- force/history rewrite;
- unrelated business-rule expansion;
- duplicated lifecycle/permission/eligibility logic;
- mock production functionality;
- regression of Driver Loads;
- CSS patch proliferation;
- legacy miniaturisation;
- an incomplete step being skipped;
- a decision that requires owner approval.

---

# 3. VALIDATION PROTOCOL — OVERRIDES EARLIER PER-PAGE BUILD WORDING

During implementation and convergence, validation is **source / diff / self-audit only**.

Do NOT use as pass/fail gates during individual pages, workspaces or commits:

- GitHub Actions;
- Netlify;
- hosted CI/status checks;
- visual fixture gates;
- hosted build status;
- local PowerShell lint/typecheck/tests/build after each page or phase.

Do not ask the owner to run PowerShell after intermediate changes.

The **single local validation phase** happens only after:

1. all Master Plan v3/v3.1 workspaces and required subpages are complete;
2. the convergence/fix scope is complete;
3. the Branch Guard has completed a final strict repository audit against:
   - Master Plan v3;
   - this v3.1 amendment;
   - `public/reference/courier-exchange/`;
   - measured `docs/ui/cx/` baseline;
4. all known source-level blockers are closed or explicitly accepted as launch blockers.

Only then run the one final local phase:

`lint → typecheck → tests → production build → runtime/smoke checks`

Any earlier v3 wording requiring typecheck/build after each page or phase is superseded by this section for PR #357.

---

# 4. SCOPE FREEZE

PR #357 is now in **CONVERGENCE**, not feature discovery.

Do not add new product families such as:

- replay maps;
- advanced telematics;
- private groups;
- lane/rate analytics;
- full SmartPay-equivalent workflows;
- Trustd-style selfie/Load Pass;
- new messaging product;
- advanced co-loading/subcontracting UI;
- unrelated API ecosystem work.

These may be documented for post-launch only.

A new capability may enter current scope only when absence of that capability makes an existing required Web/Mobile workflow incorrect, unsafe, impossible or misleading.

---

# 5. CANONICAL DRIVER + VEHICLE OPERATIONAL ELIGIBILITY

Owner-approved product rule:

**Every operational driver — Owner Driver or Fleet/Company Driver — must have their own canonical vehicle and must be currently verified before they may quote on Marketplace jobs.**

A driver-originated quote requires all of the following, fail-closed:

1. driver account status is active;
2. driver is active and has app access;
3. commercial bidding capability is permitted;
4. driver identity/onboarding is approved and risk-clear;
5. mandatory personal onboarding documents are currently valid/verified;
6. driver belongs to an active canonical company context;
7. active company membership exists where applicable;
8. exactly one active vehicle is explicitly assigned to that driver;
9. the vehicle belongs to the same canonical company context;
10. required current vehicle compliance evidence is valid, including MOT and insurance where required by the current XDrive contract.

`is_available` / current scheduling availability is **not** the same as commercial eligibility. A driver may quote future work while currently occupied if the job timing and platform rules permit it.

No UI or API may infer eligibility merely from absence of a negative status.

---

# 6. THREE COMMERCIAL QUOTE/AWARD PATHS

The platform must preserve three distinct paths.

## 6.1 Owner Driver quote

Commercial supplier = canonical owner-driver supplier/company identity.

Bid identity = the Owner Driver.

Execution identity = the same Owner Driver.

On accepted bid:

`accepted bid → awarded supplier → same bidder driver → same canonical vehicle → allocated`

No arbitrary allocation step is required.

## 6.2 Fleet/Company Driver personal quote

Commercial supplier = Fleet company.

Bid identity = named Fleet Driver.

Execution identity = that same named Fleet Driver.

On accepted bid:

`accepted bid → awarded Fleet company → same bidder driver → same canonical vehicle → allocated`

The system must not silently substitute another company driver at award time.

A later controlled Fleet reallocation may change execution identity only through the canonical allocation path and must remain auditable.

## 6.3 Fleet Company quote without named driver

Commercial supplier/bidder = Fleet company.

No execution driver is promised by the quote.

On accepted bid:

`accepted company bid → awarded Fleet company → unallocated`

Then an authorised Fleet operator selects an **operationally eligible driver**, and allocation automatically uses that driver's canonical vehicle:

`awarded → eligible driver + canonical vehicle → allocated`

No arbitrary vehicle dropdown is authoritative when the driver already owns the canonical execution vehicle.

---

# 7. COMMERCIAL IDENTITY ≠ EXECUTION IDENTITY

Never use `assigned_driver_id` as proof of the commercial award identity.

The system must keep these concepts distinct:

- awarded supplier/company;
- accepted bid identity;
- executing driver;
- executing vehicle.

Customer/Broker/Fleet/Diary/Job Sheet labels must remain truthful.

Examples:

- **Awarded supplier** comes from accepted bid / award contract.
- **Executing driver** comes from allocation.
- **Executing vehicle** comes from persistent execution allocation.

No fallback may convert a generic assigned driver into an Owner Driver commercial award.

---

# 8. PERSISTENT VEHICLE ALLOCATION IS REQUIRED

The current product contract treats driver + canonical vehicle as the execution unit.

If the live schema lacks an authoritative job-level vehicle foreign key, a minimal schema extension is **REQUIRED**, not redesign scope creep, because without persistence:

- Fleet allocation is only advisory;
- Job Sheet cannot truthfully identify the execution vehicle;
- Web and Mobile can disagree;
- execution history cannot reliably preserve which vehicle was authorised for the job.

The allowed implementation is the narrowest canonical persistent relationship, e.g. an authoritative job execution `vehicle_id` referencing `vehicles` if no equivalent field already exists.

Do not add unrelated schema while making this correction.

---

# 9. QUOTE SUBMISSION MUST HAVE ONE CANONICAL MUTATION

Web and Mobile must not implement independent commercial eligibility rules.

All driver-originated quote submission paths must converge on one canonical rule/mutation and must be impossible to bypass through direct client inserts.

Required properties:

- server-side eligibility evaluation;
- same readiness definition for Web and Mobile;
- bidder user + bidder driver + company identity remain explicit;
- personal driver bid history remains personal;
- company commercial history remains a Fleet/Company concern;
- rate-limit and duplicate-quote behaviour remain consistent;
- database boundary prevents a client from bypassing the approved readiness contract.

A server-side quote-safe Marketplace projection is approved when required to protect pre-award private execution data and keep Web/Mobile on one contract.

---

# 10. MARKETPLACE PRIVACY BOUNDARY

Pre-award Marketplace may expose quote-safe commercial information necessary to evaluate the job, including broad route area, freight/vehicle requirement, timing, commercial terms and posting-member business identity where authorised.

Pre-award Marketplace must not leak execution-private information such as exact site addresses, private site contacts, private references/instructions or execution evidence when those fields are contractually post-award.

Server-side projection / RLS / permission hardening is allowed **only to the minimum extent necessary** to enforce this approved boundary. It must not be used as an excuse to redesign unrelated permissions.

Public Quote Notes and Private Booking/Execution Instructions remain separate concepts.

---

# 11. JOB / BOOKING SHEET

The existing Job Sheet direction is retained.

It is the post-award operational record and may include, according to authorised role and available real data:

- route and exact execution details;
- award identity;
- agreed rate;
- executing driver;
- executing vehicle;
- freight/vehicle requirements;
- authorised contacts;
- status/timeline;
- POD;
- documents;
- invoice/commercial state;
- execution/booking instructions.

Do not fabricate unavailable fields.

Authorization must be based on the canonical existing/approved relationship to the job. A UI redesign cannot invent broader read permissions.

---

# 12. LIFECYCLE — ONE CANONICAL CLASSIFIER

Do not maintain independent hard-coded lifecycle definitions in Web pages, Mobile routes, Android, Fleet, Diary and Customer.

Preserve the canonical XDrive operational lifecycle and converge presentation/grouping on shared logic.

The required execution concept remains compatible with:

`posted → quoted → awarded → allocated → accepted → on my way to pickup → on-site pickup → loaded → on my way/in transit → on-site delivery → delivered`

POD/signature/photos complete proof-of-delivery requirements according to the existing job contract.

Do not create new lifecycle statuses solely for UI grouping.

---

# 13. POD / INVOICE TRUTH

Do not redesign Finance during this convergence phase.

However, existing POD and invoice behaviour must be audited so the UI cannot claim a booking is invoice-ready when required POD/evidence is missing.

Required current principle:

`delivered` and `POD requirements satisfied` are distinct facts.

If the existing XDrive finance contract already gates invoicing correctly, KEEP it. If UI presentation contradicts it, FIX the presentation. Change backend behaviour only when the existing required flow is otherwise broken.

---

# 14. FLEET ALLOCATION

Fleet allocation must become truthful and canonical:

- Fleet company award without named driver remains `awarded / unallocated`;
- dispatcher selects an eligible company driver;
- the canonical vehicle follows that driver's verified assignment;
- driver and vehicle persist together on the execution record;
- invalid/ineligible drivers cannot be recommended or allocated;
- unknown/null eligibility states fail closed;
- controlled reallocation must not change the commercial supplier identity.

Do not invent a second vehicle-allocation workflow when the driver has a canonical vehicle.

---

# 15. CSS CONVERGENCE

The final repository must not retain two contradictory workspace dimensional systems.

The measured v3 contract remains authoritative:

- ~50px header;
- ~32px standard controls;
- 27–30px tabs with 11–12px text;
- 12–13px operational text;
- 11–12px labels;
- 10–11px metadata;
- 220px operational filter rail;
- 230px structural sidebar where applicable;
- ~300–315px Driver Dashboard operational column;
- 40–44px simple rows;
- content-driven complex operational records.

Legacy values that globally force ~58px headers, ~196px rails or 8–10px operational typography must not survive as competing defaults.

Do not solve this by adding another override stylesheet. Consolidate toward one canonical token/rule system and remove obsolete duplication only after consumer inspection.

---

# 16. DRIVER LOADS PROTECTION

Driver Loads remains a protected reference implementation for the operational UI pattern.

KEEP its good properties:

- operational filter rail;
- compact tabs;
- dense/content-driven records;
- inline quote;
- details expansion;
- quote-safe Marketplace information;
- useful member/commercial context.

Architecture may change only when required by the approved privacy/eligibility contract. Do not destabilise working UI merely to feed other workspaces.

---

# 17. CURRENT LAUNCH-CLOSURE PRIORITIES

The mandatory convergence priorities are:

1. canonical driver + vehicle eligibility;
2. canonical Web/Mobile quote mutation and non-bypassable gate;
3. correct Owner Driver / Fleet Driver / Fleet Company award semantics;
4. persistent driver + vehicle allocation;
5. correct Customer/Diary award-vs-execution identity;
6. Fleet allocation through the same eligibility contract;
7. one canonical lifecycle classifier across Web/Mobile/Android/workspaces;
8. Marketplace privacy boundary without unrelated permission expansion;
9. Job Sheet truthfulness and authorised data scope;
10. POD/invoice presentation consistency;
11. CSS convergence and anti-miniaturisation cleanup;
12. final route-by-route Master Plan audit.

No unrelated feature may displace these priorities.

---

# 18. POST-LAUNCH / DEFERRED RESEARCH

Research may be retained as roadmap but is **not PR #357 implementation scope** unless later explicitly approved as launch-critical:

- Trust/collection selfie verification and Load Pass;
- tracking replay;
- advanced Event Log reporting;
- private carrier groups;
- advanced live-capacity states;
- sophisticated automated matching;
- full Book Direct expansion across every surface;
- new auditable messaging product;
- full SmartPay-style supplementary invoice/query workflow;
- advanced subcontracting/co-loading consent module;
- lane/rate/supplier analytics;
- broad external TMS/telematics ecosystem.

Do not delete existing functionality in any of these areas. Simply do not expand them during convergence.

---

# 19. FINAL AUDIT ORDER

Before the single final local validation phase, the Branch Guard must audit in this order:

1. Git/branch/history integrity;
2. `/super-admin` untouched;
3. Master Plan v3 + v3.1 workspace completeness;
4. Driver Dashboard required information architecture;
5. Driver Loads regression check;
6. Driver Quotes/Jobs/Diary/Availability/Returns/Account;
7. Broker workspace and required subpages;
8. Fleet/Carrier workspace and allocation truth;
9. Customer workspace and award/execution identity;
10. Marketplace privacy and quote contract;
11. Web/Mobile/Android lifecycle/quote consistency;
12. POD/document/invoice truthfulness;
13. shared components and routing/permission regression risk;
14. CSS convergence and measured visual contract;
15. responsive source audit for ~1440 / 1280 / 1024 / 768 / 390–430.

Only after this audit is source-level GREEN may the final local validation phase begin.

---

# 20. DEFINITION OF DONE

PR #357 is not complete because a feature exists or a page looks good.

It is complete only when:

- every required Master Plan workspace/subpage is implemented or has an explicit accepted real-data/backend blocker;
- no required step was skipped;
- `/super-admin` is unchanged;
- `main` is untouched by implementation;
- no force/history rewrite occurred;
- Driver Loads has no regression;
- Web/Mobile/Android consume consistent commercial/lifecycle truths;
- driver eligibility is fail-closed and vehicle-aware;
- award/allocation identity is truthful;
- no production mock functionality exists;
- no unnecessary scope expansion remains;
- CSS has converged on the measured v3 baseline;
- Branch Guard final repository audit is GREEN;
- the one final local validation phase passes;
- owner runtime/visual verification remains the final merge-readiness gate.

Until then PR #357 remains draft and **DO NOT MERGE**.
