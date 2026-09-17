# XDrive Logistics — P0 Fleet Platform Incident & Remediation Plan

**Date:** 2026-09-17  
**Repository:** `LoadifyMarketLTD/xdrivelogistics.co.uk`  
**Production Supabase:** `jqxlauexhkonixtjvljw` (`xdrivelogistics`)  
**Severity:** P0 — production workflow blocker  
**Status:** REMEDIATION IN PROGRESS

## Executive summary

A real Fleet Manager reported that Drivers and Vehicles can be created, but the Fleet workspace cannot complete compliance documents and therefore cannot reliably make resources operational. The report is confirmed by repository inspection and live production ACL inspection.

The primary defect is an architecture mismatch: `/admin/documents` performs direct browser writes to `driver_documents` and `vehicle_documents`, while production deliberately grants authenticated browser clients only `SELECT` on those compliance tables. This leaves the Fleet workflow stranded after Driver/Vehicle creation.

The platform must keep the hardened read-only browser ACL and move compliance mutations behind authenticated server authority. The existing Driver self-service upload repair already proves this is the canonical architecture.

## Confirmed P0 defects

### P0-01 — Fleet Driver document creation is blocked

`/admin/documents` uploads a file and then calls browser-side Supabase `INSERT` on `public.driver_documents`.

Production effective table grant for `authenticated`:

- `driver_documents`: `SELECT` only
- no `INSERT`
- no `UPDATE`

**Impact:** Fleet Manager can add a Driver but cannot complete the Driver compliance record.

**Required fix:** persist the compliance record through an authenticated server API using service authority after verifying the caller's active company-admin/operator membership and subject ownership.

### P0-02 — Fleet Vehicle document creation is blocked

`/admin/documents` also performs browser-side `INSERT` on `public.vehicle_documents`.

Production effective table grant for `authenticated`:

- `vehicle_documents`: `SELECT` only
- no `INSERT`
- no `UPDATE`

**Impact:** Vehicle compliance cannot be completed from the Fleet dashboard.

**Required fix:** same server-authoritative upload-record persistence pattern as Driver documents.

### P0-03 — Fleet document approval/status mutation is blocked

The admin page performs direct browser `UPDATE` on compliance tables.

Production grants do not permit these writes.

**Impact:** `pending -> approved/rejected` cannot reliably complete from the Fleet Manager workspace.

**Required fix:** status mutations must be executed by a validated server endpoint. Company-level review must stay tenant-scoped and separate from Platform Owner governance review.

### P0-04 — Expiring signed URL is incorrectly persisted as `file_path`

The current Fleet upload page creates a 3600-second signed Storage URL and stores that URL in the database.

**Impact:** the persisted document reference can expire roughly one hour after upload. Document preview/download then becomes unreliable even if the database row exists.

**Required fix:** store the stable Storage object path, e.g. `companyId/subjectId/object.pdf`. Generate a signed URL only when a user requests preview/download.

### P0-05 — Fleet readiness is not actionable

The Fleet Drivers register exposes account status and a document count, but operational eligibility depends on more than `drivers.status = active`.

Canonical readiness requires, at minimum:

- active Driver account;
- current Driver compliance;
- exactly one eligible/canonical assigned vehicle for allocation where required;
- current Vehicle compliance;
- no blocking compliance state.

**Impact:** a Fleet Manager can see `active` but still fail allocation, with no clear dashboard checklist explaining why.

**Required fix:** show explicit readiness states and blockers per Driver and Vehicle.

### P0-06 — Fleet workflow can create resources but cannot complete the lifecycle

Observed broken lifecycle:

`Add Driver -> Add Vehicle -> Assign -> Upload documents -> write blocked -> compliance incomplete -> apparent Active -> operational allocation rejected`

**Required fix:** repair the full lifecycle, not only a single button.

## Confirmed P1 defects

### P1-01 — Remove Driver uses a browser DELETE that production does not grant

Production effective grant on `drivers` for `authenticated` does not include `DELETE`, while the page calls direct browser `.delete()`.

**Required fix:** move deletion/removal behind an authenticated server endpoint with company-admin authorization and database-constraint-safe failure handling.

