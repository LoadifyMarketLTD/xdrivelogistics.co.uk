# XDRIVE LOGISTICS
# CANONICAL DRIVER ELIGIBILITY & AWARD CONTRACT
## Approved product/business clarification for Master Plan v3

**Status:** OWNER-APPROVED PRODUCT CONTRACT — subordinate to and interpreted through `docs/design/XDRIVE_WORKSPACE_CONSTRUCTION_MASTER_PLAN_v3.md`.

**Controlling specification:** `XDRIVE_WORKSPACE_CONSTRUCTION_MASTER_PLAN_v3.md` remains the controlling specification for PR #357 and the complete workspace reconstruction programme.

**Branch:** `workspace-cx-matrix-v1`

**Absolute boundaries:** `/super-admin` remains READ-ONLY; do not merge to `main`; do not force-push or rewrite history.

This document resolves the driver/fleet/owner-driver ambiguity discovered during PR #357. It does not authorise unrelated scope expansion. Backend, API, RLS or schema changes are allowed only where they are demonstrably necessary to implement this approved contract correctly and must remain narrowly scoped, source-audited and self-checked before the next implementation step.

---

# 1. ONE CANONICAL OPERATIONAL ELIGIBILITY CONTRACT

XDrive has one operational eligibility rule for every driver, regardless of whether that driver is an independent Owner Driver or belongs to a Fleet/Carrier company.

A driver is **operationally eligible** only when all required readiness conditions are true:

1. onboarding/identity verification is complete and approved;
2. the driver account is active and permitted to use the operational application;
3. required personal/driver compliance documents are present, verified/accepted and not expired;
4. the driver has a canonical active operational vehicle associated with that driver;
5. required vehicle documents/compliance are present, verified/accepted and not expired;
6. any existing canonical commercial-bid capability flag required by XDrive is enabled;
7. no canonical suspension/rejection/inactive state blocks the driver.

Unknown, missing or unrecognised readiness state is **fail-closed**, never assumed eligible.

A driver who fails this contract may remain visible where the product needs to explain the blocker, but must not be presented as quote-ready, allocation-ready or execution-ready.

---

# 2. DRIVER + VEHICLE IS THE OPERATIONAL UNIT

A driver cannot be considered operationally active for Marketplace execution without an eligible canonical vehicle.

The vehicle relationship must not be inferred merely because a vehicle is unassigned or because a driver record exists. Readiness requires an explicit canonical driver↔vehicle relationship plus vehicle compliance.

The same eligibility/readiness helper or server contract must be reused by:

- Driver Marketplace;
- Driver Dashboard relevant loads;
- quote submission;
- mobile/Android Marketplace and quotes;
- Fleet driver readiness;
- Fleet allocation/reallocation;
- Driver Availability where quote readiness is surfaced;
- any future automation that awards or allocates work to a named driver.

Do not maintain separate conflicting definitions of eligibility in individual pages/endpoints.

---

# 3. MARKETPLACE QUOTE GATE

Only an operationally eligible driver may submit a driver-originated Marketplace quote.

The quote gate must verify the canonical driver eligibility contract server-side at the authoritative mutation boundary. Client UI may additionally explain eligibility but must not be the only enforcement layer.

Pre-award Marketplace privacy remains separate from eligibility:

- the eligible driver receives quote-safe job information;
- exact execution addresses, site contacts, private references and private execution instructions remain hidden until the driver is authorised for execution;
- no privacy implementation may silently weaken the eligibility contract;
- no eligibility implementation may expose private execution data pre-award.

---

# 4. OWNER DRIVER AWARD CONTRACT

An Owner Driver quote is a quote from a specific operationally eligible driver with that driver's canonical eligible vehicle.

When that quote is accepted:

1. the commercial award is recorded against the canonical supplier identity required by the existing XDrive data model;
2. the accepted `bidder_driver_id` is the execution driver;
3. the canonical eligible vehicle associated with that driver is the execution vehicle where the existing schema supports persistent job-vehicle allocation;
4. the job becomes allocated to that driver automatically; there is no separate Fleet dispatcher allocation step for the normal Owner Driver flow;
5. award identity and execution identity remain separate fields/concepts even when they refer to the same sole trader operationally.

Do not use a generic later `assigned_driver_id` as retrospective proof of who commercially won the job. The accepted bid/award contract remains the source of commercial award identity.

---

# 5. FLEET DRIVER AWARD CONTRACT

A Fleet Driver may quote only when that named driver satisfies the same canonical operational eligibility contract, including an eligible canonical vehicle.

A Fleet Driver quote is commercially made in the Fleet/Carrier company context but operationally identifies the named bidder driver.

When that Fleet Driver quote is accepted:

1. the Fleet/Carrier company is the awarded supplier/company;
2. the accepted `bidder_driver_id` is the default execution driver;
3. the bidder driver's canonical eligible vehicle is the default execution vehicle where persistent vehicle allocation is supported;
4. the job is automatically allocated to that named driver rather than entering a generic unallocated queue;
5. the Fleet may reallocate the job only through an explicit authorised reallocation workflow that re-validates the replacement driver + vehicle against the same canonical eligibility contract.

