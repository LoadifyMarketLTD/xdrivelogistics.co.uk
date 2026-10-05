# RLS no-policy classification — verified 2026-10-05

Production Supabase security advisor currently reports 47 `rls_enabled_no_policy` findings.

This is not automatically a defect. An RLS-enabled table with no policies is fail-closed for non-bypass roles. The release question is whether `anon` or `authenticated` still have direct table privileges.

## Production verification — 2026-10-05

All 47 no-policy tables were checked directly in Production for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` privileges.

- `anon`: 0 tables with direct privileges.
- `authenticated`: 0 tables with direct privileges.
- Result: all 47 findings are currently fail-closed for browser roles.
- Do not add permissive policies only to silence the Supabase advisor.

The three browser-role exposures documented on 2026-09-27 are closed:
- `backup_20260721221000_auth_users_metadata`
- `company_membership_workspace_access`
- `platform_feature_flags`

The five no-policy tables added to this classification since the 2026-09-27 snapshot are:
- `company_watchlist`
- `job_booking_offers`
- `public_quote_rate_limits`
- `transport_buyer_risk_controls`
- `transport_buyer_risk_events`

## Intentional fail-closed / service-role-only tables

- `_backup_069a_jobs_assigned_driver`
- `account_reconciliation_confirmed_20260721_snapshot`
- `backup_20260721221000_auth_users_metadata`
- `capabilities`
- `company_business_types`
- `company_membership_workspace_access`
- `company_registration_audit`
- `company_registration_claims`
- `company_role_capabilities`
- `company_roles`
- `company_watchlist`
- `compliance_document_requirements`
- `document_fingerprints`
- `driver_availability_presence`
- `driver_collection_passes`
- `driver_diary`
- `driver_mobile_device_sessions`
- `driver_push_devices`
- `files`
- `fraud_review_cases`
- `job_booking_offers`
- `job_stops`
- `job_tracking_eta_snapshots`
- `job_tracking_share_tokens`
- `legacy_fleet_onboarding_resolutions`
- `member_capability_overrides`
- `member_workspace_access`
- `platform_case_events`
- `platform_cases`
- `platform_document_requests`
- `platform_feature_flags`
- `platform_finance_reconciliations`
- `platform_identity_registry`
- `platform_membership_subscriptions`
- `platform_pod_reviews`
- `platform_roles`
- `public_quote_rate_limits`
- `registration_legal_acceptances`
- `roles`
- `stripe_connected_accounts`
- `stripe_job_payments`
- `stripe_webhook_events`
- `telematics_driver_bindings`
- `tracking_provider_usage_monthly`
- `transport_buyer_risk_controls`
- `transport_buyer_risk_events`
- `workspaces`

## Security-definer context

The remaining Supabase advisor warnings for authenticated-executable `SECURITY DEFINER` functions are not equivalent to the no-policy findings above.

Current review shows:
- RLS helper functions such as `is_company_member`, `is_company_admin`, `is_company_operator`, `auth_company_id`, and related wrappers are referenced directly by RLS policies and require authenticated execution for those policies to function.
- Public RPC functions without policy references that were reviewed bind their authority to `auth.uid()`.
- Helper wrappers that do not call `auth.uid()` directly delegate to an auth-bound helper.
- Trigger-only functions identified during the 2026-10-05 audit had browser EXECUTE grants revoked separately.

Do not mass-revoke authenticated EXECUTE from the remaining functions. Any further hardening must be function-by-function with the calling RLS/RPC contract verified first.

## Release verification

For each future release:

1. rerun Supabase Security Advisor;
2. enumerate all `rls_enabled_no_policy` tables;
3. verify `anon` and `authenticated` table privileges directly;
4. keep server-only tables fail-closed unless a documented product workflow explicitly requires browser access;
5. rerun authenticated E2E and tenant-boundary checks after any RLS or function-grant change.
