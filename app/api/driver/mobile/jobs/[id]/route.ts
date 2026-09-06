import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import {
  hasPod,
  isDriverContext,
  jobSelect,
  mapJob,
  MobileJobRow,
  requireDriver,
  respond,
} from '../../_lib';

type JobStopRow = {
  id: string;
  sequence: number;
  stop_type: string | null;
  address: string | null;
  postcode: string | null;
  company_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  window_start: string | null;
  window_end: string | null;
  instructions: string | null;
  status: string | null;
};

function mapStop(stop: JobStopRow) {
  return {
    id: stop.id,
    sequence: Number(stop.sequence),
    type: stop.stop_type || undefined,
    address: [stop.address, stop.postcode].filter(Boolean).join(', ') || 'Stop address TBC',
    company: stop.company_name || undefined,
    contactPerson: stop.contact_name || undefined,
    telephone: stop.contact_phone || undefined,
    timeWindowFrom: stop.window_start || undefined,
    timeWindowTo: stop.window_end || undefined,
    status: stop.status || 'pending',
    notes: stop.instructions || undefined,
  };
}

function legacyStops(job: ReturnType<typeof mapJob>) {
  return [
    {
      sequence: 1,
      type: 'collection',
      address: job.pickupLocation,
      contactPerson: job.contactName,
      telephone: job.contactPhone,
      timeWindowFrom: job.pickupTime,
    },
    {
      sequence: 2,
      type: 'delivery',
      address: job.deliveryLocation,
      contactPerson: job.contactName,
      telephone: job.contactPhone,
      timeWindowFrom: job.deliveryTime,
    },
  ];
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select(jobSelect)
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();

  if (error) return respond(500, { error: error.message });
  if (!data) return respond(404, { error: 'Job not found.' });

  const row = data as unknown as MobileJobRow;
  const mapped = mapJob(row);
  const { data: stopRows, error: stopsError } = await supabaseAdmin
    .from('job_stops')
    .select('id,sequence,stop_type,address,postcode,company_name,contact_name,contact_phone,window_start,window_end,instructions,status')
    .eq('job_id', id)
    .order('sequence', { ascending: true });

  const persistentStops = stopsError
    ? []
    : ((stopRows ?? []) as unknown as JobStopRow[]).map(mapStop);

  const specialInstructions = [
    row.load_details,
    row.special_requirements,
    row.access_restrictions,
  ].filter(Boolean).join('\n');

  return respond(200, {
    job: {
      ...mapped,
      stops: persistentStops.length > 0 ? persistentStops : legacyStops(mapped),
      specialInstructions: specialInstructions || undefined,
      podCompleted: hasPod(row),
    },
    multiDropPartial: Boolean(stopsError),
  });
}
