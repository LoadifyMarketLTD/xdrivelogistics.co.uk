-- Keep one current evidence record per applicant/type. Previous evidence and
-- fingerprints remain auditable; no uploaded storage object is overwritten.
CREATE TABLE IF NOT EXISTS public.onboarding_document_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_application_id uuid NOT NULL REFERENCES public.onboarding_applications(id),
  document_family text NOT NULL CHECK (document_family IN ('identity', 'company')),
  document_id uuid NOT NULL,
  doc_type text NOT NULL,
  snapshot jsonb NOT NULL,
  replaced_by_document_id uuid NOT NULL,
  replaced_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  replaced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_family, document_id)
);
ALTER TABLE public.onboarding_document_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.onboarding_document_revisions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.onboarding_document_revisions TO service_role;
CREATE INDEX IF NOT EXISTS onboarding_document_revisions_application_idx
  ON public.onboarding_document_revisions(onboarding_application_id, replaced_at DESC);

CREATE OR REPLACE FUNCTION public.store_onboarding_document_revision(
  p_application_id uuid, p_actor_user_id uuid, p_document_family text,
  p_doc_type text, p_file_path text, p_file_sha256 text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
DECLARE
  v_app public.onboarding_applications%ROWTYPE;
  v_id uuid := gen_random_uuid();
  v_replaced integer := 0;
  v_fingerprint public.document_fingerprints%ROWTYPE;
  v_submitted boolean;
BEGIN
  IF p_application_id IS NULL OR p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Application and authenticated actor are required.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_app FROM public.onboarding_applications
    WHERE id=p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found.' USING ERRCODE='P0002'; END IF;
  IF v_app.user_id IS DISTINCT FROM p_actor_user_id THEN
    RAISE EXCEPTION 'Only the applicant can replace their documents.' USING ERRCODE='42501';
  END IF;
  IF v_app.risk_status='confirmed_fraud' OR v_app.status='rejected'
     OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id=p_actor_user_id
                AND lower(status::text) IN ('suspended','banned','disabled','rejected')) THEN
    RAISE EXCEPTION 'This account requires Platform Compliance review before uploading.' USING ERRCODE='42501';
  END IF;
  IF p_document_family='identity' THEN
    IF v_app.account_type NOT IN ('owner_driver','individual_driver')
       OR p_doc_type IS NULL OR p_doc_type NOT IN
         ('driving_licence','cpc','proof_of_address','right_to_work','visa_document','insurance') THEN
      RAISE EXCEPTION 'Invalid identity document type.' USING ERRCODE='23514';
    END IF;
  ELSIF p_document_family='company' THEN
    IF v_app.account_type NOT IN ('fleet_courier','broker_shipper')
       OR p_doc_type IS NULL OR p_doc_type NOT IN
         ('operator_licence','public_liability','goods_in_transit','vehicle_insurance',
          'motor_fleet_insurance','employers_liability','vat_registration','company_registration')
       OR v_app.company_id IS NULL THEN
      RAISE EXCEPTION 'A bound company and supported document type are required.' USING ERRCODE='23514';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.company_memberships m JOIN public.companies c ON c.id=m.company_id
      WHERE m.company_id=v_app.company_id AND m.user_id=p_actor_user_id
        AND (m.status='active' OR (m.status='invited' AND c.created_by=p_actor_user_id
             AND c.status::text='pending_approval' AND m.role_in_company IN ('owner','admin')))
    ) THEN
      RAISE EXCEPTION 'Company membership does not permit this upload.' USING ERRCODE='42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported document family.' USING ERRCODE='23514';
  END IF;
  IF p_file_path IS NULL OR p_file_sha256 IS NULL OR p_file_sha256 !~ '^[0-9a-f]{64}$'
     OR p_file_path NOT LIKE p_actor_user_id::text || '/' || p_application_id::text || '/%'
     OR position('..' IN p_file_path)>0 OR NOT EXISTS (
       SELECT 1 FROM storage.objects WHERE bucket_id='onboarding-documents' AND name=p_file_path
     ) THEN
    RAISE EXCEPTION 'A stored file in the applicant own folder is required.' USING ERRCODE='23514';
  END IF;
  -- Serialize identical-file registrations across applications. The HTTP route
  -- records fraud holds; this second check prevents a concurrent bypass.
  PERFORM pg_advisory_xact_lock(hashtextextended('onboarding-file:' || p_file_sha256, 0));
  SELECT * INTO v_fingerprint FROM public.document_fingerprints WHERE file_sha256=p_file_sha256;
  IF FOUND THEN
    IF v_fingerprint.onboarding_application_id=p_application_id THEN
      RAISE EXCEPTION 'This exact document was already uploaded. Select the corrected file.' USING ERRCODE='23505';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.fraud_review_cases
       WHERE onboarding_application_id=p_application_id AND case_type='duplicate_file'
         AND evidence->>'file_sha256'=p_file_sha256 AND status IN ('cleared','dismissed')) THEN
      RAISE EXCEPTION 'Duplicate document requires Platform Compliance review.' USING ERRCODE='23505';
    END IF;
  END IF;

  IF p_document_family='identity' THEN
    PERFORM 1 FROM public.driver_identity_documents
      WHERE onboarding_application_id=p_application_id AND doc_type=p_doc_type FOR UPDATE;
    INSERT INTO public.driver_identity_documents
      (id,onboarding_application_id,doc_type,file_path,file_sha256,upload_status,verification_status)
    VALUES (v_id,p_application_id,p_doc_type,p_file_path,p_file_sha256,'uploaded','unverified');
    INSERT INTO public.onboarding_document_revisions
      (onboarding_application_id,document_family,document_id,doc_type,snapshot,replaced_by_document_id,replaced_by_user_id)
    SELECT p_application_id,'identity',d.id,p_doc_type,to_jsonb(d),v_id,p_actor_user_id
      FROM public.driver_identity_documents d
      WHERE d.onboarding_application_id=p_application_id AND d.doc_type=p_doc_type AND d.id<>v_id;
    GET DIAGNOSTICS v_replaced = ROW_COUNT;
    DELETE FROM public.driver_identity_documents
      WHERE onboarding_application_id=p_application_id AND doc_type=p_doc_type AND id<>v_id;
  ELSE
    PERFORM 1 FROM public.company_documents
      WHERE onboarding_application_id=p_application_id AND doc_type=p_doc_type FOR UPDATE;
    INSERT INTO public.company_documents
      (id,company_id,onboarding_application_id,doc_type,file_path,file_sha256,status)
    VALUES (v_id,v_app.company_id,p_application_id,p_doc_type,p_file_path,p_file_sha256,'pending');
    INSERT INTO public.onboarding_document_revisions
      (onboarding_application_id,document_family,document_id,doc_type,snapshot,replaced_by_document_id,replaced_by_user_id)
    SELECT p_application_id,'company',d.id,p_doc_type,to_jsonb(d),v_id,p_actor_user_id
      FROM public.company_documents d
      WHERE d.onboarding_application_id=p_application_id AND d.doc_type=p_doc_type AND d.id<>v_id;
    GET DIAGNOSTICS v_replaced = ROW_COUNT;
    DELETE FROM public.company_documents
      WHERE onboarding_application_id=p_application_id AND doc_type=p_doc_type AND id<>v_id;
  END IF;
  -- Preserve the original fingerprint for explicitly cleared reuse. Otherwise
  -- register the new immutable evidence identity in this same transaction.
  IF v_fingerprint.id IS NULL THEN
    INSERT INTO public.document_fingerprints
      (document_family,document_id,onboarding_application_id,user_id,company_id,file_sha256)
    VALUES (p_document_family,v_id,p_application_id,p_actor_user_id,v_app.company_id,p_file_sha256);
  END IF;
  v_submitted := v_app.submitted_at IS NOT NULL OR v_app.status IN
    ('submitted','under_review','compliance_review','admin_approval','approved');
  UPDATE public.onboarding_applications
    SET payload=COALESCE(payload,'{}'::jsonb) || jsonb_build_object('doc_' || p_doc_type,p_file_path),
        status=CASE WHEN v_submitted THEN 'under_review' ELSE 'in_progress' END,
        current_step=CASE WHEN v_submitted THEN 'pending_review' ELSE 'document_upload' END,
        completion_percentage=CASE WHEN v_submitted THEN 100 ELSE completion_percentage END,
        updated_at=now(), last_activity_at=now()
    WHERE id=p_application_id RETURNING * INTO v_app;
  RETURN jsonb_build_object('documentId',v_id,'replaced',v_replaced>0,
    'path',p_file_path,'docType',p_doc_type,'accountType',v_app.account_type,
    'riskStatus',v_app.risk_status,'payload',v_app.payload,'application',to_jsonb(v_app));
END;
$function$;
REVOKE ALL ON FUNCTION public.store_onboarding_document_revision(uuid,uuid,text,text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_onboarding_document_revision(uuid,uuid,text,text,text,text) TO service_role;
COMMENT ON TABLE public.onboarding_document_revisions IS
  'Private evidence history. Current records are replaced atomically; original files and fingerprints are retained, never automatically verified.';
NOTIFY pgrst, 'reload schema';
