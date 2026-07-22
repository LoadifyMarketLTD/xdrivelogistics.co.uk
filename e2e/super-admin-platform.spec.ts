import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { getEffectiveJobStatus, getInvoiceState, isActiveExecutionStatus } from '../lib/workspaceClassifiers';

test.describe('super admin platform boundaries', () => {
  test('uses effective lifecycle state for platform KPIs', () => {
    expect(getEffectiveJobStatus({ status: 'posted', current_status: 'accepted' })).toBe('accepted');
    expect(isActiveExecutionStatus('accepted')).toBe(true);
    expect(isActiveExecutionStatus('allocated')).toBe(false);
    expect(isActiveExecutionStatus('awarded')).toBe(false);
  });

  test('reconciles invoice business and payment states', () => {
    expect(getInvoiceState({ status: 'void', payment_status: 'unpaid' }).unpaid).toBe(false);
    expect(getInvoiceState({ status: 'submitted', payment_status: 'paid' }).unpaid).toBe(false);
    expect(getInvoiceState({ status: 'submitted', payment_status: 'unpaid', due_date: '2020-01-01' }).overdue).toBe(true);
  });

  test('refined platform APIs use canonical server authorisation', () => {
    for (const path of [
      'app/api/super-admin/stats/route.ts',
      'app/api/super-admin/platform/route.ts',
      'app/api/super-admin/companies/route.ts',
      'app/api/super-admin/companies/[id]/route.ts',
      'app/api/super-admin/onboarding/[id]/route.ts',
      'app/api/super-admin/audit/route.ts',
    ]) {
      const source = readFileSync(path, 'utf8');
      expect(source).toContain('requirePlatformOwner');
      expect(source).not.toContain("profile.role !== 'owner'");
      expect(source).not.toContain('getBearerToken(request)');
    }
  });

  test('notification projection does not expose raw payloads or accepted amounts', () => {
    const source = readFileSync('app/api/super-admin/platform/route.ts', 'utf8');
    expect(source).not.toContain('bid_price_gbp');
    expect(source).not.toContain('bid_amount');
    expect(source).not.toContain('payload: row.payload');
    expect(source).toContain('safeNotificationMessage');
  });

  test('high-risk governance mutations use the authenticated platform actor', () => {
    const companyMutation = readFileSync('app/api/super-admin/companies/[id]/route.ts', 'utf8');
    const onboardingMutation = readFileSync('app/api/super-admin/onboarding/[id]/route.ts', 'utf8');
    expect(companyMutation).toContain('p_actor_user_id: access.user.id');
    expect(onboardingMutation).toContain('p_actor_user_id: access.user.id');
  });
});
