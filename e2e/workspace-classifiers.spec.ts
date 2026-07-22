import { expect, test } from '@playwright/test';
import {
  getEffectiveJobStatus,
  getInvoiceState,
  getRecordedComplianceState,
  isActiveExecutionStatus,
  isExceptionJobStatus,
  isTerminalJobStatus,
} from '../lib/workspaceClassifiers';

test.describe('workspace classifiers', () => {
  test('prefers current_status and separates lifecycle groups', () => {
    expect(getEffectiveJobStatus({ status: 'awarded', current_status: 'allocated' })).toBe('allocated');
    expect(isActiveExecutionStatus('accepted')).toBe(true);
    expect(isActiveExecutionStatus('allocated')).toBe(false);
    expect(isActiveExecutionStatus('awarded')).toBe(false);
    expect(isTerminalJobStatus('completed')).toBe(true);
    expect(isExceptionJobStatus('failed_delivery')).toBe(true);
  });

  test('reconciles invoice status and payment status', () => {
    const now = new Date('2026-07-22T12:00:00Z').getTime();
    expect(getInvoiceState({ status: 'submitted', payment_status: 'unpaid', due_date: '2026-07-21' }, now).overdue).toBe(true);
    expect(getInvoiceState({ status: 'void', payment_status: 'unpaid', due_date: '2026-07-21' }, now).unpaid).toBe(false);
    expect(getInvoiceState({ status: 'submitted', payment_status: 'paid', due_date: '2026-07-21' }, now).overdue).toBe(false);
  });

  test('uses only recorded document state', () => {
    const now = new Date('2026-07-22T12:00:00Z').getTime();
    expect(getRecordedComplianceState({ status: 'approved', expiry_date: '2026-07-21' }, now).blocking).toBe(true);
    expect(getRecordedComplianceState({ status: 'rejected', expiry_date: '2027-01-01' }, now).blocking).toBe(true);
    expect(getRecordedComplianceState({ status: 'approved', expiry_date: null }, now).blocking).toBe(false);
  });
});
