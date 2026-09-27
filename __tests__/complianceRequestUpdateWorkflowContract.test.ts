import fs from 'node:fs';
import path from 'node:path';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

const complianceRoute = read('app/api/super-admin/compliance/route.ts');
const documentRoute = read('app/api/super-admin/compliance/documents/route.ts');
const insurancePage = read('app/super-admin/compliance/insurance/page.tsx');
const operatorPage = read('app/super-admin/compliance/operator-licences/page.tsx');
const requestButton = read('app/super-admin/compliance/_components/ComplianceRequestUpdateButton.tsx');
const migration = read('supabase/migrations/20260927111030_owner_request_compliance_document_update_final.sql');

describe('Super Admin compliance request-update workflow', () => {
  it('lists company-level insurance and operator licence evidence in the dedicated compliance views', () => {
    expect(complianceRoute).toContain(".from('company_documents')");
    expect(complianceRoute).toContain("'public_liability'");
    expect(complianceRoute).toContain("'goods_in_transit'");
    expect(complianceRoute).toContain("'motor_fleet_insurance'");
    expect(complianceRoute).toContain("return query.eq('doc_type', 'operator_licence')");
    expect(complianceRoute).toContain("entity_type: 'company'");
    expect(complianceRoute).toContain('companyDocumentResult.count');
  });

  it('exposes a real request-update control instead of a disabled placeholder', () => {
    for (const page of [insurancePage, operatorPage]) {
      expect(page).toContain('ComplianceRequestUpdateButton');
      expect(page).toContain('documentFamily={row.entity_type}');
      expect(page).toContain('onUpdated={() => setRefreshKey');
      expect(page).not.toContain('aria-disabled="true"');
      expect(page).not.toContain('No governed request-update mutation is exposed');
    }
    expect(requestButton).toContain("action: 'request_update'");
    expect(requestButton).toContain("fetch('/api/super-admin/compliance/documents'");
    expect(requestButton).toContain('getAuthHeader()');
  });

  it('routes request-update through a dedicated service-side atomic RPC with a mandatory reason', () => {
    expect(documentRoute).toContain("z.enum(['approve', 'reject', 'request_update'])");
    expect(documentRoute).toContain("parsed.data.action === 'request_update'");
    expect(documentRoute).toContain('A reason is required when requesting a document update.');
    expect(documentRoute).toContain("'owner_request_compliance_document_update'");
    expect(documentRoute).toContain('notificationCount');
  });

  it('records replacement-required state, audit and recipient notifications atomically', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.owner_request_compliance_document_update');
    expect(migration).toContain('SECURITY INVOKER');
    expect(migration).toContain("action_type");
    expect(migration).toContain("'document_update_requested'");
    expect(migration).toContain("'compliance_document_update_requested'");
    expect(migration).toContain("cm.role_in_company::text IN ('owner', 'admin', 'fleet_manager')");
    expect(migration).toContain("cm.status::text = 'active'");
    expect(migration).toContain("c.status::text = 'active'");
    expect(migration).toContain("idempotency_key");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.owner_request_compliance_document_update");
    expect(migration).toContain('TO service_role');
  });
});
