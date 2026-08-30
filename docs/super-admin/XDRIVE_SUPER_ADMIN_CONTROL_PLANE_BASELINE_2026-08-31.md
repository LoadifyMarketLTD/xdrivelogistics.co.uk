# XDRIVE LOGISTICS — SUPER ADMIN CONTROL PLANE BASELINE
## SA-00 Repository / Runtime Inventory and Execution Checkpoint

**Status:** IMMUTABLE EXECUTION BASELINE  
**Date:** 2026-08-31  
**Repository:** `LoadifyMarketLTD/xdrivelogistics.co.uk`  
**Baseline `main`:** `dd6f7ce68168e10f1780602171a5081287bb3a64`  
**Execution branch:** `feat/super-admin-control-plane-e2e-20260831`  
**Branch base:** `dd6f7ce68168e10f1780602171a5081287bb3a64`  
**XDrive Supabase project:** `jqxlauexhkonixtjvljw`  
**Production migration head observed read-only:** `20260830212347_harden_company_creator_power_boundary`  
**Production mutation during SA-00:** NONE  
**Deploy / merge / PR during SA-00:** NONE

---

# 1. PURPOSE

This checkpoint freezes the factual starting point for the Platform Owner / Super Admin control-plane workstream.

The implementation objective is not to add more menu entries. The objective is to close the operational chain:

`detect → locate exact entity → inspect authoritative context → perform only a canonical semantic action → record reason → audit → verify resulting state → close/escalate case`

A route, button, table, successful GET request, green build or valid navigation target is **not** evidence that the workflow is complete.

---

# 2. OWNER DECISION / SCOPE OVERRIDE

The previous workspace-convergence restriction that prohibited modifications under `/super-admin` is explicitly lifted for this workstream by the XDrive owner on 2026-08-30.

This override applies only to the dedicated branch named above. It does **not** authorize:

- direct work on `main`;
- Production Supabase mutations;
- deploys;
- generic arbitrary database editing from Super Admin;
- bypassing canonical domain lifecycle, RLS or audit rules;
- impersonation as a shortcut for Platform Owner inspection.

---

# 3. STATE CLASSIFICATION

Each Super Admin surface is classified using exactly one primary state:

- `COMPLETE` — read + required semantic mutation + audit + truthful deep-link/closure for its current launch responsibility.
- `READ-ONLY` — real data is exposed but there is no required operational mutation/closure.
- `PARTIAL` — meaningful workflow exists but one or more required closure stages are absent.
- `MISLEADING` — UI wording implies a capability that is not actually implemented.
- `DEAD-END` — navigation/deep-link lands on a surface that cannot reach the intended entity/action.
- `BLOCKED` — implementation depends on an unresolved canonical backend/security contract.

---

# 4. SUPER ADMIN ROUTE INVENTORY

The table below records the launch-relevant Platform Owner surface present at the baseline. Hidden/legacy compatibility routes are not treated as new product requirements unless explicitly referenced by a live flow.

