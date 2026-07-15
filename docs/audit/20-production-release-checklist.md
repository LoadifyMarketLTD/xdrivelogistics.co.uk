# Audit 20 — Production Release Checklist

> Production Certification Phase — Phase 3 Final Gate
> **Every item must be marked PASS or FAIL. No estimated or assumed PASS.**
> Only verified results count.

## Metadata

| Field | Value |
|---|---|
| Completed by | |
| Date | |
| Platform URL | https://www.xdrivelogistics.co.uk |
| Android APK version | |
| Last migration applied | 129_serialize_overpayment_guard |
| All 20 audits completed | ☐ Yes ☐ No |
| Defect report finalized | ☐ Yes ☐ No |

---

## Module 1 — Customer Workflow

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1.1 | Customer can register and verify email end-to-end | ☐ PASS ☐ FAIL | |
| 1.2 | Customer onboarding completes and submits without error | ☐ PASS ☐ FAIL | |
| 1.3 | Admin can approve/reject company; customer receives notification | ☐ PASS ☐ FAIL | |
| 1.4 | Customer can post, edit, and cancel jobs | ☐ PASS ☐ FAIL | |
| 1.5 | Customer can view and compare bids; award bid correctly | ☐ PASS ☐ FAIL | |
| 1.6 | Customer can track driver live during active job | ☐ PASS ☐ FAIL | |
| 1.7 | Customer can view POD and download PDF after delivery | ☐ PASS ☐ FAIL | |
| 1.8 | Customer receives invoice after delivery | ☐ PASS ☐ FAIL | |

**Module 1 result:** ☐ PASS ☐ FAIL

---

## Module 2 — Driver Workflow

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 2.1 | Driver can login (web and APK) | ☐ PASS ☐ FAIL | |
| 2.2 | Driver can set availability; nearby jobs shown when available | ☐ PASS ☐ FAIL | |
| 2.3 | Driver can browse, filter, and quote on jobs | ☐ PASS ☐ FAIL | |
| 2.4 | Driver receives notification on bid award | ☐ PASS ☐ FAIL | |
| 2.5 | Driver can execute full journey: Start → Collection → Loaded → On My Way → Delivery | ☐ PASS ☐ FAIL | |
| 2.6 | Driver can submit POD: multiple photos + signature | ☐ PASS ☐ FAIL | |
| 2.7 | POD PDF generated correctly with all content | ☐ PASS ☐ FAIL | |
| 2.8 | Driver can generate, view, and submit invoice | ☐ PASS ☐ FAIL | |
| 2.9 | Driver's completed job history is accurate | ☐ PASS ☐ FAIL | |

**Module 2 result:** ☐ PASS ☐ FAIL

---

## Module 3 — Broker Workflow

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 3.1 | Broker can login and access broker dashboard | ☐ PASS ☐ FAIL | |
| 3.2 | Broker can post jobs and send carrier invitations | ☐ PASS ☐ FAIL | |
| 3.3 | Broker can compare bids and award to carrier | ☐ PASS ☐ FAIL | |
| 3.4 | Broker can track job and access POD | ☐ PASS ☐ FAIL | |

**Module 3 result:** ☐ PASS ☐ FAIL

---

## Module 4 — Fleet Workflow

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 4.1 | Fleet manager can add and manage drivers | ☐ PASS ☐ FAIL | |
| 4.2 | Fleet manager can add and manage vehicles with documents | ☐ PASS ☐ FAIL | |
| 4.3 | Fleet manager can distribute jobs to specific drivers | ☐ PASS ☐ FAIL | |
| 4.4 | Fleet manager can see live driver positions on map | ☐ PASS ☐ FAIL | |
| 4.5 | Company documents uploadable; expiry tracked | ☐ PASS ☐ FAIL | |

**Module 4 result:** ☐ PASS ☐ FAIL

---

