CREATE TEMP TABLE _xdrive_contract_migration_version_map (
  old_version text PRIMARY KEY,
  new_version text UNIQUE NOT NULL,
  migration_name text NOT NULL
) ON COMMIT DROP;

INSERT INTO _xdrive_contract_migration_version_map (old_version,new_version,migration_name) VALUES
('20260929184936','20260926122255','contractual_commercial_agreement_snapshot'),
('20260929184941','20260926122647','booking_offer_carrier_acceptance'),
('20260929184945','20260926123823','buyer_payment_obligation_acknowledgement'),
('20260929184949','20260926144804','multilingual_legal_acceptance_snapshot'),
('20260929184952','20260926150657','signed_legal_agreement_package'),
('20260929185001','20260926155130','commercial_agreement_amendments'),
('20260929185040','20260926164957','immutable_contractual_job_extras'),
('20260929185055','20260926170659','require_canonical_multi_collection_evidence'),
('20260929185059','20260926181245','transport_buyer_exposure_controls'),
('20260929185117','20260926191551','extend_job_tracking_event_types_for_contract_flows');

DO $$
DECLARE
  v_old integer;
  v_new integer;
  v_updated integer;
BEGIN
  SELECT
    count(*) FILTER (WHERE s.version IS NOT NULL),
    count(*) FILTER (WHERE t.version IS NOT NULL)
  INTO v_old,v_new
  FROM _xdrive_contract_migration_version_map m
  LEFT JOIN supabase_migrations.schema_migrations s
    ON s.version=m.old_version AND s.name=m.migration_name
  LEFT JOIN supabase_migrations.schema_migrations t
    ON t.version=m.new_version;

  IF v_old=10 AND v_new=0 THEN
    UPDATE supabase_migrations.schema_migrations s
    SET version=m.new_version
    FROM _xdrive_contract_migration_version_map m
    WHERE s.version=m.old_version AND s.name=m.migration_name;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated<>10 THEN
      RAISE EXCEPTION 'Expected 10 migration metadata updates, got %',v_updated;
    END IF;
  ELSIF v_old=0 AND v_new=10 THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Contract migration history is neither applied-runtime nor canonical: old %, canonical %',v_old,v_new;
  END IF;
END $$;