| Route | Primary responsibility | Data / source | Mutation | Audit | Deep-link closure | Baseline state |
|---|---|---|---|---|---|---|
| `/super-admin` | Command Centre | `/api/super-admin/command-centre`, `/api/super-admin/stats` | Refresh only | indirect | queue links only | PARTIAL |
| `/super-admin/analytics` | Platform analytics | Super Admin analytics API/data | none required for report | n/a | report-level | READ-ONLY |
| `/super-admin/health` | Platform/integration health | `/api/super-admin/health` | none | n/a | not fully fed into Command Centre | PARTIAL |
| `/super-admin/notifications` | Notification delivery/recovery | platform notification API | retry | delivery history | entity links can terminate in generic lists | PARTIAL |
| `/super-admin/marketplace` | Marketplace governance | `/api/super-admin/marketplace` | publish/hide/dispute/cancel | governance history | job-specific intervention exists | COMPLETE |
| `/super-admin/operations/jobs` | All-jobs ledger | `/api/super-admin/operations?section=jobs` | none | no entity action audit | `?focus=` not consumed | DEAD-END |
| `/super-admin/operations/quotes` | Platform quotes ledger | operations API | none | no | no canonical quote inspector | READ-ONLY |
| `/super-admin/operations/allocations` | Allocation oversight | operations API | none | no | no exception-control closure | READ-ONLY |
| `/super-admin/operations/disputes` | Job disputes ledger | operations API | none | no domain mutation here | no full dispute case flow | PARTIAL |
| `/super-admin/operations/active-jobs` | Active execution ledger | operations API | none | no | no Open/Inspector action | DEAD-END |
| `/super-admin/operations/pending-jobs` | Pending jobs ledger | operations API | none | no | no Open/Inspector action | DEAD-END |
| `/super-admin/operations/completed-jobs` | Completed jobs ledger | operations API | none | no | no full transaction trace | READ-ONLY |
| `/super-admin/operations/deliveries` | Delivery oversight | operations API | none | no | no delivery exception inspector | READ-ONLY |
| `/super-admin/operations/pods` | POD queue | operations API | none | no correction workflow | no evidence inspector/closure | DEAD-END |
| `/super-admin/operations/driver-availability` | Driver readiness/availability | operations API | none | no | driver detail not canonicalized | READ-ONLY |
| `/super-admin/operations/fleet-positions` | Platform fleet positions | operations API | none | no | no driver/vehicle/job trace | PARTIAL |
| `/super-admin/companies` | Company governance | companies API + governance RPC/path | approve/reject/suspend/reinstate | yes | company-level closure exists | COMPLETE |
| `/super-admin/companies/approvals` | Pending company approvals | company/onboarding sources | review/approval path | yes | approval context exists | PARTIAL |
| `/super-admin/companies/active` | Active company registry | companies API | routed governance | yes via governance | company detail depth incomplete | PARTIAL |
| `/super-admin/companies/suspended` | Suspended company registry | companies API | reinstate path | yes | governance closure exists | PARTIAL |
| `/super-admin/companies/verification` | Company verification | company verification data | review-dependent | partial | cross-linking incomplete | PARTIAL |
| `/super-admin/companies/compliance` | Company compliance | compliance/company data | review-dependent | partial | context fragmented | PARTIAL |
| `/super-admin/finance` | Finance overview | `/api/super-admin/finance` | none | n/a | report only | READ-ONLY |
| `/super-admin/finance/invoices` | Invoice ledger | finance API | none | no exception mutation | no canonical invoice inspector | DEAD-END |
| `/super-admin/finance/payments` | Payment history | finance API | none | n/a | no reconciliation workflow | READ-ONLY |
| `/super-admin/finance/revenue` | Revenue report | finance API | none | n/a | report only | READ-ONLY |
| `/super-admin/finance/fees` | VAT/net/financial breakdown | finance API | none | n/a | report only | READ-ONLY |
| `/super-admin/compliance/documents` | Document review | compliance API/RPC | approve/reject/review | yes | private document view + review | COMPLETE |
| `/super-admin/compliance/expiries` | Expiry monitoring | compliance API | none | no | exception is not a case | READ-ONLY |
| `/super-admin/compliance/insurance` | Insurance oversight | compliance API | limited/read | partial | fragmented review route | PARTIAL |
| `/super-admin/compliance/operator-licences` | Operator licence oversight | compliance API | limited/read | partial | fragmented review route | PARTIAL |
| `/super-admin/compliance/fraud-cases` | Fraud/identity review | compliance data | domain-dependent | partial | case semantics not unified | PARTIAL |
| `/super-admin/support/tickets` | Support case workflow | `/api/super-admin/support?section=tickets` | investigate/resolve/close/reopen | yes | lifecycle exists | COMPLETE |
| `/super-admin/support/complaints` | Complaint register | support/reviews | no complete case mutation | no unified closure | registry only | READ-ONLY |
| `/super-admin/support/disputes` | Support/invoice disputes | support API | no complete case mutation | partial | registry only | READ-ONLY |
| `/super-admin/settings/global` | Global platform configuration | platform/settings API | controlled settings | expected audit | domain-specific | PARTIAL |
| `/super-admin/settings/roles-permissions` | Canonical role/capability registry | code-defined registry | none | n/a | UI says Manage but only inspects | MISLEADING |
| `/super-admin/settings/feature-flags` | Feature rollout control | platform API | controlled flag mutation | yes/expected | operational | COMPLETE |
| `/super-admin/settings/audit-logs` | Platform audit trail | audit API | none | source itself | filter/read | READ-ONLY |
| `/super-admin/users` | User category landing | stats/navigation | none | n/a | only subset of canonical roles | PARTIAL |
| `/super-admin/users/drivers` | Driver registry | operations/users API | none | no | no canonical entity inspector | READ-ONLY |
| `/super-admin/users/platform-admins` | Privileged platform identities | profiles/Auth explanation + shortcuts | no admin lifecycle | no grant/revoke audit path | wording exceeds capability | MISLEADING |
| `/super-admin/users/company-owners` | Company owners | users API | none | no | registry | READ-ONLY |
| `/super-admin/users/dispatchers` | Dispatchers | users API | none | no | registry | READ-ONLY |
| `/super-admin/users/customers` | Customers | users API | none | no | registry | READ-ONLY |
| `/broker` from Super Admin `XDrive Logistics` group | Broker operational workspace | broker workspace | broker actions, not Platform Owner inspection | broker audit domain | cross-role navigation, not safe inspector | PARTIAL |

