import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

const bodySchema = z.object({
  jobIds: z.array(z.string().uuid()).min(1).max(150),
});

async function resolveDriver(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { error: json(503, { error: 'Service not configured.' }) } as const;
  }

  const token = getBearerToken(request);
  if (!token) {
    return { error: json(401, { error: 'Unauthorized — missing bearer token.' }) } as const;
  }

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) {
    return { error: json(401, { error: 'Unauthorized — invalid or expired token.' }) } as const;
  }

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, status')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (driverError || !driver) {
    return { error: json(403, { error: 'Driver profile required.' }) } as const;
  }

  const status = String(driver.status ?? '').trim().toLowerCase();
  if (['suspended', 'inactive', 'blocked', 'rejected'].includes(status)) {
    return { error: json(403, { error: 'Active driver profile required.' }) } as const;
  }

  return {
    driverId: driver.id as string,
    companyId: driver.company_id as string,
  } as const;
}

export async function POST(request: NextRequest) {
  const resolved = await resolveDriver(request);
  if ('error' in resolved) return resolved.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Invalid marketplace member lookup.' });
  }

  const jobIds = [...new Set(parsed.data.jobIds)];
  const admin = supabaseAdmin!;

  const { data: jobs, error: jobsError } = await admin
    .from('jobs')
    .select('id, company_id, status, exchange_posted_at, awarded_carrier_company_id')
    .in('id', jobIds)
    .not('exchange_posted_at', 'is', null)
    .is('awarded_carrier_company_id', null);

  if (jobsError) {
    return json(500, { error: 'Marketplace member lookup failed.' });
  }

  const eligibleJobs = (jobs ?? []).filter((job) => {
    const status = String(job.status ?? '').trim().toLowerCase();
    return ['posted', 'quoted'].includes(status) && job.company_id !== resolved.companyId;
  });

  const companyIds = [...new Set(eligibleJobs.map((job) => String(job.company_id)).filter(Boolean))];
  if (companyIds.length === 0) {
    return json(200, { members: {} });
  }

  const { data: companies, error: companiesError } = await admin
    .from('companies')
    .select('id, name')
    .in('id', companyIds);

  if (companiesError) {
    return json(500, { error: 'Marketplace member lookup failed.' });
  }

  const companyNameById = new Map(
    (companies ?? []).map((company) => [String(company.id), String(company.name ?? '').trim()])
  );

  const members: Record<string, string> = {};
  for (const job of eligibleJobs) {
    const name = companyNameById.get(String(job.company_id));
    if (name) members[String(job.id)] = name;
  }

  return json(200, { members });
}
