import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const executionPage = read('app/components/workspace/DriverJobExecutionPage.tsx');
const diaryPage = read('app/driver/history/page.tsx');
const financePage = read('app/driver/finance/page.tsx');
const sendPanel = read('app/driver/finance/invoices/[id]/DriverInvoiceEmailPanel.tsx');

const handler = (source: string, begin: string, end: string) => {
  const start = source.indexOf(begin);
  const stop = source.indexOf(end, start + begin.length);
  expect(start, `Expected handler: ${begin}`).toBeGreaterThanOrEqual(0);
  expect(stop, `Expected next handler: ${end}`).toBeGreaterThan(start);
  return source.slice(start, stop);
};

describe('invoice Draft must be reviewed before any email delivery', () => {
  const execution = handler(executionPage,
    'const createInvoice = async (stayInWorkflow=false) => {',
    'const moveStatus = async (nextStatus: string) => {');
  const diary = handler(diaryPage,
    'const createInvoiceForJob = async (job: HistoryJob) => {',
    'const requestDiaryCancellation = useCallback(');
  const finance = handler(financePage,
    'const generateInvoice = async (jobId: string) => {',
    'const counts = useMemo(');

  it('never invokes automatic invoice Send after Draft creation from any surface', () => {
    for (const source of [execution, diary, finance]) {
      expect(source).toContain('/generate-invoice');
      expect(source).not.toContain('sendGeneratedInvoice(');
      expect(source).not.toContain('/submit');
    }
  });

  it('preserves the mandatory POD gate before creating an execution or diary invoice', () => {
    expect(execution).toContain('hasCompletePodEvidence(job)');
    expect(diary).toContain('hasCompletePodEvidence(job)');
  });

  it('navigates to the editable Draft, not to a sent invoice', () => {
    expect(execution).toContain('router.push(`/driver/finance/invoices/${payload.invoice.id}/edit`)');
    expect(execution).toContain('stayInWorkflow');
    for (const source of [diary, finance]) {
      expect(source).toContain('router.push(`/driver/finance/invoices/${payload.invoice.id}/edit`)');
    }
    expect(execution).toContain('Draft invoice created. Review it before sending');
  });

  it('keeps explicit authenticated Send in the dedicated invoice review panel', () => {
    expect(sendPanel).toContain('const sendInvoice = async () => {');
    expect(sendPanel).toContain('/submit');
    expect(sendPanel).toContain("method: 'POST'");
    expect(sendPanel).toContain('if (!canSend || !subject.trim() || !message.trim()) return;');
  });
});
