# XDrive Logistics Platform E2E Playwright Forensic Audit Suite

This automated suite uses [Playwright](https://playwright.dev/) to functionally test and forensically audit core business operations for the XDrive Logistics platform.

## What is tested?

1. **Admin login**
2. **Create company**
3. **Verify company appears**
4. **Create driver**
5. **Verify driver appears**
6. **Driver login**
7. **Create vehicle**
8. **Verify vehicle appears**
9. **Create job**
10. **Assign driver to job**
11. **Login as driver**
12. **Verify driver sees only assigned job**
13. **Verify driver does not see unassigned jobs**
14. **Document upload/POD**
15. **Settings save & reload**

## Evidence Collected Per Test
- PASS/FAIL result
- Full-page screenshot (on each step and all failures)
- Page URL, network/API calls (Playwright traces)
- Console errors (Playwright capture)
- Supabase/API responses
- Exact error/failure details

## Required Environment Variables

Add the following to your `.env.test` or supply via CI secrets:

- `E2E_BASE_URL` — your staging or production deployment root URL (e.g. https://staging.xdrivelogistics.co.uk)
- `E2E_ADMIN_EMAIL` — admin user email
- `E2E_ADMIN_PASSWORD` — admin password
- `E2E_DRIVER_EMAIL` — driver user email (test)
- `E2E_DRIVER_PASSWORD` — driver password (test)

## Minimum Test Data Setup

- The E2E suite will create all required entities (companies, drivers, jobs, vehicles) with the prefix `XDRIVE_E2E_`.
- If necessary, pre-create a blank driver account (see setup script or provide account credentials above).

## Running Locally

Install dependencies:

```
npm install
```

Run the full test suite (headless):

```
npm run test:e2e
```

Run in headed (show browser):

```
npm run test:e2e:headed
```

Generate/play a test report:

```
npm run test:e2e:report
```

All screenshots, traces, and HTML reports are stored in `/e2e/test-results`.

## Running in CI

Most CI systems are supported out-of-the-box (see Playwright docs). Add a CI job step:

```
npm ci
npx playwright install --with-deps
npm run test:e2e
```
- For secrets/env variables: use your CI system's environment secrets feature.

## Cleanup

- The script will delete any test-generated companies, drivers, vehicles, and jobs prefixed with `XDRIVE_E2E_` where safe.
- Any entities not deleted (due to permission errors or foreign key locks) will be listed in the E2E_FORENSIC_AUDIT_REPORT.md.

## Manual Verification Required
- Supabase RLS enforcement (row-by-row or SQL-level proof)
- Actual DB snapshot or logs that directly prove enforcement

## Directory Layout

- `e2e/`
  - Main Playwright config and all test specs
- `e2e/test-results/`
  - Screenshots, reports, and traces
- `E2E_FORENSIC_AUDIT_REPORT.md`
  - Markdown audit template populated after test run