### P1-02 — Delete Vehicle uses a browser DELETE that production does not grant

Production effective grant on `vehicles` for `authenticated` does not include `DELETE`, while the page calls direct browser `.delete()`.

**Required fix:** move deletion behind an authenticated server endpoint with tenant authorization.

### P1-03 — Two production profiles currently have no canonical role

Production role inventory includes profiles with `role IS NULL`.

**Impact:** dashboard routing/capability resolution can become incomplete or blocked for those accounts.

**Required fix:** investigate each null-role profile against Auth, onboarding application, company membership and intended workspace before any role backfill. Do not guess roles.

## Four-role audit state

### Fleet / Carrier

**Current:** FAIL / P0 blocker.

Main blocker: Driver/Vehicle compliance completion and actionable operational readiness.

### Driver / Owner Driver

**Current:** PARTIAL.

Driver self-service compliance upload already uses the correct server-authoritative persistence architecture. Fleet Admin must be converged to the same security model.

### Customer / Shipper

**Current:** PARTIAL — requires runtime E2E certification for posting, award, delivery follow-up, POD and invoice delivery.

### Broker / Shipper

**Current:** PARTIAL — carrier invitation, award, dispute/POD and invoice paths require complete runtime certification.

## Required remediation — execution order

1. **P0 Fleet compliance API**
   - add authenticated company-admin/operator API for Driver/Vehicle document persistence;
   - verify caller JWT;
   - verify active membership and active company;
   - verify Driver/Vehicle belongs to the caller's company;
   - verify Storage path tenant/subject prefix;
   - verify uploaded object exists and content type/size where practical;
   - persist stable object path only;
   - keep browser DB ACL read-only.

2. **P0 Fleet compliance status API**
   - server-side status mutation;
   - tenant/subject authorization;
   - allowed state validation;
   - review metadata where supported;
   - no direct browser update grants.

3. **P0 secure preview/download**
   - server-authorised signed URL generation on demand;
   - never persist expiring signed URL as canonical `file_path`.

4. **P0 Fleet dashboard readiness**
   - display Driver account state;
   - Driver document completeness/status;
   - assigned/canonical Vehicle;
   - Vehicle document completeness/status;
   - operational readiness badge;
   - explicit blocker list;
   - direct action to complete missing compliance.

5. **P1 Driver removal API**
   - replace browser DELETE with authorised server mutation;
   - return a clear conflict if database references prevent hard delete.

6. **P1 Vehicle deletion API**
   - replace browser DELETE with authorised server mutation;
   - preserve tenant boundary and return actionable conflicts.

7. **P1 null-role reconciliation**
   - read-only inspect affected profiles/auth/memberships/onboarding;
   - backfill only where evidence uniquely establishes intended role.

8. **Cross-role E2E release gate**
   - Customer posts load;
   - Fleet/Carrier sees and quotes;
   - Customer/Broker awards;
   - Fleet allocates Driver + canonical compliant Vehicle;
   - Driver accepts and executes collection/delivery;
   - POD is uploaded and visible to authorised parties;
   - invoice is generated/visible;
   - notifications are received by correct recipients;
   - no cross-company leakage.

## Security constraints — must not regress

- Do **not** grant browser `INSERT/UPDATE/DELETE` broadly on protected compliance tables just to make the UI work.
- Do **not** expose `service_role` to the client.
- Do **not** weaken RLS to bypass application defects.
- Do **not** persist expiring signed URLs as canonical document identity.
- Do **not** auto-approve compliance documents solely to unlock a Fleet account.
- Do **not** guess roles for null-role profiles.

## Definition of done

Fleet is only considered operational when a real Fleet Manager can complete this sequence without Platform Owner intervention:

1. create Driver;
2. create Vehicle;
3. assign Driver/Vehicle;
4. upload all required documents;
5. see each compliance state;
6. complete permitted company-level review actions;
7. see exact remaining blockers;
8. reach `Operationally Ready` when all canonical requirements are met;
9. allocate the Driver/Vehicle to an awarded job;
10. Driver can see and execute that job;
11. POD and invoice complete successfully.

Until this sequence passes with production-like permissions, Fleet remains a release blocker.
