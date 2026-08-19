import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const driverAction = read('app/api/driver/mobile/jobs/[id]/[action]/route.ts');
const operatorTransition = read('app/api/admin/jobs/[id]/transition/route.ts');
const decoupling = read('supabase/migrations/20260819151000_decouple_invoice_status_from_job_execution.sql');
const workspaceStage = read('lib/jobs/workspaceJobStage.ts');

describe('invoice lifecycle stays separate from canonical job execution', () => {
  it('generates marketplace invoices from both Driver and Operator delivery boundaries', () => {
    expect(driverAction).toContain('autoGenerateMarketplaceInvoice({');
    expect(driverAction).toContain("if (action === 'delivered')");
    expect(operatorTransition).toContain('autoGenerateMarketplaceInvoice({');
    expect(operatorTransition).toContain("parsed.data.nextStatus === 'delivered' || parsed.data.nextStatus === 'completed'");
  });

  it('disables only the stale invoice-to-job-status coupling', () => {
    expect(decoupling).toContain('DROP TRIGGER IF EXISTS trg_sync_job_status_from_invoice ON public.invoices');
    expect(decoupling).not.toContain('DELETE FROM public.invoices');
    expect(decoupling).not.toContain('UPDATE public.invoices');
    expect(decoupling).not.toContain('INSERT INTO public.invoices');
  });

  it('keeps workspace execution presentation current_status-first with legacy finance aliases read-compatible', () => {
    expect(workspaceStage).toContain("job.current_status ?? job.status ?? ''");
    expect(workspaceStage).toContain("new Set(['delivered', 'completed', 'invoiced', 'paid'])");
  });
});
