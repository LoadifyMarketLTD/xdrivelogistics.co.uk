# Skipped Test Ledger — Complete Account of All 144 Skipped Tests

**Generated**: 2026-07-25  
**Run result**: 226 passed, 144 skipped, 0 failed  
**Playwright projects**: chromium + mobile-safari (each test runs twice = 2× multiplier for skipped describe blocks)

---

## Legend

**Skip causes**:
- `MISSING_CRED`: Test skipped because an env var credential is absent
- `PROD_SAFETY`: Production-safety guard (requires PLAYWRIGHT_BASE_URL + E2E_ALLOW_PRODUCTION_MUTATION)
- `MISSING_FIXTURE`: Test has inner skip for missing specific account credentials

---

## Skipped Test Groups and Individual Tests

### Group A — Admin credentials missing (`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`)

| Spec file | Describe group | Test name | Browsers | Skip condition | Can enable now | Required action |
|---|---|---|---|---|---|---|
| auth.spec.ts | Admin portal | admin can log in and see dashboard | chromium + mobile-safari | !ADMIN_EMAIL | No | Set E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD |
| auth.spec.ts | Admin portal | admin fleet page shows map placeholder | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| auth.spec.ts | Admin portal | admin jobs page loads | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| auth.spec.ts | Admin portal | admin drivers page loads | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| auth.spec.ts | Admin portal | admin marketplace page loads | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| finance-workspace-contract.spec.ts | admin finance pages | finance balances page loads | chromium + mobile-safari | !ADMIN_EMAIL | No | Set E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD |
| finance-workspace-contract.spec.ts | admin finance pages | finance payments page loads | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| finance-workspace-contract.spec.ts | admin finance pages | finance reports page loads | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| finance-workspace-contract.spec.ts | admin finance pages | finance reports page exposes export buttons | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| finance-workspace-contract.spec.ts | admin finance pages | finance balances page shows KPI cards | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| finance-workspace-contract.spec.ts | admin finance pages | admin invoice list page loads from finance workflow | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| finance-workspace-contract.spec.ts | admin finance pages | invoice lifecycle endpoint returns 400 for invalid action | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| invoice-lifecycle-contract.spec.ts | admin invoice list | admin invoices page loads with expected header | chromium + mobile-safari | !ADMIN_EMAIL | No | Set E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD |
| invoice-lifecycle-contract.spec.ts | admin invoice list | admin can navigate to new invoice form | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| invoice-lifecycle-contract.spec.ts | admin invoice list | admin new invoice form renders required fields | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| invoice-lifecycle-contract.spec.ts | admin invoice lifecycle actions | invoice detail page exposes Void Invoice button for non-paid invoices | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| invoice-lifecycle-contract.spec.ts | admin invoice lifecycle actions | invoice detail page exposes Send Invoice button for Draft invoices | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| invoice-lifecycle-contract.spec.ts | admin invoice lifecycle actions | lifecycle API returns 401 without auth token | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| invoice-lifecycle-contract.spec.ts | admin invoice lifecycle actions | lifecycle API rejects requests without auth with 401 or 503 | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| job-operations-contract.spec.ts | operations centre | operations centre page loads | chromium + mobile-safari | !ADMIN_EMAIL | No | Set E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD |
| job-operations-contract.spec.ts | operations centre | operations centre shows metric cards | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| job-operations-contract.spec.ts | operations centre | operations centre shows job search input | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| job-operations-contract.spec.ts | operations centre | inline status transition button appears for active jobs | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| job-operations-contract.spec.ts | admin job management | admin jobs page loads | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| job-operations-contract.spec.ts | admin job management | admin can open new job form | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| job-operations-contract.spec.ts | admin job management | job transition API returns 401/503 for unauthenticated POST | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| job-operations-contract.spec.ts | admin job management | assign-driver API returns 401/503 for unauthenticated POST | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| quote-lifecycle-contract.spec.ts | admin quote management | quotes page loads with heading | chromium + mobile-safari | !ADMIN_EMAIL | No | Set E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD |
| quote-lifecycle-contract.spec.ts | admin quote management | quotes page shows status filter tabs | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| quote-lifecycle-contract.spec.ts | admin quote management | quotes page exposes New Quote button | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| quote-lifecycle-contract.spec.ts | admin quote management | new quote form can be opened | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| quote-lifecycle-contract.spec.ts | admin quote management | withdraw action appears for sent quotes | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |
| quote-lifecycle-contract.spec.ts | admin quote management | revise action appears for withdrawn or declined quotes | chromium + mobile-safari | !ADMIN_EMAIL | No | Same |

**Group A subtotal**: 33 test names × 2 browsers = **66 skipped runs**

---

