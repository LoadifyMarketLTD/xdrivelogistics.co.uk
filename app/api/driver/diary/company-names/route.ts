import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
} from '../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

type JobCompanyRow = {
  id: string;
  company_id: string | null;
};

type CompanyRow = {
  id: string;
  name: string | null;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Missing bearer token.' });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Invalid session.' });

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (driverError) return respond(500, { error: driverError.message });
  if (!driver) return respond(403, { error: 'Driver record not found.' });

  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id')
    .eq('assigned_driver_id', driver.id)
    .limit(250);
  if (jobsError) return respond(500, { error: jobsError.message });

  const rows = (jobs ?? []) as JobCompanyRow[];
  const companyIds = [...new Set(rows.map((row) => row.company_id).filter((id): id is string => Boolean(id)))];
  const { data: companies, error: companiesError } = companyIds.length
    ? await supabaseAdmin.from('companies').select('id, name').in('id', companyIds)
    : { data: [], error: null };
  if (companiesError) return respond(500, { error: companiesError.message });

  const byId = new Map(((companies ?? []) as CompanyRow[]).map((row) => [row.id, row.name]));
  return respond(200, {
    members: rows.map((row) => ({
      jobId: row.id,
      companyId: row.company_id,
      name: row.company_id ? byId.get(row.company_id) ?? null : null,
    })),
  });
}
