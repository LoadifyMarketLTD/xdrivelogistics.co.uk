CREATE TEMP TABLE _xdrive_migration_version_map (
  old_version text PRIMARY KEY,
  new_version text UNIQUE NOT NULL,
  migration_name text NOT NULL
) ON COMMIT DROP;

INSERT INTO _xdrive_migration_version_map (old_version, new_version, migration_name) VALUES
('20260813195304','20260813205200','20260813205200_xdrive_public_enquiry_commercial_lifecycle'),
('20260826095042','20260826094600','notification_inbox_bridge_reconciliation'),
('20260826101418','20260826095500','job_tracking_eta_cache'),
('20260826102054','20260826101500','secure_tracking_share_tokens'),
('20260826103412','20260826103000','driver_availability_presence'),
('20260826134804','20260826132000','driver_push_devices'),
('20260826210800','20260826211000','driver_single_quote_per_job'),
('20260826213429','20260826214000','driver_mobile_device_sessions'),
('20260826235024','20260827005000','driver_mobile_session_monotonic_login'),
('20260827000344','20260827011500','driver_return_journey_atomic_replace'),
('20260827054825','20260827052500','preserve_driver_pod_signature_json'),
('20260827061058','20260827061500','restrict_server_trigger_rpc_execution'),
('20260827061200','20260827063000','close_legacy_security_definer_rpc_gaps'),
('20260827061510','20260827064500','scope_company_security_definer_helpers'),
('20260827061623','20260827070000','lock_custom_function_search_paths'),
('20260827061704','20260827071500','add_driver_hot_path_fk_indexes'),
('20260827061820','20260827073000','retire_legacy_profile_company_provisioning_rpcs'),
('20260827061930','20260827074500','bind_driver_invites_to_authenticated_identity'),
('20260827062217','20260827080000','scope_membership_role_helper_to_caller'),
('20260827062350','20260827081500','hide_internal_security_definer_helpers'),
('20260830174135','20260830174500','vehicle_driver_company_integrity'),
('20260830174346','20260830174600','verify_vehicle_driver_company_integrity_runtime'),
('20260830180611','20260830175400','restore_canonical_onboarding_invited_status'),
('20260830181014','20260830175500','reconcile_canonical_driver_identity_gate'),
('20260830181143','20260830175600','verify_canonical_driver_identity_runtime'),
('20260830181921','20260830182000','company_membership_governance_integrity'),
('20260830182017','20260830182100','verify_company_membership_governance_runtime'),
('20260830182637','20260830182500','company_governance_compliance_gate'),
('20260830182707','20260830182600','verify_company_governance_compliance_gate_runtime'),
('20260830183707','20260830183500','retire_legacy_accept_bid_rpcs'),
('20260830185210','20260830184500','repair_storage_object_path_rls'),
('20260830185452','20260830184530','repair_onboarding_storage_reviewer_rls'),
('20260830185606','20260830184540','repair_invoice_storage_member_rls_dependency'),
('20260830185623','20260830184600','verify_storage_object_path_rls_runtime'),
('20260830190907','20260830190500','enforce_onboarding_submit_ownership'),
('20260830191719','20260830192000','reconcile_job_award_lifecycle_integrity'),
('20260830191820','20260830192100','verify_job_award_lifecycle_runtime'),
('20260830191833','20260830191800','harden_onboarding_submit_authority'),
('20260830191937','20260830191900','verify_onboarding_submit_authority_runtime'),
('20260830194846','20260830194000','reconcile_finance_vat_snapshot_integrity'),
('20260830195029','20260830194100','harden_finance_vat_trigger_coverage'),
('20260830195129','20260830194200','verify_finance_vat_snapshot_runtime'),
('20260830201510','20260830201500','reconcile_company_compliance_contract'),
('20260830201847','20260830201600','verify_company_compliance_contract_runtime'),
('20260830202400','20260830202500','harden_company_compliance_identity_gate'),
('20260830202431','20260830202600','verify_company_compliance_identity_gate_runtime'),
('20260830203522','20260830204000','reconcile_legacy_fleet_onboarding_bindings'),
('20260830203539','20260830204100','verify_legacy_fleet_onboarding_convergence'),
('20260830210643','20260830211000','resolve_remaining_legacy_fleet_company_shells'),
('20260830210707','20260830211030','harden_verified_company_registration_after_legacy_fleet_quarantine'),
('20260830210845','20260830211100','verify_remaining_legacy_fleet_resolution'),
('20260830212335','20260830212500','harden_onboarding_review_company_binding'),
('20260830212347','20260830212600','verify_onboarding_review_company_binding');

DO $$
DECLARE
  v_old integer;
  v_new integer;
  v_updated integer;
BEGIN
  SELECT
    count(*) FILTER (WHERE s.version IS NOT NULL),
    count(*) FILTER (WHERE t.version IS NOT NULL)
  INTO v_old, v_new
  FROM _xdrive_migration_version_map m
  LEFT JOIN supabase_migrations.schema_migrations s
    ON s.version = m.old_version AND s.name = m.migration_name
  LEFT JOIN supabase_migrations.schema_migrations t
    ON t.version = m.new_version;

  IF v_old = 53 AND v_new = 0 THEN
    UPDATE supabase_migrations.schema_migrations s
    SET version = m.new_version
    FROM _xdrive_migration_version_map m
    WHERE s.version = m.old_version
      AND s.name = m.migration_name;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 53 THEN
      RAISE EXCEPTION 'Expected 53 migration metadata updates, got %', v_updated;
    END IF;

    UPDATE supabase_migrations.schema_migrations
    SET name = 'xdrive_public_enquiry_commercial_lifecycle'
    WHERE version = '20260813205200'
      AND name = '20260813205200_xdrive_public_enquiry_commercial_lifecycle';
  ELSIF v_old = 0 AND v_new = 53 THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Migration history is neither hosted nor canonical: old %, canonical %', v_old, v_new;
  END IF;
END $$;
