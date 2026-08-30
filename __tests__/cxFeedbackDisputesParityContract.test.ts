import fs from 'node:fs';
import path from 'node:path';

const customerPage = fs.readFileSync(path.join(process.cwd(), 'app/customer/disputes/page.tsx'), 'utf8');
const customerApi = fs.readFileSync(path.join(process.cwd(), 'app/api/customer/disputes/route.ts'), 'utf8');
const brokerPage = fs.readFileSync(path.join(process.cwd(), 'app/broker/disputes/page.tsx'), 'utf8');
const brokerApi = fs.readFileSync(path.join(process.cwd(), 'app/api/broker/disputes/[id]/route.ts'), 'utf8');
const driverDiary = fs.readFileSync(path.join(process.cwd(), 'app/driver/history/page.tsx'), 'utf8');
const reviewRls = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/037_secondary_table_hardening.sql'), 'utf8');

describe('CX-close feedback and disputes parity', () => {
  it('keeps customer disputes job-scoped and duplicate-safe', () => {
    expect(customerPage).toContain('Feedback & Disputes');
    expect(customerApi).toContain(".eq('company_id', context.companyId)");
    expect(customerApi).toContain('A dispute can be raised only after the job reaches a terminal or exception state.');
    expect(customerApi).toContain(".in('status', ['open', 'investigating'])");
    expect(customerApi).toContain('[CUSTOMER_DISPUTE_RAISED]');
  });

  it('keeps broker dispute mutation within company scope', () => {
    expect(brokerPage).toContain("runAction(row.id, 'resolve')");
    expect(brokerPage).toContain("runAction(row.id, 'escalate')");
    expect(brokerApi).toContain('Admin or owner role required to manage disputes.');
    expect(brokerApi).toContain('dispute.raised_by_company_id === companyId');
    expect(brokerApi).toContain('job?.company_id === companyId');
    expect(brokerApi).toContain('[DISPUTE_${action.toUpperCase()}]');
  });

  it('shows real driver feedback without fabricating a writable driver contract', () => {
    expect(driverDiary).toContain("supabase.from('reviews').select('id, job_id, rating, comment, created_at')");
    expect(driverDiary).toContain('View feedback');
    expect(driverDiary).toContain('Awaiting feedback');
    expect(driverDiary).not.toContain('Leave Feedback');
    expect(driverDiary).not.toContain('Edit Feedback');
    expect(reviewRls).toContain('CREATE POLICY "reviews_insert_non_driver"');
    expect(reviewRls).toContain('public.is_company_non_driver(company_id)');
  });
});
