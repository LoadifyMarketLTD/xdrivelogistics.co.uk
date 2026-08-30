import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const statusRepair = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830175400_restore_canonical_onboarding_invited_status.sql'),
  'utf8',
);
const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830175500_reconcile_canonical_driver_identity_gate.sql'),
  'utf8',
);
const runtimeProof = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830175600_verify_canonical_driver_identity_runtime.sql'),
  'utf8',
);

describe('canonical Driver identity reconciliation', () => {
  it('restores the canonical onboarding invited state before identity reconciliation', () => {
    expect(statusRepair).toContain("'invited'");
    expect(statusRepair).toContain('onboarding_applications_status_check');
    expect(statusRepair).not.toContain("'submitted',");
  });

  it('uses real production enum values for fail-closed Driver identity gates', () => {
    expect(migration).toContain("NEW.status := 'pending'::public.user_status");
    expect(migration).toContain("NEW.status := 'inactive'::public.status_enum");
    expect(migration).not.toContain("'pending_verification'::public.user_status");
    expect(migration).not.toContain("'pending_verification'::public.status_enum");
  });

  it('does not fabricate onboarding for a deleted legacy auth user', () => {
    expect(migration).toContain('EXISTS (SELECT 1 FROM auth.users u WHERE u.id = NEW.user_id)');
  });

  it('keeps approval as the positive activation gate and uses a valid membership role', () => {
    expect(migration).toContain('activate_approved_onboarding_identity');
    expect(migration).toContain("NEW.status <> 'approved'");
    expect(migration).toContain("THEN 'member'");
    expect(migration).not.toContain("THEN 'driver'\n          ELSE role_in_company");
  });

  it('immediately fails closed when an active Driver identity is held, banned or closed', () => {
    expect(migration).toContain('fail_close_driver_access_on_identity_change');
    expect(migration).toContain("status = 'invited'");
    expect(migration).toContain("status = 'inactive'::public.status_enum");
    expect(migration).toContain('app_access = false');
  });

  it('backfills only already approved, clear and document-complete Driver identities', () => {
    expect(migration).toContain("oa.status = 'approved'");
    expect(migration).toContain("oa.risk_status = 'clear'");
    expect(migration).toContain('get_missing_onboarding_documents');
    expect(migration).toContain("oa.account_type IN ('owner_driver', 'individual_driver')");
  });

  it('contains durable final invariants against operational authority without identity', () => {
    expect(migration).toContain('Driver identity invariant failed');
    expect(migration).toContain('identity_registry_allows_driver_access');
  });

  it('proves hold propagation and activation rejection transactionally in production', () => {
    expect(runtimeProof).toContain("SET status = 'on_hold'");
    expect(runtimeProof).toContain('PZ021');
    expect(runtimeProof).toContain("SET status = 'active'::public.status_enum");
    expect(runtimeProof).toContain('PZ022');
    expect(runtimeProof).toContain('Runtime proof finished with operational Driver authority missing canonical identity.');
  });
});