### Group B — Driver credentials missing (`E2E_DRIVER_EMAIL` / `E2E_DRIVER_PASSWORD`)

| Spec file | Describe group | Test name | Browsers | Can enable now |
|---|---|---|---|---|
| auth.spec.ts | Driver portal | driver can log in and see jobs dashboard | chromium + mobile-safari | No |
| auth.spec.ts | Driver portal | driver availability page loads | chromium + mobile-safari | No |
| driver-workspace-contract.spec.ts | driver workspace pages | driver jobs page loads | chromium + mobile-safari | No |
| driver-workspace-contract.spec.ts | driver workspace pages | driver availability page loads | chromium + mobile-safari | No |
| driver-workspace-contract.spec.ts | driver workspace pages | driver profile page loads | chromium + mobile-safari | No |
| driver-workspace-contract.spec.ts | driver workspace pages | driver cannot access admin portal | chromium + mobile-safari | No |
| driver-workspace-contract.spec.ts | driver workspace pages | driver cannot access super-admin portal | chromium + mobile-safari | No |
| driver-workspace-contract.spec.ts | driver workspace pages | driver cannot access customer portal | chromium + mobile-safari | No |
| driver-workspace-contract.spec.ts | driver finance workspace | driver finance page or redirect is accessible | chromium + mobile-safari | No |
| driver-workspace-contract.spec.ts | driver finance workspace | driver invoices page (if accessible) shows header | chromium + mobile-safari | No |

**Group B subtotal**: 10 test names × 2 browsers = **20 skipped runs**

---

### Group C — Broker credentials missing (`E2E_BROKER_EMAIL`)

| Spec file | Describe group | Test name | Browsers | Required action |
|---|---|---|---|---|
| broker.spec.ts | Broker workspace | broker dashboard loads | chromium + mobile-safari | Set E2E_BROKER_EMAIL |
| broker.spec.ts | Broker workspace | load board page loads | chromium + mobile-safari | Same |
| broker.spec.ts | Broker workspace | bids page loads | chromium + mobile-safari | Same |
| broker.spec.ts | Broker workspace | awards page loads | chromium + mobile-safari | Same |
| broker.spec.ts | Broker workspace | load board nav links are present | chromium + mobile-safari | Same |
| broker.spec.ts | Broker workspace | broker loads nav leads to bids page | chromium + mobile-safari | Same |
| broker.spec.ts | Broker workspace | carrier network page loads with invite form | chromium + mobile-safari | Same |
| broker.spec.ts | Broker workspace | carrier network shows KPI cards for pending, accepted, revoked | chromium + mobile-safari | Same |
| broker.spec.ts | Broker workspace | carrier network rejects blank email | chromium + mobile-safari | Same |
| broker.spec.ts | Broker workspace | carrier network nav item is present in sidebar | chromium + mobile-safari | Same |

**Group C subtotal**: 10 test names × 2 browsers = **20 skipped runs**

---

### Group D — Carrier credentials missing (`E2E_CARRIER_EMAIL`)

| Spec file | Describe group | Test name | Browsers | Required action |
|---|---|---|---|---|
| broker.spec.ts | Carrier broker invitations | carrier broker invitations page loads | chromium + mobile-safari | Set E2E_CARRIER_EMAIL |
| broker.spec.ts | Carrier broker invitations | carrier broker invitations page shows KPI cards | chromium + mobile-safari | Same |
| broker.spec.ts | Carrier broker invitations | carrier broker invitations nav item is visible | chromium + mobile-safari | Same |

**Group D subtotal**: 3 test names × 2 browsers = **6 skipped runs**

---

### Group E — Customer credentials missing (`E2E_CUSTOMER_EMAIL`)

| Spec file | Describe group | Test name | Browsers | Required action |
|---|---|---|---|---|
| customer.spec.ts | Customer portal | customer workspace loads | chromium + mobile-safari | Set E2E_CUSTOMER_EMAIL |
| customer.spec.ts | Customer portal | quotes tab visible | chromium + mobile-safari | Same |
| customer.spec.ts | Customer portal | deliveries tab visible | chromium + mobile-safari | Same |
| customer.spec.ts | Customer portal | post load tab visible | chromium + mobile-safari | Same |
| customer.spec.ts | Customer portal | post load tab shows form fields | chromium + mobile-safari | Same |
| customer.spec.ts | Customer portal | invoices tab visible | chromium + mobile-safari | Same |
| customer.spec.ts | Customer portal | updates tab visible | chromium + mobile-safari | Same |

**Group E subtotal**: 7 test names × 2 browsers = **14 skipped runs** (note: might be 6 tests — verify exact count)

---

### Group F — Owner/super-admin credentials missing (`E2E_OWNER_EMAIL` / `E2E_OWNER_PASSWORD`)