## 4.1 Operations route reality

At baseline the operations directory contains the following concrete page routes:

`active-jobs`, `allocations`, `completed-jobs`, `deliveries`, `disputes`, `driver-availability`, `fleet-positions`, `jobs`, `pending-jobs`, `pods`, `quotes`.

The common implementation pattern is `SuperAdminLiveTablePage`, which provides real loading, notices, rows and pagination but does not itself provide entity inspection or semantic intervention.

---

# 5. SUPER ADMIN API INVENTORY

All launch-sensitive `/api/super-admin/**` routes must authenticate the Platform Owner server-side. The baseline API families observed are:

| API family | Current methods / responsibility | Authority model | Audit / mutation maturity | Baseline state |
|---|---|---|---|---|
| `/api/super-admin/command-centre` | GET derived attention + queue | bearer → profile `owner` | no persistent case mutation | PARTIAL |
| `/api/super-admin/stats` | GET platform counts | owner | read-only | COMPLETE for stats |
| `/api/super-admin/health` | GET DB/Storage/notification/integration readiness | owner | read-only | COMPLETE as probe, not integrated |
| `/api/super-admin/operations` | GET jobs/quotes/allocations/deliveries/POD/fleet/disputes | owner | read-only | PARTIAL |
| `/api/super-admin/marketplace` | GET marketplace governance feed | owner | paired with semantic intervention route | COMPLETE |
| `/api/super-admin/marketplace/[jobId]` | PATCH semantic marketplace interventions | owner | reason + audit required | COMPLETE |
| `/api/super-admin/companies` | GET company governance registry | owner | governance history | COMPLETE read side |
| `/api/super-admin/companies/[companyId]` | PATCH approve/reject/suspend/reinstate | owner | reason for dangerous actions + audit | COMPLETE |
| `/api/super-admin/compliance` | GET compliance registers + review data | owner | some canonical review mutations | PARTIAL/COMPLETE by section |
| `/api/super-admin/finance` | GET invoices/payments/revenue/fees | owner | no exception/reconciliation mutation | READ-ONLY |
| `/api/super-admin/support` | GET disputes/complaints/tickets; POST tickets; PATCH tickets | owner | ticket mutation audited; other sections registry-heavy | PARTIAL |
| `/api/super-admin/users` | GET role/category user data | owner | read-only; explicit unsupported `broker` filter | PARTIAL |
| `/api/super-admin/notifications` / platform notification APIs | GET notification data / retry through platform mutation | owner | retry supported | PARTIAL |
| `/api/super-admin/audit` | GET platform audit | owner | read-only audit surface | COMPLETE read side |
| `/api/super-admin/onboarding` | review/approval support | owner/service-controlled canonical RPCs | hardening recently applied | PARTIAL pending complete cross-link |
| `/api/super-admin/email-readiness` | GET readiness | owner | read-only | COMPLETE for diagnostic |

## 5.1 API defects frozen at baseline

1. `operations` is primarily a read API, so most Operations pages terminate at a ledger.
2. `finance` is GET-only for the current Super Admin finance surfaces; exception resolution is not a domain workflow.
3. `users` does not represent every canonical workspace role and explicitly rejects `broker` as a role filter.
4. Command Centre events are re-derived and therefore cannot serve as a durable case lifecycle.
5. Health exists separately but degraded service truth is not fully connected into Command Centre.

---

# 6. CANONICAL ROLE COVERAGE BASELINE

The code-defined workspace role registry contains:

1. Platform Owner
2. Company Owner
3. Company Admin
4. Carrier Admin
5. Broker
6. Customer
7. Fleet Manager
8. Dispatcher
9. Driver
10. Owner Driver
11. Finance
12. Compliance
13. Viewer

The baseline `All Users` UI exposes only a subset: Drivers, Platform Admins, Company Owners, Dispatchers and Customers.

This mismatch is a functional control-plane defect. It must not be solved by inventing fake database roles. SA-10 must map each displayed role to its actual authoritative source (`profiles`, `company_memberships`, workspace-access data, driver identity or other canonical source).

---

