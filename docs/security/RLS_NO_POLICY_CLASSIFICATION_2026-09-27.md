# RLS no-policy classification — 2026-09-27

Production Supabase security advisor reports 42 `rls_enabled_no_policy` findings.

This is not automatically a defect. An RLS-enabled table with no policies is fail-closed for non-bypass roles. The relevant question is whether `anon` or `authenticated` still have direct table privileges.

## Direct browser-role exposure found

Exactly three of the 42 tables currently have direct `anon` and/or `authenticated` privileges in Production:

1. `backup_20260721221000_auth_users_metadata`
   - anon: full table privileges
   - authenticated: full table privileges
2. `company_membership_workspace_access`
   - anon: full table privileges
   - authenticated: full table privileges
3. `platform_feature_flags`
   - anon: SELECT
   - authenticated: SELECT

PR #626 migration `20260927122500_harden_fail_closed_internal_tables.sql` revokes those browser-role privileges and preserves controlled `service_role` access.

## Intentional fail-closed / service-role-only findings

The remaining 39 tables have no direct `anon` or `authenticated` grants in Production. Their current no-policy state is therefore intentionally fail-closed for browser roles and does not require adding permissive RLS policies merely to silence the advisor.

- `_backup_069a_jobs_assigned_driver`
- `account_reconciliation_confirmed_20260721_snapshot`
- `capabilities`
- `company_business_types`
- `company_registration_audit`
- `company_registration_claims`
- `company_role_capabilities`
- `company_roles`
- `compliance_document_requirements`
- `document_fingerprints`
- `driver_availability_presence`
- `driver_collection_passes`
- `driver_diary`
- `driver_mobile_device_sessions`
- `driver_push_devices`
- `files`
- `fraud_review_cases`
- `job_stops`
- `job_tracking_eta_snapshots`
- `job_tracking_share_tokens`
- `legacy_fleet_onboarding_resolutions`
- `member_capability_overrides`
- `member_workspace_access`
- `platform_case_events`
- `platform_cases`
- `platform_document_requests`
- `platform_finance_reconciliations`
- `platform_identity_registry`
- `platform_membership_subscriptions`
- `platform_pod_reviews`
- `platform_roles`
- `registration_legal_acceptances`
- `roles`
- `stripe_connected_accounts`
- `stripe_job_payments`
- `stripe_webhook_events`
- `telematics_driver_bindings`
- `tracking_provider_usage_monthly`
- `workspaces`

## Release verification

After applying the PR migrations in a controlled Production step:

1. rerun Supabase Security Advisor;
2. confirm the three direct browser-role grant findings no longer expose `anon`/`authenticated`;
3. do not add broad RLS policies to the 39 intentional fail-closed tables unless a documented product workflow requires browser access;
4. rerun authenticated E2E and tenant-boundary checks.
