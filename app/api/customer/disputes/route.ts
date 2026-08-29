import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

const createSchema = z.object({
  jobId: z.string().uuid(),
  description: z.string().trim().min(10).max(2000),
});

async function resolveCustomerContext(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { error: json(503, { error: 'Dispute service is not configured.' }) } as const;
  }

  const token = getBearerToken(request);
  if (!token) return { error: json(401, { error: 'Unauthorized.' }) } as const;

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return { error: json(401, { error: 'Unauthorized.' }) } as const;

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('company_id, role_in_company, status')
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (membershipError) return { error: json(500, { error: 'Company access could not be verified.' }) } as const;
  if (!membership) return { error: json(403, { error: 'Active company membership required.' }) } as const;

  return {
    userId: authData.user.id,
    companyId: membership.company_id as string,
  } as const;
}

export async function GET(request: NextRequest) {
  const context = await resolveCustomerContext(request);
  if ('error' in context) return context.error;

  const admin = supabaseAdmin!;
  const { data: jobs, error: jobsError } = await admin
    .from('jobs')
    .select('id')
    .eq('company_id', context.companyId)
    .limit(500);

  if (jobsError) return json(500, { error: 'Customer jobs could not be loaded.' });
  const jobIds = (jobs ?? []).map((job) => job.id as string);
  if (!jobIds.length) return json(200, { disputes: [] });

  const { data: disputes, error } = await admin
    .from('job_disputes')
    .select('id, job_id, status, description, resolution_note, created_at, updated_at, resolved_at')
    .in('job_id', jobIds)
    .order('created_at', { ascending: false })
    .limit(250);

  if (error) return json(500, { error: 'Disputes could not be loaded.' });
  return json(200, { disputes: disputes ?? [] });
}

export async function POST(request: NextRequest) {
  const context = await resolveCustomerContext(request);
  if ('error' in context) return context.error;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: 'Valid job and dispute details are required.' });

  const admin = supabaseAdmin!;
  const { data: job, error: jobError } = await admin
    .from('jobs')
    .select('id, company_id, status, current_status')
    .eq('id', parsed.data.jobId)
    .eq('company_id', context.companyId)
    .maybeSingle();

  if (jobError) return json(500, { error: 'Job access could not be verified.' });
  if (!job) return json(404, { error: 'Job not found in this customer workspace.' });

  const terminal = new Set(['completed', 'delivered', 'cancelled', 'failed', 'exception', 'disputed']);
  const jobState = String(job.current_status ?? job.status ?? '').toLowerCase();
  if (!terminal.has(jobState)) {
    return json(409, { error: 'A dispute can be raised only after the job reaches a terminal or exception state.' });
  }

  const { data: existing, error: existingError } = await admin
    .from('job_disputes')
    .select('id, status')
    .eq('job_id', job.id)
    .eq('raised_by_company_id', context.companyId)
    .in('status', ['open', 'investigating'])
    .limit(1)
    .maybeSingle();

  if (existingError) return json(500, { error: 'Existing disputes could not be checked.' });
  if (existing) return json(409, { error: 'An active dispute already exists for this job.', disputeId: existing.id });

  const { data: dispute, error: insertError } = await admin
    .from('job_disputes')
    .insert({
      job_id: job.id,
      raised_by_company_id: context.companyId,
      status: 'open',
      description: parsed.data.description,
    })
    .select('id, job_id, status, description, created_at')
    .single();

  if (insertError) return json(500, { error: 'The dispute could not be created.' });

  await admin.from('job_notes').insert({
    job_id: job.id,
    company_id: context.companyId,
    created_by: context.userId,
    note: `[CUSTOMER_DISPUTE_RAISED] ${parsed.data.description}`,
  });

  return json(201, { dispute });
}
