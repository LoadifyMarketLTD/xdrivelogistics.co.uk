import { NextRequest, NextResponse } from 'next/server';
import { requireDriverFinanceAccess } from '../../../_lib/financeAccess';
import { GET as getEligibleJobs } from '../../eligible/route';

// Read-only, job-scoped adapter to the canonical Finance eligibility service.
export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const access = await requireDriverFinanceAccess(request);
  if (!access.ok) return access.response;
  const { jobId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
    return NextResponse.json({ error: 'Invalid job ID.' }, { status: 400 });
  }
  const url = request.nextUrl.clone();
  url.search = '';
  url.searchParams.set('jobId', jobId);
  const response = await getEligibleJobs(new NextRequest(url, { headers: request.headers }));
  if (!response.ok) return response;
  const data = await response.json();
  const rows = Array.isArray(data.rows) ? data.rows.filter((row: { id?: string }) => row.id === jobId) : [];
  const blocker = typeof data.blocker === 'string' ? data.blocker : undefined;
  const invoice = data.invoice?.job_id === jobId ? data.invoice : undefined;
  const context = data.context?.id === jobId ? data.context : undefined;
  return NextResponse.json({ rows, blocker, invoice, context }, { headers: { 'Cache-Control': 'private, no-store' } });
}