## Module 5 — Admin Workflow

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 5.1 | Admin can view all users, companies, jobs platform-wide | ☐ PASS ☐ FAIL | |
| 5.2 | Admin can approve, reject, suspend companies | ☐ PASS ☐ FAIL | |
| 5.3 | Admin can manually assign drivers to jobs | ☐ PASS ☐ FAIL | |
| 5.4 | Admin can view and resolve disputes | ☐ PASS ☐ FAIL | |
| 5.5 | Admin can view audit log and platform analytics | ☐ PASS ☐ FAIL | |
| 5.6 | Super-admin can manage roles and permissions | ☐ PASS ☐ FAIL | |

**Module 5 result:** ☐ PASS ☐ FAIL

---

## Module 6 — Security

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 6.1 | RLS enabled and tested on all critical tables | ☐ PASS ☐ FAIL | |
| 6.2 | Zero cross-company data leakage confirmed | ☐ PASS ☐ FAIL | |
| 6.3 | All protected routes enforce role checks | ☐ PASS ☐ FAIL | |
| 6.4 | All protected API endpoints return 401/403 for unauthorized calls | ☐ PASS ☐ FAIL | |
| 6.5 | No secrets exposed in client-side code | ☐ PASS ☐ FAIL | |
| 6.6 | Storage buckets private; access restricted by company | ☐ PASS ☐ FAIL | |
| 6.7 | Session management correct (logout invalidates session) | ☐ PASS ☐ FAIL | |

**Module 6 result:** ☐ PASS ☐ FAIL

---

## Module 7 — Database

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 7.1 | All 129 migrations applied; no gaps | ☐ PASS ☐ FAIL | |
| 7.2 | All FK constraints and cascade rules functional | ☐ PASS ☐ FAIL | |
| 7.3 | All required triggers fire correctly | ☐ PASS ☐ FAIL | |
| 7.4 | Overpayment guard (migration 129) validated | ☐ PASS ☐ FAIL | |
| 7.5 | Realtime functional on required tables | ☐ PASS ☐ FAIL | |
| 7.6 | Query performance acceptable on main feeds | ☐ PASS ☐ FAIL | |

**Module 7 result:** ☐ PASS ☐ FAIL

---

## Module 8 — Android Application

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 8.1 | APK installs and launches on physical device | ☐ PASS ☐ FAIL | |
| 8.2 | Full driver journey completed end-to-end on physical device | ☐ PASS ☐ FAIL | |
| 8.3 | POD: photos + signature + PDF confirmed on physical device | ☐ PASS ☐ FAIL | |
| 8.4 | GPS tracking confirmed active and accurate | ☐ PASS ☐ FAIL | |
| 8.5 | Push notifications received on physical device | ☐ PASS ☐ FAIL | |
| 8.6 | 0 crashes and 0 ANR in 30-minute test session | ☐ PASS ☐ FAIL | |
| 8.7 | Dark and light mode both render correctly | ☐ PASS ☐ FAIL | |
| 8.8 | Offline queue functional (status + POD) | ☐ PASS ☐ FAIL | |

**Module 8 result:** ☐ PASS ☐ FAIL

---

## Module 9 — Notifications & Realtime

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 9.1 | In-app notifications delivered for all key events | ☐ PASS ☐ FAIL | |
| 9.2 | Email notifications delivered for all key events | ☐ PASS ☐ FAIL | |
| 9.3 | Push notifications (Android) delivered for bid award | ☐ PASS ☐ FAIL | |
| 9.4 | Realtime updates functional (jobs, bids, locations) | ☐ PASS ☐ FAIL | |
| 9.5 | Notifications scoped correctly (user receives only own) | ☐ PASS ☐ FAIL | |

**Module 9 result:** ☐ PASS ☐ FAIL

---

## Module 10 — File Management

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 10.1 | All document types upload correctly to correct buckets | ☐ PASS ☐ FAIL | |
| 10.2 | File type and size restrictions enforced | ☐ PASS ☐ FAIL | |
| 10.3 | Files not accessible between companies | ☐ PASS ☐ FAIL | |
| 10.4 | POD photos and signatures stored and retrievable | ☐ PASS ☐ FAIL | |
| 10.5 | POD PDF and Invoice PDF generated correctly | ☐ PASS ☐ FAIL | |

