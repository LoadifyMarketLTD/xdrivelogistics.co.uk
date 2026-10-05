import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('full-audit runtime repairs', () => {
  it('reconciles driver location, tracking event and booking acceptance DB contracts', () => {
    const migration = read('supabase/migrations/20261005084039_reconcile_driver_runtime_contracts.sql');
    expect(migration).toContain("'driver_app', 'driver_web', 'telematics'");
    expect(migration).toContain("driver_locations_telematics_provenance_check");
    expect(migration).toContain("source = 'driver_web'");
    expect(migration).toContain("source_provider = 'browser_geolocation'");
    expect(migration).toContain("'driver_instruction_added'");
    expect(migration).toContain("'multi_drop_stop_arrived'");
    expect(migration).toContain("'multi_drop_stop_completed'");
    expect(migration).toContain("'collection_handover'");
    expect(migration).toContain("''allocated'', ''accepted'', ''cancelled'', ''disputed''");
  });

  it('writes POD job fields and proof record atomically for web and mobile drivers', () => {
    const migration = read('supabase/migrations/20261005084133_atomic_driver_pod_write.sql');
    const mobile = read('app/api/driver/mobile/jobs/[id]/[action]/route.ts');
    const web = read('app/api/driver/web/jobs/[id]/[action]/route.ts');
    expect(migration).toContain('record_driver_pod_atomic');
    expect(migration).toContain('UPDATE public.jobs');
    expect(migration).toContain('public.proof_of_delivery');
    expect(mobile).toContain("rpc('record_driver_pod_atomic'");
    expect(web).toContain("rpc('record_driver_pod_atomic'");
    expect(mobile).not.toContain(".from('proof_of_delivery').insert");
    expect(web).not.toContain(".from('proof_of_delivery').insert");
  });

  it('hardens trigger RPC grants and reconciles legacy POD only from complete existing evidence', () => {
    const hardening = read('supabase/migrations/20261005084245_harden_trigger_function_execute_grants.sql');
    const backfill = read('supabase/migrations/20261005084441_reconcile_legacy_pod_records.sql');
    expect(hardening).toContain('REVOKE EXECUTE ON FUNCTION public.fn_apply_accepted_job_amendment()');
    expect(hardening).toContain('REVOKE EXECUTE ON FUNCTION public.sync_company_contact_name_from_onboarding()');
    expect(hardening).toContain('GRANT EXECUTE ON FUNCTION public.fn_apply_accepted_job_amendment() TO service_role');
    expect(backfill).toContain('j.delivery_signature_data IS NOT NULL');
    expect(backfill).toContain("NULLIF(btrim(COALESCE(j.client_signature_name, '')), '') IS NOT NULL");
    expect(backfill).toContain("photo !~* '^data:'");
    expect(backfill).toContain('NOT EXISTS');
  });
  it('preserves the route auth cookie during temporary auth service outages', () => {
    const middleware = read('middleware.ts');
    expect(middleware).toContain('const buildLoginRedirect = (request: NextRequest, reason?: string, clearCookie = true) =>');
    expect(middleware).toContain("buildLoginRedirect(request, 'service_unavailable', false)");
    expect(middleware).toContain('if (clearCookie)');
  });
  it('rate limits unauthenticated public quote intake in the database', () => {
    const migration = read('supabase/migrations/20261005084205_public_quote_request_rate_limit.sql');
    const route = read('app/api/public/quote-request/route.ts');
    expect(migration).toContain('consume_public_quote_rate_limit');
    expect(route).toContain("rateKey('ip'");
    expect(route).toContain("rateKey('email'");
    expect(route).toContain("status: 429");
    expect(route).toContain("'Retry-After': '3600'");
  });
});
