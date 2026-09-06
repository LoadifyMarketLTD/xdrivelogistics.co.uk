import fs from 'node:fs';
import path from 'node:path';
import { buildMemberReputation } from '../app/api/_lib/memberReputation';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX Directory delivery/payment reputation contract', () => {
  it('derives Delivery reliability only from planned versus actual delivery evidence', () => {
    const result = buildMemberReputation(['carrier-a'], [
      { awarded_carrier_company_id: 'carrier-a', status: 'delivered', delivery_datetime: '2026-01-01T12:00:00Z', delivered_at: '2026-01-01T11:00:00Z' },
      { awarded_carrier_company_id: 'carrier-a', status: 'completed', delivery_datetime: '2026-01-02T12:00:00Z', completed_at: '2026-01-02T13:00:00Z' },
      { awarded_carrier_company_id: 'carrier-a', status: 'completed', delivery_datetime: null, completed_at: '2026-01-03T10:00:00Z' },
    ], [], [], Date.parse('2026-02-01T00:00:00Z'));
    expect(result.get('carrier-a')?.delivery).toEqual({ score: 50, evidenceCount: 2, completedJobs: 3 });
  });

  it('derives Payment reliability from settlement history plus overdue-open evidence', () => {
    const result = buildMemberReputation(['buyer-a'], [], [
      { id: 'i1', buyer_company_id: 'buyer-a', amount: 100, due_date: '2026-01-10', status: 'sent', payment_status: 'paid' },
      { id: 'i2', buyer_company_id: 'buyer-a', amount: 200, due_date: '2026-01-10', status: 'sent', payment_status: 'unpaid' },
      { id: 'i3', buyer_company_id: 'buyer-a', amount: 50, due_date: '2026-01-10', status: 'paid', payment_status: 'paid' },
    ], [
      { invoice_id: 'i1', amount: 60, paid_at: '2026-01-08T10:00:00Z' },
      { invoice_id: 'i1', amount: 40, paid_at: '2026-01-09T10:00:00Z' },
    ], Date.parse('2026-02-01T00:00:00Z'));
    expect(result.get('buyer-a')?.payment).toEqual({ score: 50, evidenceCount: 2, onTimePaid: 1, latePaid: 0, overdueOpen: 1 });
  });

  it('does not relabel generic legacy reviews as Delivery or Payment feedback', () => {
    const route = read('app/api/directory/route.ts');
    expect(route).toContain('Generic legacy reviews are not relabelled as Delivery or Payment feedback.');
    expect(route).not.toContain("from('reviews')");
  });

  it('exposes truth-derived reputation to company and driver Directory records', () => {
    const route = read('app/api/directory/route.ts');
    const page = read('app/components/workspace/MemberDirectoryPage.tsx');
    expect(route).toContain('deliveryReliability');
    expect(route).toContain('paymentReliability');
    expect(route).toContain(".from('invoice_payment_history')");
    expect(page).toContain('DELIVERY / PAYMENT RELIABILITY');
    expect(page).toContain('COMPANY RELIABILITY');
  });

  it('supports minimum verified Delivery and Payment reliability filters', () => {
    const page = read('app/components/workspace/MemberDirectoryPage.tsx');
    expect(page).toContain('DELIVERY RELIABILITY');
    expect(page).toContain('PAYMENT RELIABILITY');
    expect(page).toContain('company.deliveryReliability.score >= deliveryThreshold');
    expect(page).toContain('company.paymentReliability.score >= paymentThreshold');
  });
});
