import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

import { toPersistedOnboardingAccountType } from '../lib/onboardingContract';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('legacy Fleet onboarding convergence', () => {
  it('normalizes the historical Fleet Operator alias to the canonical persisted account type', () => {
    expect(toPersistedOnboardingAccountType('fleet_operator')).toBe('fleet_courier');
  });

  it('normalizes generic resume routing instead of indexing with a raw legacy account type', () => {
    const route = readRepoFile('app/api/onboarding/session/route.ts');

    expect(route).toContain('normalizeOnboardingAccountType');
    expect(route).toContain('const accountType = normalizeOnboardingAccountType(app.account_type);');
    expect(route).toContain('ONBOARDING_ROUTE_SEGMENT_BY_ACCOUNT_TYPE[accountType]');
    expect(route).toContain("code: 'unsupported_saved_account_type'");
    expect(route).toContain('account_type: accountType');
  });

  it('binds only unambiguous pending legacy Fleet companies without changing approval state', () => {
    const migration = readRepoFile(
      'supabase/migrations/20260830204000_reconcile_legacy_fleet_onboarding_bindings.sql',
    );

    expect(migration).toContain("SET account_type = 'fleet_courier'");
    expect(migration).toContain("'{legacy_persisted_account_type}'");
    expect(migration).toContain("c.status::text = 'pending_approval'");
    expect(migration).toContain('p.company_id = c.id');
    expect(migration).toContain("cm.role_in_company = 'owner'");
    expect(migration).toContain("cm.status::text = 'invited'");
    expect(migration).toContain('count(*) FROM public.companies c2');
    expect(migration).toContain('count(*) FROM public.company_memberships cm2');
    expect(migration).toContain("SET company_type = 'carrier'");
    expect(migration).not.toContain('UPDATE public.company_memberships');
    expect(migration).not.toContain('SET completion_percentage');
  });

  it('keeps a durable no-approval postcondition for the reconciled cohort', () => {
    const verification = readRepoFile(
      'supabase/migrations/20260830204100_verify_legacy_fleet_onboarding_convergence.sql',
    );

    expect(verification).toContain("oa.account_type = 'fleet_operator'");
    expect(verification).toContain('An unambiguous pending legacy Fleet company remains unbound.');
    expect(verification).toContain("cm.status::text <> 'invited'");
    expect(verification).toContain("oa.status NOT IN ('draft', 'in_progress', 'request_changes', 'under_review')");
    expect(verification).not.toContain('UPDATE public.onboarding_applications');
    expect(verification).not.toContain('UPDATE public.company_memberships');
  });
});
