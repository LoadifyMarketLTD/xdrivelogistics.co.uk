BEGIN;

ALTER TABLE public.company_documents
  DROP CONSTRAINT IF EXISTS company_documents_doc_type_check;

ALTER TABLE public.company_documents
  ADD CONSTRAINT company_documents_doc_type_check
  CHECK (doc_type IN (
    'operator_licence',
    'public_liability',
    'goods_in_transit',
    'vehicle_insurance',
    'motor_fleet_insurance',
    'employers_liability',
    'vat_registration',
    'company_registration'
  ));

INSERT INTO public.compliance_document_requirements
  (account_type, document_family, doc_type, required, active, notes)
VALUES
  ('broker_shipper', 'company', 'company_registration', true, true, 'Required XDrive business identity evidence for the incorporated broker account.'),
  ('broker_shipper', 'company', 'public_liability', false, true, 'Conditional commercial/platform due-diligence cover; not a universal UK statutory requirement.'),
  ('broker_shipper', 'company', 'vat_registration', false, true, 'Conditional: required only when the business is VAT registered.'),
  ('fleet_courier', 'company', 'company_registration', true, true, 'Required XDrive business identity evidence for the incorporated carrier account.'),
  ('fleet_courier', 'company', 'public_liability', false, true, 'Conditional commercial/platform due-diligence cover; not a universal UK statutory requirement.'),
  ('fleet_courier', 'company', 'goods_in_transit', false, true, 'Conditional commercial cargo cover; not a universal UK statutory requirement.'),
  ('fleet_courier', 'company', 'vehicle_insurance', true, true, 'Required motor insurance evidence for vehicles used in the business.'),
  ('fleet_courier', 'company', 'employers_liability', false, true, 'Conditional: required when the business is an employer, subject to statutory exemptions.'),
  ('fleet_courier', 'company', 'operator_licence', false, true, 'Conditional: required where vehicle weights and operations legally require an operator licence.'),
  ('fleet_courier', 'company', 'vat_registration', false, true, 'Conditional: required only when the company is VAT registered.'),
  ('owner_driver', 'identity', 'driving_licence', true, true, 'Required verified entitlement to drive the declared vehicle class.'),
  ('owner_driver', 'identity', 'proof_of_address', false, true, 'Conditional platform identity evidence; not a transport-specific statutory requirement.'),
  ('owner_driver', 'identity', 'right_to_work', true, true, 'Required XDrive work-eligibility evidence before marketplace access.'),
  ('owner_driver', 'identity', 'insurance', false, true, 'Optional personal/driver insurance; vehicle motor insurance is validated separately.'),
  ('owner_driver', 'identity', 'cpc', false, true, 'Conditional: required where Driver CPC applies to the vehicle and work.'),
  ('owner_driver', 'identity', 'visa_document', false, true, 'Conditional: required where the right-to-work route needs this evidence.'),
  ('individual_driver', 'identity', 'driving_licence', true, true, 'Required verified entitlement to drive the assigned vehicle class.'),
  ('individual_driver', 'identity', 'proof_of_address', false, true, 'Conditional platform identity evidence; not a transport-specific statutory requirement.'),
  ('individual_driver', 'identity', 'right_to_work', true, true, 'Required employer-side right-to-work evidence before activation.'),
  ('individual_driver', 'identity', 'cpc', false, true, 'Conditional: required where Driver CPC applies to the vehicle and work.'),
  ('individual_driver', 'identity', 'visa_document', false, true, 'Conditional: required where the right-to-work route needs this evidence.')
ON CONFLICT (account_type, document_family, doc_type)
DO UPDATE SET
  required = EXCLUDED.required,
  active = EXCLUDED.active,
  notes = EXCLUDED.notes,
  updated_at = now();

INSERT INTO public.compliance_document_requirements
  (account_type, document_family, doc_type, required, active, notes)
SELECT 'fleet_operator', document_family, doc_type, required, active,
       'Legacy fleet_operator alias: ' || notes
FROM public.compliance_document_requirements
WHERE account_type = 'fleet_courier'
ON CONFLICT (account_type, document_family, doc_type)
DO UPDATE SET required = EXCLUDED.required, active = EXCLUDED.active,
              notes = EXCLUDED.notes, updated_at = now();

COMMIT;
