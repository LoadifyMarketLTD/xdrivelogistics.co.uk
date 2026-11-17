# XDrive POD: falsely completed legacy signatures — Production repair checkpoint
Date: 17 November 2026. Workstream: XDrive only, never Loadify Market.

## Defect reproduced from real XDrive Production data
GET /api/driver/web/jobs/:id/pod-draft returned completed:true solely when jobs.pod_generated=true, without inspecting required delivery photos, drawn signature, recipient name or canonical proof_of_delivery receipt. Reserve Driver used this status as the authoritative finalisation check, so historical typed-only PODs could be falsely reported complete, and missing evidence could not be supplied after the old flag had been set.

3 delivered job fixtures had pod_generated=true but recipient_typed_name_attestation rather than a drawn signature. 2 of those had Draft invoices; none had a non-Draft invoice. Other valid completed records must remain immutable. All current jobs in this workspace were created by the owner for tests.

## Repair
- GET and PUT on the authenticated POD draft route check the signed photo/name evidence, pod_generated_at and persisted canonical proof row before declaring completion, instead of trusting the flag alone.
- An incomplete delivered job may preserve/reload an authorised signature draft, while completed/invoiced jobs and valid signed archives stay immutable.
- Mobile and Web Driver final POD endpoints choose the existing record_driver_pod_atomic for new PODs, and the narrow service-role-only repair_incomplete_driver_pod_atomic for already-flagged but incomplete Delivered records.
- Both endpoints verify saved official evidence after an atomic write, and cannot report a false success from the old RPC's _alreadySubmitted result.
- Driver jobSelect now includes pod_generated_at for strict verification. No PWA visual redesign, navigation changes, or Super Admin code modifications.

## Database
XDrive Production project jqxlauexhkonixtjvljw: applied migration version 20261117110543, name repair_incomplete_signed_pod_atomic. Production postflight: service_role EXECUTE=true; anon/authenticated=false; 35 job records and 20 invoices unchanged, 3 incomplete test PODs remain to be manually resubmitted with real drawn signature evidence. No invoices or emails sent.
- Transaction-only DDL dry run passed, with ROLLBACK.
- Transaction-only SQL negative tests on a matching test job PASS: wrong driver denied; zero delivery photographs denied; typed signature denied. All operations rolled back.
- Server-only recovery is limited to previously flagged Delivered jobs, checks assigned driver's user ID, refuses non-Draft/non-Void invoices, rejects invalid submitted image evidence and never rewrites a complete official POD.

## QA
- 25 scoped Vitest files: 142/142 PASS, including 6 runtime GET/PUT tests and 10 targeted false completion tests.
- Root TypeScript PASS; scoped ESLint PASS.
- SQL migration filenames unique; no UTF-8 BOM; filename matches history.
- No GitHub Actions, no synthetic production POD submission, no payment or email side effects.
- On-device positive POD submission (OPPO) remains separate and must not be claimed passed without physical signature.

## Release
Code must be merged to main only after a passing Netlify Preview build. Then verify the exact published Netlify Production commit and healthy read-only routes. Do not claim the three legacy incomplete PODs were automatically corrected; a real in-app drawn signature is still required.
