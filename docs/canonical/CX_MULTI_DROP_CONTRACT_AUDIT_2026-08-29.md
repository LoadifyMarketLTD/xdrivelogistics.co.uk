# CX → XDrive Multi-drop Contract Audit

Date: 2026-08-29
Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`
Branch: `fix/cx-dashboard-convergence-20260829`
Scope: functional parity audit only; no DB/RLS/mobile rewrite is authorised by this note.

## Verdict

`BLOCKED-BY-CONTRACT` for full CX-style multi-drop execution.

XDrive currently recognises `multi_drop` as a service/job-description classification, but the repository does not contain a canonical stop entity or ordered stop execution contract. Therefore a Multi-drop label/filter is not sufficient to claim execution parity.

## CX source behaviour extracted from supplied material

The supplied Courier Exchange material treats Multi-drop as an operational booking type rather than a cosmetic load label. The job must be executable through multiple collection/delivery points while preserving booking progress, driver instructions, proof/evidence and final completion semantics. CX also distinguishes larger stop-count scenarios from ordinary multi-drop work and points users toward Daily Hire for high-stop-count work.

The wider CX execution material supplied alongside it establishes the lifecycle context that each transport must remain visible through status progression and evidence collection:

- On my way to pickup
- On-site (Pickup)
- Loaded
- On-site (Delivery)
- POD / delivered completion

For XDrive parity, a multi-drop job therefore needs ordered stops and per-stop state/evidence; one origin and one destination row cannot truthfully represent the complete job.

## Current XDrive evidence

### 1. Service classification exists

`supabase/migrations/124_smart_destination_priority.sql` permits:

```text
service_mode IN ('asap_direct', 'timed_direct', 'coload_permitted', 'flexible', 'multi_drop')
```

and `app/api/driver/search-loads/route.ts` maps a service containing `multi` to the `multi_drop` job-description filter.

This is useful marketplace/search metadata only.

### 2. No canonical ordered stop model found

Repository audit found no canonical `job_stops`/`load_stops`/ordered stop sequence entity supporting:

- stop sequence/order;
- collection vs delivery stop type;
- stop address/postcode and contact;
- planned/actual arrival/departure;
- per-stop status;
- per-stop notes/instructions;
- per-stop photos/signature/evidence;
- failed/skipped/exception handling;
- final-stop completion semantics.

Do not fabricate these values in UI from the single pickup/delivery columns.

### 3. Existing canonical lifecycle is strong but job-level

`public.driver_update_job_status_atomic(...)` already enforces the canonical single-job lifecycle:

```text
awarded/allocated
→ on_my_way
→ on_site_pickup
→ loaded
→ in_transit
→ on_site_delivery
→ delivered
→ completed
```

It also requires loading evidence and POD evidence where applicable. This contract should be preserved and extended deliberately for multi-stop work rather than bypassed.

### 4. Desktop/operator execution also exists at job level

`app/api/admin/jobs/[id]/transition/route.ts` permits authorised executing-company operators to progress the same lifecycle manually and preserves POD-before-delivered checks.

This is good CX parity for ordinary single-pickup/single-delivery work, but it still has no stop context.

## Required XDrive contract before implementation can be called complete

A safe future implementation needs an authoritative stop model, preferably additive and backward compatible. Minimum semantics:

1. stable stop ID and job ID;
2. integer sequence with uniqueness per job;
3. stop type (`pickup`, `delivery`, or explicitly supported waypoint type);
4. private exact address/contact fields protected by existing job visibility rules;
5. public/pre-award projection that never leaks exact stop locations;
6. planned arrival/departure and actual timestamps;
7. stop lifecycle/status and exception state;
8. notes/instructions;
9. evidence requirements and evidence references;
10. actor/audit history;
11. deterministic current/next stop;
12. final-job completion only when all required stops are complete or explicitly resolved;
13. idempotent/offline-safe mobile mutation semantics;
14. operator/manual fallback using the same authority rules;
15. tracking/Freight Vision representation of current stop and overall progress.

## Compatibility rule

Ordinary existing jobs must remain valid without stop rows. A future migration must not rewrite every historical single-leg job into synthetic stops unless that migration is separately audited and proven safe.

## UI rule until the contract exists

Allowed now:

- show/search/filter `Multi-drop` when `service_mode` says so;
- show a truthful badge that the booking is multi-drop;
- preserve existing job-level route summary.

Not allowed now:

- fake stop lists;
- invent per-stop completion;
- claim CX multi-drop execution parity;
- treat one pickup + one delivery as the complete multi-drop workflow;
- weaken POD/lifecycle checks to simulate completion.

## Current disposition

- Marketplace classification: `KEEP`
- Search/filter recognition: `KEEP`
- Multi-drop operational execution: `BLOCKED-BY-CONTRACT`
- Multi-stop tracking: `BLOCKED-BY-CONTRACT`
- Per-stop POD/evidence: `BLOCKED-BY-CONTRACT`
- Daily Hire as a distinct marketplace load type: `KEEP` for classification/search; execution semantics remain separate from multi-stop contract.

## Next safe engineering action

Do not add a migration inside the current UI convergence scope. First complete the remaining CX parity audit and then design the stop schema/API/RLS/offline contract as a dedicated reviewed backend change. The existing canonical driver lifecycle, operator transition authority, POD requirements and pre-award privacy rules are constraints, not implementation details to bypass.
