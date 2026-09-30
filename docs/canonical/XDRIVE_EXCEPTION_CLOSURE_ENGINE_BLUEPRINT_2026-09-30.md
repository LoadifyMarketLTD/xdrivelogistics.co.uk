# XDrive Exception & Closure Engine — Canonical Blueprint

**Date:** 2026-09-30  
**Status:** Implementation started  
**Scope:** Operational exception detection, ownership, SLA ageing, escalation, customer-update obligations, and verified closure.

## 1. Why this exists

XDrive already has the operational primitives: Incidents, Dispatch priority queues, POD review/remediation, stale GPS signals, customer update feeds, invoice lifecycle handling, and the persistent Platform Action Centre.

The gap is not another dashboard. The gap is a single deterministic contract that turns operational signals into owned, time-bound work and proves closure.

## 2. Canonical lifecycle

```
Detect -> Dedupe -> Prioritise -> Assign -> Act -> Escalate -> Verify -> Close
```

Every actionable exception must answer:

- What happened?
- Which job/entity is affected?
- What is the severity?
- Who owns it?
- What must happen next?
- When is the SLA due?
- Is the SLA breached?
- Has the case escalated?
- Is a customer update due?
- What evidence proves closure?

## 3. Existing XDrive capability retained

Do not rebuild these systems:

- `/admin/incidents` — operational exception queue.
- Dispatcher priority queue — unallocated, exception, imminent pickup signals.
- POD Queue and POD review/remediation.
- Stale GPS/freshness warnings.
- Customer Updates feed from `notification_events`.
- Delivered/completed -> invoice generation path.
- `platform_cases` + `platform_case_events` — persistent cross-domain case registry.
- Platform Action Centre — Platform Owner investigation and closure surface.

The Exception & Closure Engine is an orchestration layer over these canonical records.

## 4. Phase 1 — SLA + ownership hardening

Extend `platform_cases` with:

- `sla_due_at`
- `sla_breached_at`
- `escalated_at`
- `escalation_level`
- `next_action`
- `next_action_due_at`
- `customer_update_due_at`
- `closure_due_at`

Default SLA policy:

| Severity | Initial SLA |
|---|---:|
| P0 | 15 minutes |
| P1 | 30 minutes |
| P2 | 2 hours |
| P3 | 8 hours |

An active case becomes breached when `sla_due_at <= now()`. A breach is persisted, not merely calculated in the browser.

## 5. Phase 2 — automatic detectors

Canonical detectors to add incrementally, each with a stable `dedupe_key`:

1. `pickup_overdue`
2. `delivery_overdue`
3. `driver_status_stale`
4. `driver_gps_stale`
5. `pod_missing`
6. `pod_rejected`
7. `invoice_generation_failed`
8. `delivered_without_invoice`
9. `customer_update_overdue`
10. `job_unallocated_collection_imminent`
11. `exception_unowned`
12. `payment_overdue`
13. `payment_disputed`

Detector rules must never fabricate source state. Domain tables remain authoritative.

## 6. Phase 3 — communication SLA

Customer communication is distinct from event history.

A customer update obligation should be created when a material operational condition occurs, for example:

- pickup/delivery delay crosses policy threshold;
- driver/tracking signal becomes stale during active execution;
- delivery exception is raised;
- POD is missing/rejected after delivery;
- material reschedule/cancellation occurs.

The case stores `customer_update_due_at`. A sent/acknowledged communication event clears the obligation.

## 7. Phase 4 — closure integrity

A job must not be treated as fully closed solely because execution reached `delivered` or `completed`.

Closure checks:

- required POD/evidence exists and is accepted where review is required;
- invoice exists or an explicit non-invoice reason is recorded;
- unresolved dispute/exception does not remain open;
- customer communication obligations are satisfied;
- final financial state is reachable and auditable.

## 8. Escalation policy

Initial implementation persists breach/escalation state.

Future routing matrix:

- operational exception -> Dispatcher / Fleet
- POD/evidence -> Operations / Compliance
- invoice/receivable -> Finance
- unresolved P0/P1 or repeated SLA breach -> Platform Owner
- company-specific operational case -> authorised company owner/admin where policy permits

## 8.1 Automatic reconciliation authority

Production reconciliation is scheduled by Supabase Cron rather than a browser session.

- canonical cadence: every minute;
- scheduler: hosted Supabase pg_cron;
- dispatcher: a service-controlled database reconciliation function; the browser is not the scheduling authority;
- manual Action Centre reconciliation remains an explicit operator control, not the scheduling authority;
- Deploy Preview is inspection-only and rejects reconciliation writes server-side;
- stable detector/entity dedupe keys keep repeated reconciliation idempotent;
- automated runs assign engine-created cases, persist SLA breaches, and escalate overdue customer-update and verified-closure obligations.

## 9. UI contract

Action Centre list must expose:

- severity
- case/reference
- affected entity
- status
- owner
- SLA state
- next action / due
- updated time

Priority ordering should be deterministic:

1. breached P0
2. breached P1
3. unowned active cases
4. due-soon SLA
5. remaining active cases

## 10. Safety / integrity rules

- No duplicate active cases for the same detector/entity contract.
- No browser-only SLA truth; breach state is persisted server-side.
- No direct client writes to platform case tables.
- Domain records remain authoritative.
- Automated reconciler writes semantic system events.
- Deploy Preview remains read-only.
- Production rollout requires migration + API + UI + regression tests + runtime evidence.

## 11. Implementation sequence

1. **Now:** SLA schema, automatic breach reconciliation, API exposure, Action Centre SLA visibility, tests.
2. Detector engine for job/POD/invoice exceptions.
3. Customer communication obligations.
4. Closure integrity gate.
5. Company-role routing and notification/escalation policies.
6. Production E2E and public product messaging only after runtime verification.
