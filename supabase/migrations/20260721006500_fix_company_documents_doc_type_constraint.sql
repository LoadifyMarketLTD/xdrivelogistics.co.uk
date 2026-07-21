-- Align the company_documents check constraint with the canonical fleet
-- onboarding document set. Migration 099 created the table before
-- motor_fleet_insurance was introduced; later CREATE TABLE IF NOT EXISTS
-- migrations could not replace the existing constraint.

BEGIN;

ALTER TABLE public.company_documents
  DROP CONSTRAINT IF EXISTS company_documents_doc_type_check;

ALTER TABLE public.company_documents
  ADD CONSTRAINT company_documents_doc_type_check
  CHECK (
    doc_type IN (
      'operator_licence',
      'public_liability',
      'goods_in_transit',
      'vehicle_insurance',
      'motor_fleet_insurance',
      'vat_registration',
      'company_registration'
    )
  );

COMMIT;
