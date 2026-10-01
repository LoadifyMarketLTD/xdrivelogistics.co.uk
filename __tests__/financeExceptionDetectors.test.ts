import { describe, expect, it } from 'vitest';

import {
  detectFinanceExceptions,
  type DetectorInvoice,
  type InvoiceFailureEvent,
  type JobFinanceContext,
} from '../lib/exception-closure/financeExceptionDetectors';

const NOW = Date.parse('2026-09-30T12:00:00Z');
const jobId = '11111111-1111-1111-1111-111111111111';

const jobs = new Map<string, JobFinanceContext>([
  [jobId, { id: jobId, label: 'XD-TEST-001', companyId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', isTest: false }],
]);

const invoice = (overrides: Partial<DetectorInvoice> = {}): DetectorInvoice => ({
  id: '22222222-2222-2222-2222-222222222222',
  job_id: jobId,
  invoice_number: 'INV-001',
  status: 'sent',
  payment_status: 'unpaid',
  due_date: '2026-09-29',
  ...overrides,
});

describe('finance exception detectors', () => {
  it('detects overdue invoice payment after the due date', () => {
    const rows = detectFinanceExceptions([invoice()], [], jobs, NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.caseType).toBe('payment_overdue');
    expect(rows[0]?.entityType).toBe('invoice');
    expect(rows[0]?.dedupeKey).toContain('payment_overdue:invoice:');
  });

  it('does not mark an invoice overdue on its due date', () => {
    const rows = detectFinanceExceptions([invoice({ due_date: '2026-09-30' })], [], jobs, NOW);
    expect(rows.map((row) => row.caseType)).not.toContain('payment_overdue');
  });

  it('does not treat draft invoices as overdue receivables', () => {
    const rows = detectFinanceExceptions([invoice({ status: 'draft', due_date: '2026-09-01' })], [], jobs, NOW);
    expect(rows.map((row) => row.caseType)).not.toContain('payment_overdue');
  });

  it('detects disputed invoices as P1 exceptions', () => {
    const rows = detectFinanceExceptions([
      invoice({ payment_status: 'disputed', due_date: '2026-10-15' }),
    ], [], jobs, NOW);
    const disputed = rows.find((row) => row.caseType === 'payment_disputed');
    expect(disputed?.severity).toBe('P1');
    expect(disputed?.customerUpdateDueMinutes).toBe(30);
  });

  it('detects persisted invoice generation failures only when no invoice exists', () => {
    const event: InvoiceFailureEvent = {
      job_id: jobId,
      message: 'Automatic invoice generation failed',
      created_at: '2026-09-30T11:55:00Z',
    };
    const failed = detectFinanceExceptions([], [event], jobs, NOW);
    expect(failed.map((row) => row.caseType)).toContain('invoice_generation_failed');

    const recovered = detectFinanceExceptions([invoice()], [event], jobs, NOW);
    expect(recovered.map((row) => row.caseType)).not.toContain('invoice_generation_failed');
  });

  it('ignores finance records tied to test jobs', () => {
    const testJobs = new Map<string, JobFinanceContext>([
      [jobId, { id: jobId, label: 'TEST', companyId: null, isTest: true }],
    ]);
    const rows = detectFinanceExceptions(
      [invoice({ payment_status: 'disputed' })],
      [{ job_id: jobId, message: 'failed' }],
      testJobs,
      NOW,
    );
    expect(rows).toHaveLength(0);
  });
});
