import { NextRequest, NextResponse } from 'next/server';

import {
  isSupabaseAdminConfigured,
  supabaseAdmin,
} from '../../../_lib/supabaseAdmin';
import { isWebDriverContext, requireActiveWebDriver } from '../../_lib/webDriverContext';

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

  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return driver;

  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id')
    .eq('assigned_driver_id', driver.driverId)
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
