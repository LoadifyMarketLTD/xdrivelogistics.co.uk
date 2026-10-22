-- Persist the production hotfix: never add a missing placeholder over an upload.
DO $do$
DECLARE v_oid oid; v_def text; v_old text; v_new text;
BEGIN
 v_oid := to_regprocedure('public.submit_onboarding_application_base_v1_legacy_20260927(uuid)');
 IF v_oid IS NULL THEN RAISE EXCEPTION 'Legacy function missing'; END IF;
 v_def := pg_get_functiondef(v_oid);
 v_old := $old$FOREACH v_doc_type IN ARRAY ARRAY['driving_licence','cpc','proof_of_address','right_to_work','visa_document','insurance'] LOOP
      INSERT INTO public.driver_identity_documents (onboarding_application_id, doc_type, upload_status, verification_status)
      VALUES (v_app.id, v_doc_type, 'missing', 'unverified')
      ON CONFLICT DO NOTHING;
    END LOOP;$old$;
 v_new := $new$FOREACH v_doc_type IN ARRAY ARRAY['driving_licence','cpc','proof_of_address','right_to_work','visa_document','insurance'] LOOP
      INSERT INTO public.driver_identity_documents (onboarding_application_id, doc_type, upload_status, verification_status)
      SELECT v_app.id, v_doc_type, 'missing', 'unverified'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.driver_identity_documents existing
        WHERE existing.onboarding_application_id = v_app.id
          AND existing.doc_type = v_doc_type
      )
      ON CONFLICT DO NOTHING;
    END LOOP;$new$;
 IF position(v_new in v_def)>0 THEN RETURN; END IF;
 IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'Expected source block absent; no changes'; END IF;
 v_def := replace(v_def,v_old,v_new);
 EXECUTE v_def;
END $do$;