# 7. CONTROL-PLANE ARCHITECTURE DECISIONS FROZEN AT BASELINE

## 7.1 No generic arbitrary edit endpoint

Forbidden pattern:

`PATCH /api/super-admin/entity { field, value }`

Only semantic actions are allowed. Examples:

- `approve_company`
- `suspend_company`
- `resolve_support_ticket`
- `retry_notification`
- `request_pod_correction`
- `open_finance_investigation`
- `escalate_job_exception`

Each sensitive action must follow:

`authenticate owner → validate current canonical state → authorize exact action → require reason where material → execute atomically → write durable audit → return authoritative result`

## 7.2 No impersonation shortcut

Platform Owner inspection must not become user impersonation. The control plane observes canonical entities and exposes only explicitly authorized platform actions.

## 7.3 Read-only by default

`PlatformEntityInspector` is read-only unless the entity/action registry explicitly supplies a canonical semantic mutation.

## 7.4 Existing mature patterns are retained

Company Governance, Marketplace Governance, Compliance Document Review and Support Tickets are reference implementations for:

`inspect → decision/action → reason → canonical mutation → audit`.

They are to be consolidated, not rewritten merely for uniformity.

---

# 8. CROSS-WORKSPACE TRANSACTION MODEL

The Platform Owner must ultimately be able to trace one commercial transaction without switching mental models:

`posting Customer/Broker company`
→ `job`
→ `quote/bid identities`
→ `accepted bid / awarded supplier`
→ `executing Fleet/Driver`
→ `executing vehicle`
→ `status timeline`
→ `tracking/location`
→ `POD evidence`
→ `delivered state`
→ `invoice`
→ `payment/dispute`
→ `audit/events/cases`

Commercial identity and execution identity must remain separate.

---

# 9. CONTROL-PLANE SHARED PRIMITIVES REQUIRED BY SA-01

Create under `app/super-admin/_components/control-plane/`:

- `PlatformEntityInspector`
- `PlatformActionPanel`
- `PlatformAuditTimeline`
- `PlatformCaseCentre`
- `PlatformEntityLink`
- shared control-plane types/tokens only where needed.

Required UI contract:

- XDrive light control-plane palette;
- `4px` radii;
- `32px` standard controls;
- compact tables and metadata;
- explicit loading/error/partial/unavailable states;
- no fake zero values for unavailable datasets;
- no action rendered without an executable canonical handler.

---

# 10. KNOWN P0-F FUNCTIONAL GAPS

The following are release blockers for the control plane:

1. No durable Platform Case / Action Centre lifecycle.
2. Navigation-only search instead of entity search.
3. Notification/job deep links that terminate in generic lists.
4. No canonical Job Inspector / complete transaction trace.
5. Operations ledgers without exception-control closure.
6. POD queue without physical-evidence inspection/correction workflow.
7. Finance ledgers without exception/reconciliation workflow.
8. All Users does not cover the canonical role model.
9. Platform Administrators surface implies administration without a complete privileged-access lifecycle.
10. Cross-workspace exception handling is not demonstrably closed E2E.

---

# 11. KNOWN NON-CONTROL-PLANE RELEASE DEPENDENCIES

This workstream must not silently weaken or bypass the independent security/release blockers already identified elsewhere, including:

- Jobs/Marketplace RLS privacy boundary;
- active-only membership helper semantics;
- Finance DB authorization parity;
- POD physical Storage-object validation;
- clean migration replay / repository-to-Production reproducibility.

The Super Admin control plane may expose diagnostics for these domains, but it must not compensate for an insecure base-table/RPC contract with service-role UI logic.

---

# 12. EXECUTION ORDER

Mandatory order:

`SA-00 → SA-01 → SA-02 → SA-03 → SA-04 → SA-05 → SA-06 → SA-08 → SA-09 → SA-10 → SA-12 → SA-13 → SA-14 → SA-16 → SA-17 → SA-18 → SA-19 → SA-20 → SA-21`

`SA-07` semantic exception actions are implemented incrementally with the affected domains.

`SA-11` remains a decision gate: delegated Platform Administrators are not to be invented merely because the current UI uses that label.

---

# 13. SA-00 COMPLETION VERDICT

**SA-00: COMPLETE AS EXECUTION BASELINE.**

The repository and Production checkpoint are identified, the control-plane route/API responsibilities are classified, the known workflow gaps are frozen, and the execution branch is isolated from `main`.

The next permitted step is **SA-01 — shared control-plane primitives**.

No Production mutation, deploy, merge or pull request is authorized by this checkpoint.
