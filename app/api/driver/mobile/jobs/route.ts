import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, jobSelect, mapJob, MobileJobRow, requireDriver, respond } from '../_lib';

function publicArea(postcode: string | null) {
  const value = String(postcode ?? '').trim().toUpperCase();
  return value ? 'Approx. area \u00B7 ' + value.split(/\s+/)[0] : 'Area disclosed in job details';
}

const scopes: Record<string, string[]> = {
  active: [
    'awarded',
    'allocated',
    'accepted',
    'assigned',
    'on_my_way',
    'on_my_way_pickup',
    'on_my_way_to_pickup',
    'arrived_pickup',
    'on_site_pickup',
    'loaded',
    'collected',
    'in_transit',
    'on_my_way_delivery',
    'on_my_way_to_delivery',
    'arrived_delivery',
    'on_site_delivery',
  ],
  upcoming: ['awarded', 'allocated', 'accepted', 'assigned'],
  completed: ['delivered', 'completed', 'invoiced', 'paid', 'cancelled', 'canceled'],
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope') || 'active';
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 100) || 100, 1), 250);
  const statusList = scopes[scope] ?? scopes.active;
  const statuses = statusList.join(',');
  const completedHistory = scope === 'completed';

  let query = supabaseAdmin
    .from('jobs')
    .select(jobSelect)
    .eq('assigned_driver_id', driver.driverId)
    .order(completedHistory ? 'updated_at' : 'pickup_datetime', { ascending: !completedHistory })
    .limit(limit);

  query = completedHistory
    ? query.or(`current_status.in.(${statuses}),status.in.(${statuses})`)
    : query.or(`current_status.in.(${statuses}),and(current_status.is.null,status.in.(${statuses}))`);

  const { data, error } = await query;
  if (error) return respond(500, { error: error.message });

  const rows = (data ?? []) as unknown as MobileJobRow[];
  const companyIds = Array.from(new Set(rows.map((row) => row.company_id).filter((id): id is string => Boolean(id))));
  const companyById = new Map<string, { name: string | null; xd_id: string | null }>();
  if (companyIds.length > 0) {
    const { data: companies } = await supabaseAdmin
      .from('companies')
      .select('id,name,xd_id')
      .in('id', companyIds);
    for (const company of companies ?? []) {
      companyById.set(String(company.id), { name: company.name ?? null, xd_id: company.xd_id ?? null });
    }
  }

  return respond(200, {
    scope,
    jobs: rows.map((row) => {
      const company = row.company_id ? companyById.get(row.company_id) : undefined;
      const displayRow: MobileJobRow = completedHistory
        ? {
            ...row,
            pickup_location: publicArea(row.pickup_postcode),
            delivery_location: publicArea(row.delivery_postcode),
            collection_contact_name: null,
            collection_contact_phone: null,
            delivery_contact_name: null,
            delivery_contact_phone: null,
            client_name: null,
            client_phone: null,
            load_details: null,
            special_requirements: null,
            access_restrictions: null,
          }
        : row;
      return {
        ...mapJob(displayRow),
        postingCompanyName: company?.name ?? null,
        postingCompanyMemberCode: company?.xd_id ?? null,
      };
    }),
  });
}
