import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260821005000_guardian_security_contract_closure.sql',
  ),
  'utf8',
);
const normalizedSource = source.replace(/\r\n/g, '\n');

describe('Branch Guardian post-merge security closure', () => {
  it('removes privileged bypass callers from the auth.uid-bound vehicle RPC', () => {
    expect(source).toContain(
      'public.set_vehicle_advertising_state(uuid, text, text, jsonb)',
    );
    expect(source).toContain('FROM PUBLIC, anon, service_role;');
    expect(source).toContain('TO authenticated;');
    expect(normalizedSource).toContain(
      "'service_role',\n    'public.set_vehicle_advertising_state(uuid,text,text,jsonb)',",
    );
  });

  it('converts every advisor-reported public view to security_invoker', () => {
    for (const view of [
      'jobs_reporting',
      'v_loads',
      'onboarding_approvals_documents_v1',
      'onboarding_approvals_documents_v2',
    ]) {
      expect(source).toContain(`'${view}'`);
    }

    expect(source).toContain(
      "'ALTER VIEW public.%I SET (security_invoker = true)'",
    );
    expect(source).toContain("ARRAY['security_invoker=true']");
  });

  it('fails closed when the canonical RPC or effective grants are wrong', () => {
    expect(source).toContain(
      'Canonical vehicle advertising RPC is missing; refusing partial security closure.',
    );
    expect(source).toContain(
      'service_role still has EXECUTE on the auth.uid()-bound vehicle advertising RPC.',
    );
    expect(source).toContain(
      'anon unexpectedly has EXECUTE on the vehicle advertising RPC.',
    );
    expect(source).toContain(
      'authenticated lost EXECUTE on the vehicle advertising RPC.',
    );
  });
});
