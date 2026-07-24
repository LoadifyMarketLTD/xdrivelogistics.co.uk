# Production E2E execution contract

The lifecycle suite must never use a real collaborator account.

## Required environment

```bash
PLAYWRIGHT_BASE_URL=https://xdrivelogistics.co.uk
E2E_ALLOW_PRODUCTION_MUTATION=true
E2E_LIFECYCLE_DRIVER_EMAIL=e2e+driver-<run>@<controlled-domain>
E2E_LIFECYCLE_DRIVER_PASSWORD=<dedicated-password>
E2E_LIFECYCLE_OWNER_DRIVER_EMAIL=e2e+owner-driver-<run>@<controlled-domain>
E2E_LIFECYCLE_OWNER_DRIVER_PASSWORD=<dedicated-password>
E2E_LIFECYCLE_CARRIER_OWNER_EMAIL=e2e+carrier-owner-<run>@<controlled-domain>
E2E_LIFECYCLE_CARRIER_OWNER_PASSWORD=<dedicated-password>
```

The suite rejects account addresses that do not contain an `e2e` marker. Production mutation tests remain skipped unless the explicit mutation flag is present.

## Evidence gate

A scenario is not PASS based only on a page load. The run evidence must include:

1. browser trace and final route;
2. visible navigation assertions;
3. forbidden route assertions;
4. read-only database evidence from `auth.users`, `profiles`, `onboarding_applications`, `companies`, and `company_memberships`;
5. duplicate counts for company and active membership;
6. API/RLS response evidence.

## Current execution blocker

No dedicated production E2E mailbox credentials or production test-account credentials are stored in the repository, and none are available to this GitHub connector session. Therefore the production mutation scenarios are intentionally skipped rather than falsely reported as PASS.

The read-only registration contract tests are executable without credentials and currently expose the missing individual-driver path and missing owner-driver workspace choice.