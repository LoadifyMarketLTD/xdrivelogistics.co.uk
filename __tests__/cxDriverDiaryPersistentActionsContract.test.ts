import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX-close Driver Diary persistent action contract', () => {
  const diary = read('app/driver/history/page.tsx');
  const css = read('app/driver/history/diary-exchange.css');
  const preview = read('app/driver/_components/DriverInvoicePreviewModal.tsx');

  it('keeps operational actions visible before the expanded detail panel', () => {
    const railIndex = diary.indexOf('driver-diary-action-rail');
    const expandedIndex = diary.indexOf('{expanded && (', railIndex);
    expect(railIndex).toBeGreaterThan(0);
    expect(expandedIndex).toBeGreaterThan(railIndex);
    expect(diary).toContain("{ id: 'pod', label: 'POD' }");
    expect(diary).toContain("{ id: 'order', label: 'Order' }");
    expect(diary).toContain("{ id: 'notes', label: 'Notes' }");
    expect(diary).toContain("{ id: 'history', label: 'History' }");
    expect(diary).toContain("{ id: 'documents', label: 'Documents' }");
    expect(diary).toContain("{ id: 'invoice', label: 'Invoice' }");
  });

  it('uses the persistent rail to open the existing detail content instead of duplicating business logic', () => {
    expect(diary).toContain('openDetail(job.id, detailItem.id)');
    expect(diary).toContain("if (tab === 'order' || tab === 'notes' || tab === 'invoice') void fetchOrderSheet(jobId)");
    expect(diary).toContain('View feedback');
  });

  it('opens invoice PDF in the authenticated contextual preview', () => {
    expect(diary).toContain('DriverInvoicePreviewModal');
    expect(diary).toContain("setInvoicePreview({ id: invoice.id, number: invoice.number })");
    expect(diary).toContain('View invoice (£)');
    expect(preview).toContain('/api/driver/finance/invoices/${encodeURIComponent(invoiceId)}/preview');
    expect(preview).toContain('Return to Diary');
  });

  it('keeps the action rail on the measured micro-action contract', () => {
    expect(css).toContain('.driver-diary-action-rail');
    expect(css).toContain('var(--ws-micro-action-h, 24px)');
    expect(css).toContain('var(--ws-font-meta, 11px)');
    expect(css).toContain('var(--ws-border, #cfd7e3)');
  });

  it('does not introduce Super Admin coupling', () => {
    expect(diary).not.toContain('/super-admin');
    expect(preview).not.toContain('/super-admin');
  });
});