**Module 10 result:** ☐ PASS ☐ FAIL

---

## Module 11 — Performance

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 11.1 | Web pages load within acceptable time (< 3s) | ☐ PASS ☐ FAIL | |
| 11.2 | API endpoints respond within threshold (< 500ms p95) | ☐ PASS ☐ FAIL | |
| 11.3 | Android APK: 0 ANR, 0 crashes in 30-min session | ☐ PASS ☐ FAIL | |
| 11.4 | Android: RAM within limits; no memory leak | ☐ PASS ☐ FAIL | |
| 11.5 | Lighthouse performance score ≥ 70 on homepage | ☐ PASS ☐ FAIL | |

**Module 11 result:** ☐ PASS ☐ FAIL

---

## Module 12 — Production Infrastructure

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 12.1 | All production env vars configured correctly | ☐ PASS ☐ FAIL | |
| 12.2 | HTTPS enforced; SSL valid; HSTS present | ☐ PASS ☐ FAIL | |
| 12.3 | CI/CD pipeline passes all checks | ☐ PASS ☐ FAIL | |
| 12.4 | Platform health check returns healthy | ☐ PASS ☐ FAIL | |
| 12.5 | Email provider connected and working | ☐ PASS ☐ FAIL | |
| 12.6 | No test/seed data in production database | ☐ PASS ☐ FAIL | |

**Module 12 result:** ☐ PASS ☐ FAIL

---

## Module 13 — Defect Clearance

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 13.1 | Zero CRITICAL defects open | ☐ PASS ☐ FAIL | |
| 13.2 | Zero MAJOR defects open | ☐ PASS ☐ FAIL | |
| 13.3 | All FIXED defects re-tested and VERIFIED | ☐ PASS ☐ FAIL | |
| 13.4 | No regressions introduced by defect fixes | ☐ PASS ☐ FAIL | |
| 13.5 | Open MINOR/COSMETIC defects documented and accepted | ☐ PASS ☐ FAIL | |

**Module 13 result:** ☐ PASS ☐ FAIL

---

## Final Release Decision

### Module Summary

| Module | Status |
|---|---|
| 1 — Customer Workflow | ☐ PASS ☐ FAIL |
| 2 — Driver Workflow | ☐ PASS ☐ FAIL |
| 3 — Broker Workflow | ☐ PASS ☐ FAIL |
| 4 — Fleet Workflow | ☐ PASS ☐ FAIL |
| 5 — Admin Workflow | ☐ PASS ☐ FAIL |
| 6 — Security | ☐ PASS ☐ FAIL |
| 7 — Database | ☐ PASS ☐ FAIL |
| 8 — Android Application | ☐ PASS ☐ FAIL |
| 9 — Notifications & Realtime | ☐ PASS ☐ FAIL |
| 10 — File Management | ☐ PASS ☐ FAIL |
| 11 — Performance | ☐ PASS ☐ FAIL |
| 12 — Production Infrastructure | ☐ PASS ☐ FAIL |
| 13 — Defect Clearance | ☐ PASS ☐ FAIL |

---

> **The platform may only be declared production-ready when ALL 13 modules are marked PASS.**
> A single FAIL on any module blocks the release.

### Decision

- [ ] **🟢 GO — PRODUCTION RELEASE APPROVED**
  All 13 modules PASS. Zero CRITICAL/MAJOR defects. Platform is production-ready.

- [ ] **🔴 NO GO — PRODUCTION RELEASE BLOCKED**
  One or more modules FAIL. See Defect Report (Audit 11) for required fixes.

**Approved by:** ___________________________ **Role:** _______________

**Date of release approval:** _______________

**Planned release date:** _______________

---

*This document is the final gate of the XDrive Production Certification process. No module may be changed from FAIL to PASS without executing and verifying the corresponding audit test cases.*
