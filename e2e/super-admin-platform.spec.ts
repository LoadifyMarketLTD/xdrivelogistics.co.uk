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

  test('dashboard APIs use canonical platform authorisation', () => {
    for (const path of [
      'app/api/super-admin/stats/route.ts',
      'app/api/super-admin/platform/route.ts',
      'app/api/super-admin/companies/route.ts',
    ]) {
      const source = readFileSync(path, 'utf8');
      expect(source).toContain('requirePlatformOwner');
      expect(source).not.toContain("profile.role !== 'owner'");
    }
  });

  test('notification projection does not expose raw payloads or accepted amounts', () => {
    const source = readFileSync('app/api/super-admin/platform/route.ts', 'utf8');
    expect(source).not.toContain('bid_price_gbp');
    expect(source).not.toContain('bid_amount');
    expect(source).not.toContain('payload: row.payload');
    expect(source).toContain('safeNotificationMessage');
  });
});
