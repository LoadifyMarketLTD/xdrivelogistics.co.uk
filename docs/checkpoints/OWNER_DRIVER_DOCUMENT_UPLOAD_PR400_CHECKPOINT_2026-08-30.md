# Owner Driver document upload — PR #400 checkpoint — 2026-08-30

## Repository truth
- Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`
- Base branch: `main`
- Base commit: `14b24e7260cfa1c5a447ecc3ddc7884f9c8b77dd`
- Working branch: `fix/owner-driver-document-upload-20260830`
- Pull request: `#400 — Fix owner-driver document upload and vehicle compliance remediation`
- Functional implementation HEAD before this checkpoint commit: `4d4ab330902c37da55e385524e1c26f2fddcc0bf`
- PR state at checkpoint creation: OPEN / DRAFT / MERGEABLE / NOT MERGED
- Canonical Netlify `netlify/xdrivelogistics/deploy-preview`: SUCCESS on functional HEAD `4d4ab330902c37da55e385524e1c26f2fddcc0bf`
- Preview: `https://deploy-preview-400--xdrivelogistics.netlify.app`

## Production source of truth
Production Supabase project remains:
- name: `xdrivelogistics`
- ref: `jqxlauexhkonixtjvljw`

Hosted migration applied during this audit:
- `20260830020916_repair_owner_driver_document_storage_contract`

Verified hosted effects:
- `driver-docs` remains private;
- file size limit remains 10 MB;
- allowed MIME types are PDF, JPEG, PNG and WEBP;
- legacy signed-URL `file_path` rows were normalized only when the underlying object was proven to exist;
- zero signed-URL `file_path` rows remain in `driver_documents` / `vehicle_documents`;
- no orphan storage objects were deleted.

## Defects found

### 1. Browser-direct storage and DB mutation
`/driver/documents` uploaded directly from the browser to `driver-docs`, then directly inserted into `driver_documents`.

This made the workflow depend on browser RLS/storage policies and created a different security contract from the server-authoritative Expo/API flows.

### 2. Circular `app_access` remediation block
Production self-upload policies for Driver documents/storage require `drivers.app_access = true`.

The protected Driver route gate also required `app_access=true` for `/driver/documents`.

Therefore a Driver who needed documents/vehicle remediation before app access approval could not reach or use the remediation surface.

### 3. Owner Driver vehicle assignment missing
Production had two active Owner Driver memberships and zero Driver-to-vehicle assignments.

Observed inventory:
- Owner Driver with `app_access=true`: company has one ACTIVE vehicle, but `assigned_driver_id` is null;
- Owner Driver with `app_access=false`: company currently has no vehicle.

The canonical operational eligibility contract requires exactly one ACTIVE assigned vehicle, so merely adding a company vehicle was not sufficient.

### 4. WEBP mismatch
The web/mobile application accepted WEBP, while the production `driver-docs` bucket allowed only PDF/JPEG/PNG.

WEBP could therefore pass client/API validation and fail at storage.

### 5. Legacy signed URL stored as `file_path`
One `driver_documents.file_path` contained a full expiring signed URL instead of a stable bucket object path.

The underlying object existed. The hosted migration normalized that record to its relative object path.

### 6. Driver/Vehicle compliance families mixed
The old Driver Documents page inserted every selected type into `driver_documents`; it did not expose a Vehicle scope or vehicle selector.

Canonical vehicle eligibility requires Vehicle MOT + Insurance in `vehicle_documents`, so the Driver page could not complete that contract.

### 7. Legacy onboarding state remains separate
The two production Owner Driver test records currently have no matching `onboarding_application` for their user/company pair.

This PR deliberately does not claim that runtime `driver_documents` / `vehicle_documents` upload reconstructs or approves historical onboarding state. Legacy onboarding reconciliation is a separate future decision/gate.

## Implemented repairs

### Server-authoritative Driver Documents API
New route:
- `app/api/driver/documents/route.ts`

