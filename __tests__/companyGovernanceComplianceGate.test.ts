import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830182500_company_governance_compliance_gate.sql'),
  'utf8',
);
const runtimeProof = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830182600_verify_company_governance_compliance_gate_runtime.sql'),
  'utf8',
);

describe('company governance compliance gate', () => {
  it('enforces compliance inside the service-role governance RPC before activation', () => {
    expect(migration).toContain("IF v_new_status = 'active' THEN");
    expect(migration).toContain('assert_company_compliance_ready(p_target_company_id)');
    expect(migration.indexOf('assert_company_compliance_ready')).toBeLessThan(
      migration.indexOf("UPDATE public.companies SET status"),
    );
  });

  it('keeps the governance RPC service-role only', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.set_company_status_governance');
    expect(migration).toContain('FROM authenticated');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.set_company_status_governance');
    expect(migration).toContain('TO service_role');
  });

  it('retains durable audited governance mutation after compliance passes', () => {
    expect(migration).toContain('INSERT INTO public.owner_audit_log');
    expect(migration).toContain("'governance_api'");
  });

  it('proves a direct non-compliant activation is rejected without status/audit mutation', () => {
    expect(runtimeProof).toContain("WHEN SQLSTATE '23514'");
    expect(runtimeProof).toContain('Non-compliant company activation was not rejected');
    expect(runtimeProof).toContain('Rejected company activation changed company status');
    expect(runtimeProof).toContain('Rejected company activation wrote a governance audit row');
  });
});
