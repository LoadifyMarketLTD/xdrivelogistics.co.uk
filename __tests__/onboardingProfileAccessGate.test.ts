import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
const initRoute = read('app/api/onboarding/init/route.ts');
const reviewMigration = read('supabase/migrations/20260928112500_enforce_pending_profile_until_onboarding_approval.sql');

describe('onboarding profile access gate', () => {
  it('keeps governed onboarding profiles pending until approval', () => {
    expect(initRoute).toContain("accountType !== 'customer_shipper' && upserted.status !== 'approved'");
    expect(initRoute).toContain(".update({ status: 'pending'");
    expect(initRoute).toContain("code: 'onboarding_profile_gate_failed'");
  });

  it('repairs legacy governed applications without touching approved or customer profiles', () => {
    expect(reviewMigration).toContain("a.account_type IN ('broker_shipper', 'fleet_courier', 'owner_driver', 'individual_driver')");
    expect(reviewMigration).toContain("a.status IN ('invited', 'draft', 'in_progress', 'request_changes', 'submitted', 'under_review', 'compliance_review', 'admin_approval')");
    expect(reviewMigration).toContain("SET status = 'pending'::public.user_status");
    expect(reviewMigration).not.toContain("'customer_shipper'");
    expect(reviewMigration).not.toContain("a.status = 'approved'");
  });

  it('fails closed if any governed unfinished profile remains active after repair', () => {
    expect(reviewMigration).toContain('Governed onboarding profile gate invariant is still violated.');
  });
});
