import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830191800_harden_onboarding_submit_authority.sql'),
  'utf8',
);
const runtimeProof = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830191900_verify_onboarding_submit_authority_runtime.sql'),
  'utf8',
);
const handler = fs.readFileSync(
  path.join(process.cwd(), 'app/api/onboarding/_lib/handlers.ts'),
  'utf8',
);

describe('onboarding submission authority', () => {
  it('removes direct authenticated execution of all onboarding submit RPCs', () => {
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.submit_onboarding_application(uuid) FROM authenticated',
    );
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.submit_onboarding_application(uuid, uuid) FROM authenticated',
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.submit_onboarding_application(uuid, uuid) TO service_role',
    );
  });

  it('binds the canonical service RPC to the authenticated actor supplied by the server', () => {
    expect(migration).toContain('v_app.user_id IS DISTINCT FROM p_actor_user_id');
    expect(migration).toContain('Forbidden: onboarding application belongs to another user.');
    expect(migration).toContain('SELECT 1 FROM auth.users u WHERE u.id = p_actor_user_id');
  });

  it('normalizes removed legacy submit states into canonical under_review', () => {
    expect(migration).toContain("NEW.status IN ('submitted', 'compliance_review', 'admin_approval')");
    expect(migration).toContain("NEW.status := 'under_review'");
    expect(migration).toContain('BEFORE INSERT OR UPDATE OF status');
  });

  it('keeps the deployed server compatibility path scoped to the authenticated user', () => {
    const submitHandlerStart = handler.indexOf('export const buildSubmitHandler');
    const submitHandler = handler.slice(submitHandlerStart);
    const userScope = submitHandler.indexOf(".eq('user_id', authUser.id)");
    const rpcCall = submitHandler.indexOf("rpc('submit_onboarding_application'");
    expect(userScope).toBeGreaterThanOrEqual(0);
    expect(rpcCall).toBeGreaterThan(userScope);
  });

  it('keeps the preserved base private from browser and service-role direct execution', () => {
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM authenticated',
    );
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM service_role',
    );
  });

  it('contains hosted proof for ACL, actor mismatch and rollback-only status normalization', () => {
    expect(runtimeProof).toContain('Authenticated can still execute the legacy one-argument submit RPC.');
    expect(runtimeProof).toContain('Actor-bound submit accepted a user id that does not own the application.');
    expect(runtimeProof).toContain("SET status = 'submitted'");
    expect(runtimeProof).toContain("status = 'under_review'");
    expect(runtimeProof).toContain('PZ071');
    expect(runtimeProof).toContain('did not roll back cleanly');
  });
});