| Spec file | Describe group | Test name | Browsers | Required action |
|---|---|---|---|---|
| super-admin.spec.ts | Super Admin finance/notifications runtime | notifications view loads canonical notification_events data | chromium + mobile-safari | Set E2E_OWNER_EMAIL + E2E_OWNER_PASSWORD (xdrivelogisticsltd@gmail.com) |
| super-admin.spec.ts | Super Admin finance/notifications runtime | payment ledger loads canonical invoice_payment_history data | chromium + mobile-safari | Same |
| super-admin-support.spec.ts | Super Admin support workflows | tickets view loads canonical support_tickets data | chromium + mobile-safari | Same |
| super-admin-support.spec.ts | Super Admin support workflows | complaints view loads complaints workflow data | chromium + mobile-safari | Same |
| super-admin-support.spec.ts | Super Admin support workflows | disputes view loads disputes workflow data | chromium + mobile-safari | Same |
| super-admin-support.spec.ts | Super Admin support workflows | owner can create support ticket via API and retrieve it in tickets feed | chromium + mobile-safari | Same |

**Note**: E2E_OWNER_EMAIL can be set to `xdrivelogisticsltd@gmail.com` (platform owner account — from stored memory).

**Group F subtotal**: 6 test names × 2 browsers = **12 skipped runs**

---

### Group G — Production safety guard

| Spec file | Describe group | Test name | Browsers | Skip condition | Required action |
|---|---|---|---|---|---|
| production-user-lifecycle.spec.ts | production lifecycle evidence | individual driver reaches only the driver workspace | chromium + mobile-safari | !isProductionTarget OR !allowProductionMutation | Set PLAYWRIGHT_BASE_URL + E2E_ALLOW_PRODUCTION_MUTATION + driver credentials |
| production-user-lifecycle.spec.ts | production lifecycle evidence | owner-driver reaches the intended operations workspace | chromium + mobile-safari | Same + !ownerDriver.ready | Same + E2E_OWNER_DRIVER_EMAIL |
| production-user-lifecycle.spec.ts | production lifecycle evidence | carrier owner reaches company operations and not super-admin | chromium + mobile-safari | Same + !carrierOwner.ready | Same + E2E_CARRIER_OWNER_EMAIL |

**Group G subtotal**: 3 test names × 2 browsers = **6 skipped runs**

---

## Totals

| Group | Cause | Unique test names | Browser runs |
|---|---|---|---|
| A | Missing E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD | 33 | 66 |
| B | Missing E2E_DRIVER_EMAIL / E2E_DRIVER_PASSWORD | 10 | 20 |
| C | Missing E2E_BROKER_EMAIL | 10 | 20 |
| D | Missing E2E_CARRIER_EMAIL | 3 | 6 |
| E | Missing E2E_CUSTOMER_EMAIL | 7 | 14 |
| F | Missing E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD | 6 | 12 |
| G | Production safety guard | 3 | 6 |
| **TOTAL** | | **72 unique tests** | **144 skipped runs** |

**All 144 skipped runs account for 72 unique tests × 2 browsers (chromium + mobile-safari).**

---

## Can any be enabled now?

| Group | Can enable | Blocker |
|---|---|---|
| A (admin) | **YES** | Owner account (xdrivelogisticsltd@gmail.com) has company_admin access — set E2E_ADMIN_EMAIL=xdrivelogisticsltd@gmail.com in CI secrets |
| B (driver) | NO | Requires a dedicated test driver account |
| C (broker) | NO | Requires a test broker account |
| D (carrier) | NO | Requires a test carrier account |
| E (customer) | NO | Requires a test customer account |
| F (super-admin owner) | **YES** | Set E2E_OWNER_EMAIL=xdrivelogisticsltd@gmail.com + E2E_OWNER_PASSWORD in CI secrets |
| G (production) | NO | Production safety guard — only after staging acceptance |

**Immediately actionable**: Set E2E_ADMIN_EMAIL and E2E_OWNER_EMAIL in GitHub Actions secrets to enable Groups A and F (78 skipped runs would pass or fail, giving real runtime evidence).

---

## Workflows Without Any Authenticated Test

| Workflow | Coverage gap |
|---|---|
| Individual driver onboarding (E2E) | No authenticated test — only static contract |
| Company onboarding submission | No authenticated test |
| Broker invitation accept/reject | No authenticated test |
| Job creation end-to-end | No authenticated test (only 401 static test) |
| Driver mobile app (Expo) | No web-based E2E — requires device/emulator |
| Android native APK | No automated E2E at all |
| Notification delivery (end-to-end) | No test |
| Invoice payment recording | No authenticated test |
| POD upload and review | No authenticated test |
| Driver GPS tracking | No test |