The Fleet Driver flow therefore uses the same operational rule as Owner Driver. The difference is commercial ownership: company supplier versus independent supplier identity.

---

# 6. FLEET COMPANY BID WITHOUT NAMED DRIVER

A Fleet/Carrier company may have a commercial bid/award path that is not tied to a named eligible driver at quote time only where the existing product contract explicitly supports company-level bidding.

For that distinct case:

`accepted company bid → awarded company → won/unallocated → dispatcher selects eligible driver + eligible vehicle → allocated`

This is the only normal case that should enter the Fleet unallocated queue after award.

Do not confuse:

- **Fleet Driver bid** — named bidder driver, auto-allocation to that driver on acceptance;
- **Fleet Company bid** — no named bidder driver, dispatcher allocation required after award.

---

# 7. REALLOCATION CONTRACT

Fleet reallocation, where allowed, is not a shortcut around readiness.

A replacement driver must pass the same canonical eligibility contract at reallocation time. The replacement vehicle must also be that driver's canonical eligible operational vehicle or another explicitly authorised eligible vehicle if the existing product supports controlled vehicle substitution.

Reallocation must preserve:

- the original commercial award/company identity;
- accepted bid/commercial history;
- audit/history of the previous assignment;
- job lifecycle correctness;
- POD/document/invoice continuity.

A UI-only dropdown change is not a valid reallocation if the authoritative backend state is not updated.

---

# 8. CANONICAL IDENTITY SEPARATION

These concepts must remain separate throughout Driver, Fleet, Broker and Customer surfaces:

- **awarded supplier/company identity** — commercial winner;
- **accepted bidder driver identity** — named driver who submitted the accepted driver-originated quote;
- **assigned/executing driver identity** — current operational executor;
- **assigned/executing vehicle identity** — current operational vehicle.

They may coincide, but they are not interchangeable.

Customer/Broker Diary and Job Sheet must never label a generic `assigned_driver_id` as the awarded Owner Driver unless the accepted award/bid contract proves that identity.

---

# 9. CANONICAL IMPLEMENTATION RULE

The repository should converge on one reusable eligibility/readiness implementation rather than endpoint-specific lists of statuses and ad-hoc checks.

Preferred shape:

- one authoritative server-side resolver for driver + vehicle operational eligibility;
- one shared typed result used by UI/API adapters;
- reasons/blockers returned explicitly (`onboarding`, `driver_documents`, `vehicle`, `vehicle_documents`, `account`, `commercial_bid`, etc.);
- fail-closed behaviour for unknown/missing required states;
- existing canonical database/RPC rules reused where they already encode part of the contract;
- no duplicate lifecycle or eligibility definitions in web, mobile and Android.

If schema/API changes are required to persist the approved driver+vehicle allocation contract, they are **in-scope only to the minimum extent required by this owner-approved rule**, must be documented in the commit, and must not silently redefine unrelated permissions, role access or lifecycle semantics.

---

# 10. PR #357 CONVERGENCE RULE

For the remainder of PR #357:

**KEEP**

- measured CX workspace UI;
- quote-safe Marketplace presentation;
- server-side privacy projection where required to keep private execution fields out of pre-award client payloads;
- real Member Identity / Diary / Job Sheet surfaces where authorised;
- shared visual primitives;
- existing good Driver Loads scan → expand → quote interaction.

**CONVERGE / CORRECT**

- driver eligibility into this single canonical contract;
- Owner Driver accepted bid → automatic driver allocation;
- Fleet Driver accepted bid → automatic same-driver allocation;
- Fleet Company bid → unallocated dispatcher flow only when no named bidder driver exists;
- persistent vehicle allocation where the verified existing schema supports it, otherwise document the concrete backend persistence gap before inventing a new schema mechanism;
- Customer Diary award identity versus execution identity;
- mobile/web/Android lifecycle and quote eligibility onto shared canonical rules;
- CSS onto the measured Master Plan v3 contract.

**DO NOT**

- treat the v3 Continuation document as authority above Master Plan v3;
- introduce unrelated role/permission redesign;
- use generic company membership to expose another driver's personal quote history;
- infer vehicle availability/readiness from `assigned_driver_id` alone;
- create mock readiness or fake compliance;
- declare the programme ready for final validation while convergence items remain open.

---

# 11. VALIDATION TIMING

During implementation the gate remains:

`source inspection → diff inspection → Master Plan/CX comparison → self-audit → commit → committed-diff self-review`

Do not use GitHub Actions, Netlify, hosted CI/status checks or visual fixture infrastructure as pass/fail blockers during implementation.

Do not request local PowerShell validation after individual commits/pages/workspaces.

The single local validation phase (lint/typecheck/tests/build/runtime smoke checks) occurs only after:

1. all required workspaces/subpages are complete;
2. the complete programme has converged to this approved driver contract and Master Plan v3;
3. the independent final repository audit is GREEN;
4. `/super-admin` is confirmed unchanged.
