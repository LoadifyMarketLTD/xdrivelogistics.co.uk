-- Real-database PreLive VAT regression. Disposable/local/staging only.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(4);

INSERT INTO public.companies (id, name, status, vat_number)
VALUES
 ('24000000-0000-0000-0000-000000000001','PreLive VAT Supplier','active','GB111111111'),
 ('24000000-0000-0000-0000-000000000002','PreLive VAT Buyer','active','GB222222222'),
 ('24000000-0000-0000-0000-000000000003','PreLive Non VAT Supplier','active',NULL);

CREATE TEMP TABLE prelive_invoice_vat_probe (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  buyer_company_id uuid,
  net_amount numeric(12,2) NOT NULL,
  vat_treatment text,
  vat_rate smallint,
  vat_amount numeric(12,2),
  amount numeric(12,2),
  issuer_vat_number_snapshot text,
  customer_vat_number_snapshot text
) ON COMMIT DROP;

CREATE TRIGGER trg_prelive_invoice_vat_probe
BEFORE INSERT OR UPDATE ON prelive_invoice_vat_probe
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_xdrive_invoice_vat_contract();

INSERT INTO prelive_invoice_vat_probe
  (id,company_id,buyer_company_id,net_amount,vat_treatment,vat_rate)
VALUES
  ('24000000-0000-0000-0000-000000000011','24000000-0000-0000-0000-000000000001','24000000-0000-0000-0000-000000000002',100,'standard',20),
  ('24000000-0000-0000-0000-000000000012','24000000-0000-0000-0000-000000000001','24000000-0000-0000-0000-000000000002',100,'reverse_charge',20),
  ('24000000-0000-0000-0000-000000000013','24000000-0000-0000-0000-000000000001','24000000-0000-0000-0000-000000000002',100,'zero_rated',0),
  ('24000000-0000-0000-0000-000000000014','24000000-0000-0000-0000-000000000003',NULL,100,'not_registered',0);

SELECT ok(
  EXISTS (SELECT 1 FROM prelive_invoice_vat_probe
    WHERE id='24000000-0000-0000-0000-000000000011'
      AND vat_amount=20 AND amount=120
      AND issuer_vat_number_snapshot='GB111111111'
      AND customer_vat_number_snapshot='GB222222222'),
  'standard VAT adds VAT to PAYABLE and snapshots VAT identities'
);

SELECT ok(
  EXISTS (SELECT 1 FROM prelive_invoice_vat_probe
    WHERE id='24000000-0000-0000-0000-000000000012'
      AND vat_amount=20 AND amount=100 AND vat_treatment='reverse_charge'),
  'reverse charge discloses VAT but excludes it from PAYABLE'
);

SELECT ok(
  EXISTS (SELECT 1 FROM prelive_invoice_vat_probe
    WHERE id='24000000-0000-0000-0000-000000000013'
      AND vat_amount=0 AND amount=100 AND vat_treatment='zero_rated')
  AND EXISTS (SELECT 1 FROM prelive_invoice_vat_probe
    WHERE id='24000000-0000-0000-0000-000000000014'
      AND vat_amount=0 AND amount=100 AND vat_treatment='not_registered'
      AND issuer_vat_number_snapshot IS NULL),
  'zero-rated and not-registered remain distinct zero-VAT semantics'
);

SELECT throws_ok(
  $$INSERT INTO prelive_invoice_vat_probe
      (id,company_id,buyer_company_id,net_amount,vat_treatment,vat_rate)
    VALUES
      ('24000000-0000-0000-0000-000000000015','24000000-0000-0000-0000-000000000001',NULL,100,'not_registered',0)$$,
  '23514',
  NULL,
  'VAT-registered issuer cannot claim not_registered treatment'
);

SELECT * FROM finish();
ROLLBACK;
