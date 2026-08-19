import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const driverAction = read('app/api/driver/mobile/jobs/[id]/[action]/route.ts');
const operatorTransition = read('app/api/admin/jobs/[id]/transition/route.ts');
const autoInvoice = read('app/api/_lib/autoGenerateMarketplaceInvoice.ts');
const manualInvoice = read('app/api/driver/finance/invoices/route.ts');
const jobInvoice = read('app/api/driver/finance/jobs/[jobId]/generate-invoice/route.ts');
const decoupling = read('supabase/migrations/20260819151000_decouple_invoice_status_from_job_execution.sql');
const triggerNumbering = read('supabase/migrations/20260819152500_align_legacy_invoice_number_trigger_to_canonical.sql');
const workspaceStage = read('lib/jobs/workspaceJobStage.ts');

describe('invoice lifecycle stays separate from canonical job execution', () => {
  it('generates marketplace invoices from both Driver and Operator delivery boundaries', () => {
    expect(driverAction).toContain('autoGenerateMarketplaceInvoice({');
    expect(driverAction).toContain("if (action === 'delivered')");
    expect(operatorTransition).toContain('autoGenerateMarketplaceInvoice({');
    expect(operatorTransition).toContain("parsed.data.nextStatus === 'delivered' || parsed.data.nextStatus === 'completed'");
  });

  it('fails closed on canonical invoice-number generation across every server creation path', () => {
    for (const source of [autoInvoice, manualInvoice, jobInvoice]) {
      expect(source).toContain("rpc('next_invoice_number'");
      expect(source).toContain('Canonical invoice number generation');
      expect(source).not.toContain('fallbackNumber');
      expect(source).not.toContain('String(Date.now()).slice(-3)');
    }
  });

  it('keeps trigger-owned invoice creation on the same canonical numbering contract', () => {
    expect(triggerNumbering).toContain('CREATE OR REPLACE FUNCTION public.generate_invoice_number()');
    expect(triggerNumbering).toContain('NEW.invoice_number := public.next_invoice_number(NEW.company_id)');
    expect(triggerNumbering).not.toContain("NEW.invoice_number := 'XDR-' ||");
    expect(triggerNumbering).not.toContain('nextval(\'invoice_number_seq\')');
    expect(triggerNumbering).not.toContain('DROP TRIGGER IF EXISTS trg_generate_invoice_on_job_completion');
  });

  it('disables only the stale invoice-to-job-status coupling', () => {
    expect(decoupling).toContain('DROP TRIGGER IF EXISTS trg_sync_job_status_from_invoice ON public.invoices');
    expect(decoupling).toContain("to_regprocedure('public.fn_sync_job_status_from_invoice()') IS NOT NULL");
    expect(decoupling).not.toContain('DELETE FROM public.invoices');
    expect(decoupling).not.toContain('UPDATE public.invoices');
    expect(decoupling).not.toContain('INSERT INTO public.invoices');
  });

  it('keeps workspace execution presentation current_status-first with legacy finance aliases read-compatible', () => {
    expect(workspaceStage).toContain("job.current_status ?? job.status ?? ''");
    expect(workspaceStage).toContain("new Set(['delivered', 'completed', 'invoiced', 'paid'])");
  });
});
