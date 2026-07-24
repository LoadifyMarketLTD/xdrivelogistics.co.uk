# Production E2E execution contract

The lifecycle suite must never use a real collaborator account. It may use either a newly-created `e2e`-marked account or an existing internal/test account that the project owner has explicitly approved for testing.

## Required environment

```bash
PLAYWRIGHT_BASE_URL=https://xdrivelogistics.co.uk
E2E_ALLOW_PRODUCTION_MUTATION=true
E2E_APPROVED_TEST_EMAILS=<comma-separated owner-approved internal/test addresses>
E2E_LIFECYCLE_DRIVER_EMAIL=<approved-test-address>
E2E_LIFECYCLE_DRIVER_PASSWORD=<test-password>
E2E_LIFECYCLE_OWNER_DRIVER_EMAIL=<approved-test-address>
E2E_LIFECYCLE_OWNER_DRIVER_PASSWORD=<test-password>
E2E_LIFECYCLE_CARRIER_OWNER_EMAIL=<approved-test-address>
E2E_LIFECYCLE_CARRIER_OWNER_PASSWORD=<test-password>
```

An account is accepted only when its address contains an `e2e` marker or exactly matches an address in `E2E_APPROVED_TEST_EMAILS`. Production mutation tests remain skipped unless the explicit mutation flag is present. Passwords and mailbox credentials must be supplied through protected environment secrets and must never be committed.

## Owner-approved internal/test accounts

The project owner has explicitly authorized the following internal, personal, legacy or test accounts for this E2E block:

- `angelicatoda@gmail.com`
- `dannycourierltd@gmail.com`
- `dannyelbill@gmail.com`
- `dannyelbill447@gmail.com`
- `fleserdumitru@gmail.com`
- `loadifymarket.co.uk@gmail.com`

These accounts remain excluded from collaborator and business-user statistics. Authorization to test them does not authorize changing unrelated business data. Before any destructive negative-path fixture, capture read-only evidence and restore the intended final state.

## Evidence gate

A scenario is not PASS based only on a page load. The run evidence must include:

1. browser trace and final route;
2. visible navigation assertions;
3. forbidden route assertions;
4. read-only database evidence from `auth.users`, `profiles`, `onboarding_applications`, `companies`, and `company_memberships`;
5. duplicate counts for company and active membership;
6. API/RLS response evidence.

## Current execution blocker

Approved account addresses are now available. Login and mailbox credentials are not stored in the repository or exposed to the GitHub connector session, so authenticated production scenarios remain skipped until protected test secrets are available. They must not be reported as PASS before execution.

The read-only registration contract tests remain executable without credentials and currently expose the missing individual-driver path and missing owner-driver workspace choice.
