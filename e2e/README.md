# XDrive Logistics Platform E2E Playwright Forensic Audit Suite

This automated suite uses [Playwright](https://playwright.dev/) to functionally test and forensically audit core business operations for the XDrive Logistics platform.

---

## Test Spec Files

| Spec file | Type | Skip condition |
|---|---|---|
| `ci-public-smoke.spec.ts` | Browser | None — always runs |
| `public.spec.ts` | Browser | None — always runs |
| `role-workspace-capability-contract.spec.ts` | Pure unit | None — always runs |
| `canonical-company-membership-contract.spec.ts` | Pure unit | None — always runs |
| `individual-driver-onboarding-contract.spec.ts` | Pure unit | None — always runs |
| `invoice-lifecycle-contract.spec.ts` | Mixed | Authenticated section: `E2E_ADMIN_EMAIL` |
| `quote-lifecycle-contract.spec.ts` | Mixed | Authenticated section: `E2E_ADMIN_EMAIL` |
| `job-operations-contract.spec.ts` | Mixed | Authenticated section: `E2E_ADMIN_EMAIL` |
| `driver-workspace-contract.spec.ts` | Mixed | Authenticated section: `E2E_DRIVER_EMAIL` |
| `finance-workspace-contract.spec.ts` | Mixed | Authenticated section: `E2E_ADMIN_EMAIL` |
| `auth.spec.ts` | Browser + auth | `E2E_ADMIN_EMAIL`, `E2E_DRIVER_EMAIL` |
| `broker.spec.ts` | Browser + auth | `E2E_BROKER_EMAIL` |
| `customer.spec.ts` | Browser + auth | `E2E_CUSTOMER_EMAIL` |
| `super-admin.spec.ts` | Browser + auth | `E2E_OWNER_EMAIL` + `E2E_OWNER_PASSWORD` |
| `super-admin-support.spec.ts` | Browser + auth | `E2E_OWNER_EMAIL` + `E2E_OWNER_PASSWORD` |
| `production-user-lifecycle.spec.ts` | Mixed | Read-only: none; Mutation: `PLAYWRIGHT_BASE_URL` + `E2E_ALLOW_PRODUCTION_MUTATION=true` |

---

## Exact Skip Matrix — 58 Skipped Tests (29 unique × 2 browsers)

> Tests run against both `chromium` and `mobile-safari` projects (× 2 factor).

### auth.spec.ts — 14 skips (7 unique)

Skip condition: `describe.skip(!ADMIN_EMAIL)` / `describe.skip(!DRIVER_EMAIL)`

| # | Test name | Skip reason | Blocked by SUPABASE_SERVICE_ROLE_KEY? | Can activate without extra creds? |
|---|---|---|---|---|
| 1 | Admin portal › admin can log in and see dashboard | `E2E_ADMIN_EMAIL` not set | No | Yes — set `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD` |
| 2 | Admin portal › admin fleet page shows map placeholder | `E2E_ADMIN_EMAIL` not set | No | Yes |
| 3 | Admin portal › admin jobs page loads | `E2E_ADMIN_EMAIL` not set | No | Yes |
| 4 | Admin portal › admin drivers page loads | `E2E_ADMIN_EMAIL` not set | No | Yes |
| 5 | Admin portal › admin marketplace page loads | `E2E_ADMIN_EMAIL` not set | No | Yes |
| 6 | Driver portal › driver can log in and see jobs dashboard | `E2E_DRIVER_EMAIL` not set | No | Yes — set `E2E_DRIVER_EMAIL` + `E2E_DRIVER_PASSWORD` |
| 7 | Driver portal › driver availability page loads | `E2E_DRIVER_EMAIL` not set | No | Yes |

### broker.spec.ts — 12 skips (6 unique)

Skip condition: `describe.skip(!BROKER_EMAIL)`

| # | Test name | Skip reason | Blocked by SUPABASE_SERVICE_ROLE_KEY? | Can activate without extra creds? |
|---|---|---|---|---|
| 8 | Broker workspace › broker dashboard loads | `E2E_BROKER_EMAIL` not set | No | Yes — set `E2E_BROKER_EMAIL` + `E2E_BROKER_PASSWORD` |
| 9 | Broker workspace › load board page loads | `E2E_BROKER_EMAIL` not set | No | Yes |
| 10 | Broker workspace › bids page loads | `E2E_BROKER_EMAIL` not set | No | Yes |
| 11 | Broker workspace › awards page loads | `E2E_BROKER_EMAIL` not set | No | Yes |
| 12 | Broker workspace › load board nav links are present | `E2E_BROKER_EMAIL` not set | No | Yes |
| 13 | Broker workspace › broker loads nav leads to bids page | `E2E_BROKER_EMAIL` not set | No | Yes |

### customer.spec.ts — 14 skips (7 unique)

Skip condition: `describe.skip(!CUSTOMER_EMAIL)`

| # | Test name | Skip reason | Blocked by SUPABASE_SERVICE_ROLE_KEY? | Can activate without extra creds? |
|---|---|---|---|---|
| 14 | Customer portal › customer workspace loads | `E2E_CUSTOMER_EMAIL` not set | No | Yes — set `E2E_CUSTOMER_EMAIL` + `E2E_CUSTOMER_PASSWORD` |
| 15 | Customer portal › quotes tab visible | `E2E_CUSTOMER_EMAIL` not set | No | Yes |
| 16 | Customer portal › deliveries tab visible | `E2E_CUSTOMER_EMAIL` not set | No | Yes |
| 17 | Customer portal › post load tab visible | `E2E_CUSTOMER_EMAIL` not set | No | Yes |
| 18 | Customer portal › post load tab shows form fields | `E2E_CUSTOMER_EMAIL` not set | No | Yes |
| 19 | Customer portal › invoices tab visible | `E2E_CUSTOMER_EMAIL` not set | No | Yes |
| 20 | Customer portal › updates tab visible | `E2E_CUSTOMER_EMAIL` not set | No | Yes |

### super-admin.spec.ts — 4 skips (2 unique)

Skip condition: `describe.skip(!OWNER_EMAIL \|\| !OWNER_PASSWORD)`

| # | Test name | Skip reason | Blocked by SUPABASE_SERVICE_ROLE_KEY? | Can activate without extra creds? |
|---|---|---|---|---|
| 21 | Super Admin finance/notifications › notifications view loads canonical notification_events data | `E2E_OWNER_EMAIL` not set | **Yes** — API returns 503 without `SUPABASE_SERVICE_ROLE_KEY` | No — requires both owner credentials AND service role key on server |
| 22 | Super Admin finance/notifications › payment ledger loads canonical invoice_payment_history data | `E2E_OWNER_EMAIL` not set | **Yes** | No |

### super-admin-support.spec.ts — 8 skips (4 unique)

Skip condition: `describe.skip(!OWNER_EMAIL \|\| !OWNER_PASSWORD)`

| # | Test name | Skip reason | Blocked by SUPABASE_SERVICE_ROLE_KEY? | Can activate without extra creds? |
|---|---|---|---|---|
| 23 | Super Admin support › tickets view loads canonical support_tickets data | `E2E_OWNER_EMAIL` not set | **Yes** | No |
| 24 | Super Admin support › complaints view loads complaints workflow data | `E2E_OWNER_EMAIL` not set | **Yes** | No |
| 25 | Super Admin support › disputes view loads disputes workflow data | `E2E_OWNER_EMAIL` not set | **Yes** | No |
| 26 | Super Admin support › owner can create support ticket via API and retrieve it | `E2E_OWNER_EMAIL` not set | **Yes** | No |

### production-user-lifecycle.spec.ts — 6 skips (3 unique)

Skip condition: `!isProductionTarget` (PLAYWRIGHT_BASE_URL must be production URL) AND `!allowProductionMutation`

| # | Test name | Skip reason | Blocked by SUPABASE_SERVICE_ROLE_KEY? | Can activate without extra creds? |
|---|---|---|---|---|
| 27 | production lifecycle evidence › individual driver reaches only the driver workspace | `PLAYWRIGHT_BASE_URL` not pointing to production + `E2E_ALLOW_PRODUCTION_MUTATION` not true + `E2E_LIFECYCLE_DRIVER_EMAIL` missing | No (browser only) | No — requires dedicated e2e test account credentials AND production URL |
| 28 | production lifecycle evidence › owner-driver reaches the intended operations workspace | Same conditions | No | No |
| 29 | production lifecycle evidence › carrier owner reaches company operations and not super-admin | Same conditions | No | No |

---

## Summary by skip category

| Category | Unique tests | Browser tests × 2 | Blocker |
|---|---|---|---|
| Missing `E2E_ADMIN_EMAIL` | 5 | 10 | Env var only — no service key needed |
| Missing `E2E_DRIVER_EMAIL` | 2 | 4 | Env var only — no service key needed |
| Missing `E2E_BROKER_EMAIL` | 6 | 12 | Env var only — no service key needed |
| Missing `E2E_CUSTOMER_EMAIL` | 7 | 14 | Env var only — no service key needed |
| Missing owner credentials + `SUPABASE_SERVICE_ROLE_KEY` | 6 | 12 | **Requires SUPABASE_SERVICE_ROLE_KEY on server** |
| Production mutation evidence | 3 | 6 | Requires production URL + test accounts + mutation flag |
| **Total** | **29** | **58** | |

### Tests blocked exclusively by `SUPABASE_SERVICE_ROLE_KEY`

The following 6 unique tests (12 with browsers) return 503 from the server even with owner credentials if `SUPABASE_SERVICE_ROLE_KEY` is not configured:

- `super-admin.spec.ts` — 2 tests
- `super-admin-support.spec.ts` — 4 tests

### Tests that can be activated without additional credentials (env vars only)

The following 20 unique tests (40 with browsers) can be activated simply by setting the indicated env vars — no `SUPABASE_SERVICE_ROLE_KEY` required:

- `auth.spec.ts` admin tests (5) — set `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD`
- `auth.spec.ts` driver tests (2) — set `E2E_DRIVER_EMAIL` + `E2E_DRIVER_PASSWORD`
- `broker.spec.ts` (6) — set `E2E_BROKER_EMAIL` + `E2E_BROKER_PASSWORD`
- `customer.spec.ts` (7) — set `E2E_CUSTOMER_EMAIL` + `E2E_CUSTOMER_PASSWORD`

---

## Skip Reduction Plan

1. **Immediate (no service key needed)**: Add `E2E_ADMIN_EMAIL`, `E2E_DRIVER_EMAIL`, `E2E_BROKER_EMAIL`, `E2E_CUSTOMER_EMAIL` as GitHub Actions secrets → activates 40 browser tests.
2. **With service key**: Add `SUPABASE_SERVICE_ROLE_KEY` to CI + `E2E_OWNER_EMAIL`/`E2E_OWNER_PASSWORD` → activates 12 super-admin tests.
3. **Production evidence** (future): Create dedicated `e2e+test@xdrivelogistics.co.uk` accounts for each role, set `E2E_ALLOW_PRODUCTION_MUTATION=true` in production CI workflow → activates 6 lifecycle tests.

Expected final skip count after step 1: **18** (down from 58).
Expected final skip count after step 2: **6** (production evidence only).
Expected final skip count after step 3: **0**.

---

## Functional Coverage Matrix

| Functionality | Implemented | Tested static | Tested E2E (auth) | Tested by role | Tested with real RLS | Result |
|---|---|---|---|---|---|---|
| Invoice auto-generation after POD | ✅ | ✅ contract | ❌ needs creds | ✅ API role check | ❌ needs service key | **Partial** |
| Send Invoice by Email | ✅ | ✅ API schema | ❌ needs creds | ✅ role guard in route | ❌ needs RESEND_API_KEY | **Partial** |
| Void Invoice | ✅ | ✅ API schema | ❌ needs creds | ✅ role guard in route | ❌ needs service key | **Partial** |
| Credit Note | ✅ | ✅ API schema | ❌ needs creds | ✅ role guard in route | ❌ needs service key | **Partial** |
| Withdraw Quote | ✅ | ✅ state machine | ❌ needs creds | ✅ page-level | ❌ no RLS test | **Partial** |
| Revise Quote | ✅ | ✅ state machine | ❌ needs creds | ✅ page-level | ❌ no RLS test | **Partial** |
| Inline status transition (Ops) | ✅ | ✅ state machine | ❌ needs creds | ✅ API role check | ❌ needs service key | **Partial** |
| POD completeness check | ✅ | ✅ unit contract | ❌ needs creds | ✅ API enforces | ❌ needs service key | **Partial** |
| Driver role isolation | ✅ | ✅ capability contract | ❌ needs creds | ✅ capability lib | ❌ no RLS test | **Partial** |
| Finance role permissions | ✅ | ✅ unit contract | ❌ needs creds | ✅ API role check | ❌ needs service key | **Partial** |
| Company membership auth | ✅ | ✅ contract spec | ✅ CI passes | ✅ migration tested | ✅ SQL policy | **Full** |
| Public page access | ✅ | ✅ CI smoke | ✅ CI passes | N/A | N/A | **Full** |
| Auth redirects | ✅ | ✅ public.spec | ✅ CI passes | ✅ middleware | N/A | **Full** |
| Role alias mapping | ✅ | ✅ contract | ✅ CI passes | ✅ lib test | N/A | **Full** |
| Portal isolation | ✅ | ✅ contract | ✅ CI passes | ✅ middleware | N/A | **Full** |

---

## Required Environment Variables

Add the following to `.env.test` or supply via CI secrets:

| Variable | Purpose | Required for |
|---|---|---|
| `E2E_BASE_URL` or `PLAYWRIGHT_BASE_URL` | Target deployment URL | All browser tests |
| `E2E_ADMIN_EMAIL` | Company admin / operator email | Admin portal tests |
| `E2E_ADMIN_PASSWORD` | Admin password | Admin portal tests |
| `E2E_DRIVER_EMAIL` | Driver test account email | Driver portal tests |
| `E2E_DRIVER_PASSWORD` | Driver password | Driver portal tests |
| `E2E_BROKER_EMAIL` | Broker test account email | Broker workspace tests |
| `E2E_BROKER_PASSWORD` | Broker password | Broker workspace tests |
| `E2E_CUSTOMER_EMAIL` | Customer test account email | Customer portal tests |
| `E2E_CUSTOMER_PASSWORD` | Customer password | Customer portal tests |
| `E2E_OWNER_EMAIL` | Platform owner email | Super-admin tests |
| `E2E_OWNER_PASSWORD` | Platform owner password | Super-admin tests |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase admin | Super-admin API tests |
| `PLAYWRIGHT_BASE_URL` | Must be `https://xdrivelogistics.co.uk` | Production lifecycle tests |
| `E2E_ALLOW_PRODUCTION_MUTATION` | Must be `true` | Production lifecycle tests |
| `E2E_LIFECYCLE_DRIVER_EMAIL` | Individual driver test account | Production lifecycle test 1 |
| `E2E_LIFECYCLE_OWNER_DRIVER_EMAIL` | Owner-driver test account | Production lifecycle test 2 |
| `E2E_LIFECYCLE_CARRIER_OWNER_EMAIL` | Carrier owner test account | Production lifecycle test 3 |

---

## Running Locally

```bash
npm install
npx playwright install --with-deps
npm run test:e2e
```

Run only static/contract tests (no credentials needed):

```bash
npx playwright test \
  e2e/ci-public-smoke.spec.ts \
  e2e/public.spec.ts \
  e2e/role-workspace-capability-contract.spec.ts \
  e2e/canonical-company-membership-contract.spec.ts \
  e2e/individual-driver-onboarding-contract.spec.ts \
  e2e/invoice-lifecycle-contract.spec.ts \
  e2e/quote-lifecycle-contract.spec.ts \
  e2e/job-operations-contract.spec.ts \
  e2e/driver-workspace-contract.spec.ts \
  e2e/finance-workspace-contract.spec.ts \
  --project=chromium
```

## Directory Layout

- `e2e/` — Playwright config and all test specs
- `e2e/test-results/` — Screenshots, reports, and traces
- `e2e/README.md` — This file (skip matrix + coverage)