Contracts:
- bearer-authenticated user validation;
- active Driver profile required;
- active company + active membership required;
- document remediation does not require `app_access=true`;
- Driver vs Vehicle document scope is explicit;
- Owner/Admin Driver can manage same-company vehicle evidence;
- non-admin Driver can manage only the vehicle assigned to that Driver;
- max 10 MB;
- PDF/JPEG/PNG/WEBP allow-list;
- magic-byte validation;
- SHA-256 persisted;
- service-role storage write after authorization;
- DB insert after storage write;
- uploaded object removed if DB insert fails;
- fresh one-hour signed read URLs generated server-side;
- legacy full signed URLs normalized before readback.

### Driver Documents web page
`app/driver/documents/page.tsx` now:
- no longer writes directly to Supabase Storage;
- no longer inserts directly into `driver_documents`;
- calls `/api/driver/documents`;
- separates `Driver document` and `Vehicle document`;
- provides a vehicle selector;
- presents MOT/Insurance under Vehicle documents;
- warns when no vehicle is assigned;
- supports secure server-generated `View document` links;
- shows remediation warning when app access is pending.

### Explicit Owner Driver vehicle assignment
`app/api/driver/vehicles/route.ts` adds:
- `assign_to_me` action.

It rejects:
- cross-company vehicle assignment;
- inactive vehicles;
- vehicles already assigned to another Driver;
- a second active vehicle when the Driver already has one;
- stale concurrent assignment using `assigned_driver_id IS NULL` guard.

`app/driver/vehicles/page.tsx` adds the matching `Assign to me` control for an available ACTIVE company vehicle.

### Route access remediation exception
`lib/roleCapabilities.ts` keeps account/company/Driver active-state checks but allows these two remediation surfaces before app access is approved:
- `/driver/documents`
- `/driver/vehicles`

All other Driver commercial/execution routes retain the normal `app_access=true` gate.

### Contract test
Added:
- `__tests__/ownerDriverDocumentUploadContract.test.ts`

The test locks:
- server-authoritative upload;
- Driver vs Vehicle separation;
- remediation-only app-access exception;
- controlled `Assign to me` semantics;
- WEBP bucket alignment;
- no orphan-object deletion;
- legacy path normalization + fresh signed readback.

## Validation truth

### PASS
- production migration applied;
- production bucket contract verified;
- legacy signed URL normalized;
- PR diff limited to 7 intended files;
- `/super-admin` untouched;
- no PR #359 Workspace visual changes;
- PR mergeability recalculated TRUE;
- canonical Netlify build/typecheck SUCCESS on functional HEAD `4d4ab330902c37da55e385524e1c26f2fddcc0bf`.

### NOT EXECUTED / NOT PASS
GitHub Actions remains infrastructure-blocked. Current jobs terminate before runner startup with:
- `steps=[]`
- `runner_id=0`
- empty runner name.

Therefore Build & Lint, Public E2E, CodeQL, Visual Fixture Gate, migration validator and the new Vitest contract are not claimed executed by GitHub Actions.

## Runtime gates still required before merge
1. Owner Driver opens `/driver/vehicles` in Preview and uses `Assign to me` on the intended ACTIVE company vehicle.
2. Verify production `vehicles.assigned_driver_id` becomes exactly the Owner Driver id and canonical vehicle eligibility no longer reports `canonical_vehicle_missing`.
3. Owner Driver uploads one Driver document through `/driver/documents`.
4. Owner Driver uploads Vehicle MOT and Insurance against the assigned vehicle.
5. Verify production rows contain relative object paths and matching `driver-docs` objects.
6. Verify `View document` opens a fresh signed URL.
7. Test a WEBP upload once to prove the hosted MIME change at runtime.
8. Verify an active Driver with `app_access=false` can reach Documents/Vehicles remediation while Driver commercial/execution routes remain denied.
9. Do not merge until these authenticated runtime gates are either observed or explicitly deferred with an accepted risk decision.

## Resume order
1. hard refresh Preview #400;
2. test `Vehicles -> Assign to me`;
3. query production assignment/canonical eligibility;
4. test Driver document upload;
5. query DB + Storage round-trip;
6. test Vehicle MOT/Insurance upload;
7. query DB + Storage round-trip and eligibility;
8. test View document;
9. test WEBP;
10. decide legacy onboarding reconciliation separately;
11. update PR #400 truth;
12. merge only after factual release decision.
