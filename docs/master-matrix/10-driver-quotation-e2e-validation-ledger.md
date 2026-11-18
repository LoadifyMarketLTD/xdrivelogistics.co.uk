# Driver Quotation End-to-End Validation Ledger

**Generated**: 2026-07-25  
**Status**: **OPEN — NOT LIVE-VALIDATED**  
**Rule**: Do not mark bidding workflow **CLOSED** until authenticated runtime E2E + live database evidence exist.

---

## Driver Category Coverage (required)

| Driver category | Status | Evidence link |
|---|---|---|
| Individual owner-driver | NOT VALIDATED | TBD |
| Self-employed driver | NOT VALIDATED | TBD |
| Approved subcontractor | NOT VALIDATED | TBD |
| Driver without a company | NOT VALIDATED | TBD |
| Company-associated driver with bidding permission | NOT VALIDATED | TBD |
| Company-associated driver without bidding permission | NOT VALIDATED | TBD |
| Incomplete driver | NOT VALIDATED | TBD |
| Suspended driver | NOT VALIDATED | TBD |
| Expired-document driver | NOT VALIDATED | TBD |

## Client Surface Coverage (required)

| Surface | Status | Evidence link |
|---|---|---|
| Driver Web | NOT VALIDATED | TBD |
| `/m/` mobile web | NOT VALIDATED | TBD |
| Expo | NOT VALIDATED | TBD |
| Native Android | NOT VALIDATED | TBD |

---

## End-to-End Chain Validation (required per eligible category/surface)

| Chain checkpoint | Required proof | Status | Evidence link |
|---|---|---|---|
| V1 | Job visibility on listing page | NOT VALIDATED | TBD |
| V2 | Job detail visibility | NOT VALIDATED | TBD |
| V3 | Quote control visible/hidden correctly by permission | NOT VALIDATED | TBD |
| V4 | Quote submit handler executes | NOT VALIDATED | TBD |
| V5 | API/RPC accepts/rejects correctly | NOT VALIDATED | TBD |
| V6 | `job_bids` persistence in DB | NOT VALIDATED | TBD |
| V7 | RLS: actor can read own bid; unauthorized user denied | NOT VALIDATED | TBD |
| V8 | Refresh persistence (UI + DB stable after reload) | NOT VALIDATED | TBD |
| V9 | Broker/customer visibility of bid | NOT VALIDATED | TBD |
| V10 | Notification emission for quote lifecycle event | NOT VALIDATED | TBD |
| V11 | Acceptance/rejection lifecycle works | NOT VALIDATED | TBD |
| V12 | Audit history is recorded and queryable | NOT VALIDATED | TBD |

---

## Skipped E2E Groups — Runtime Execution Status

Current baseline run: **226 passed, 144 skipped, 0 failed**.

| Group | Exact blocker | Status |
|---|---|---|
| A (admin) | `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` missing | SKIPPED |
| B (driver) | `E2E_DRIVER_EMAIL` / `E2E_DRIVER_PASSWORD` missing | SKIPPED |
| C (broker) | `E2E_BROKER_EMAIL` / `E2E_BROKER_PASSWORD` missing | SKIPPED |
| D (carrier) | `E2E_CARRIER_EMAIL` / `E2E_CARRIER_PASSWORD` missing | SKIPPED |
| E (customer) | `E2E_CUSTOMER_EMAIL` / `E2E_CUSTOMER_PASSWORD` missing | SKIPPED |
| F (owner/super-admin) | `E2E_OWNER_EMAIL` / `E2E_OWNER_PASSWORD` missing | SKIPPED |
| G (production mutation) | `PLAYWRIGHT_BASE_URL` production target + `E2E_ALLOW_PRODUCTION_MUTATION=true` missing | SKIPPED |

### Failure reporting rule

When skipped groups are enabled, every non-pass result must be recorded with:

- exact test name;
- project (`chromium` or `mobile-safari`);
- root cause classification (`AUTH`, `RLS`, `API`, `UI`, `DATA`, `NOT_IMPLEMENTED`, `PLACEHOLDER`, `ENV`);
- evidence link (trace/log/screenshot/query output).

### Resolved local environment failures (pre-baseline)

Before Playwright browser installation, the suite reported 26 failures (13 test names × 2 projects).  
Root cause for all rows below: missing Playwright browser executables (`browserType.launch: Executable doesn't exist`).

| Exact test name | Affected projects | Root cause |
|---|---|---|
| CI public smoke › homepage responds and identifies XDrive | chromium, mobile-safari | ENV (browser binaries missing) |
| CI public smoke › login page exposes the email field | chromium, mobile-safari | ENV (browser binaries missing) |
| registration role contract (read-only) › registration exposes an individual driver path | chromium, mobile-safari | ENV (browser binaries missing) |
| registration role contract (read-only) › registration exposes owner-driver workspace choice | chromium, mobile-safari | ENV (browser binaries missing) |
| registration role contract (read-only) › public user cannot open protected dashboards | chromium, mobile-safari | ENV (browser binaries missing) |
| Public pages › homepage loads and shows CTA | chromium, mobile-safari | ENV (browser binaries missing) |
| Public pages › homepage has navigation links | chromium, mobile-safari | ENV (browser binaries missing) |
| Public pages › request-quote page loads | chromium, mobile-safari | ENV (browser binaries missing) |
| Public pages › login page loads | chromium, mobile-safari | ENV (browser binaries missing) |
| Auth redirects › unauthenticated /admin redirects to login | chromium, mobile-safari | ENV (browser binaries missing) |
| Auth redirects › unauthenticated /driver/jobs redirects to login | chromium, mobile-safari | ENV (browser binaries missing) |
| Auth redirects › unauthenticated /super-admin redirects to login | chromium, mobile-safari | ENV (browser binaries missing) |
| Auth redirects › unauthenticated /customer redirects to login | chromium, mobile-safari | ENV (browser binaries missing) |

---

## Remediation Queue

| Item class | Current state | Closure criterion |
|---|---|---|
| NOT_IMPLEMENTED | Open | Implemented + runtime evidence linked |
| PLACEHOLDER | Open | Replaced by real implementation + runtime evidence linked |
| Permission gaps for quotation | Open | All eligible categories validated across required surfaces |

---

## Closure Gate

Bidding workflow remains **OPEN** until:

1. all applicable V1–V12 checkpoints are evidenced;
2. all required category/surface rows are validated or explicitly disqualified with evidence;
3. no unresolved NOT_IMPLEMENTED/PLACEHOLDER blockers remain in the active quotation path.
