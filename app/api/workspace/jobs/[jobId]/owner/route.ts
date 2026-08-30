import { NextRequest, NextResponse } from 'next/server';
import { hasOnlyPreExecutionJobStatuses, preferredJobLifecycleStatus } from '../../../../../../lib/jobs/jobLifecycleStatus';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';
import { operationalError } from '../../../_lib/operationalError';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const text = (value: unknown) => typeof value === 'string' ? value : value == null ? null : String(value);

type AdminClient = NonNullable<typeof supabaseAdmin>;
type JobRow = Record<string, unknown>;
type StopRow = Record<string, unknown>;

type OwnerContext = {
  job: JobRow;
  ownerCompanyId: string;
  capabilities: {
    canEdit: boolean;
    canDelete: boolean;
    editReason: string | null;
    deleteReason: string | null;
    bidCount: number;
  };
};

const countRows = async (client: AdminClient, table: string, column: string, jobId: string) => {
  const result = await client.from(table).select('id', { count: 'exact', head: true }).eq(column, jobId);
  return { count: result.count ?? 0, error: result.error };
};

async function authenticate(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return {
      response: operationalError({
        status: 503,
        message: 'Load management is temporarily unavailable.',
        context: 'workspace.job-owner.config',
        retryable: true,
      }),
    };
  }
  const token = getBearerToken(request);
  if (!token) return { response: respond(401, { error: 'Unauthorized.' }) };
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data, error } = await validator.auth.getUser(token);
  if (error || !data.user) return { response: respond(401, { error: 'Unauthorized.' }) };
  return { client: supabaseAdmin, userId: data.user.id };
}

async function getOwnerContext(client: AdminClient, userId: string, jobId: string): Promise<{ context?: OwnerContext; response?: NextResponse }> {
  const { data: rawJob, error: jobError } = await client.from('jobs').select('*').eq('id', jobId).maybeSingle();
  if (jobError) {
    return {
      response: operationalError({
        status: 500,
        message: 'The load could not be checked.',
        context: `workspace.job-owner.job:${jobId}`,
        cause: jobError,
        retryable: true,
      }),
    };
  }
  if (!rawJob) return { response: respond(404, { error: 'Load not found.' }) };

  const job = rawJob as JobRow;
  const ownerCompanyId = text(job.company_id);
  if (!ownerCompanyId) return { response: respond(409, { error: 'The posting company is unavailable for this load.' }) };

  const { data: membership, error: membershipError } = await client
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', ownerCompanyId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('role_in_company', ['owner', 'admin', 'dispatcher'])
    .maybeSingle();
  if (membershipError) {
    return {
      response: operationalError({
        status: 500,
        message: 'Your company access could not be verified.',
        context: `workspace.job-owner.membership:${jobId}`,
        cause: membershipError,
        retryable: true,
      }),
    };
  }
  if (!membership) return { response: respond(403, { error: 'Only the posting company can manage this load.' }) };

  const [stopsResult, bids, agreements, pods, invoices, jobDocuments, legacyDocuments, disputes, cancellations, invoiceDisputes, convertedQuotes, reviews] = await Promise.all([
    client.from('job_stops').select('id, status, arrived_at, completed_at').eq('job_id', jobId),
    countRows(client, 'job_bids', 'job_id', jobId),
    countRows(client, 'job_commercial_agreements', 'job_id', jobId),
    countRows(client, 'proof_of_delivery', 'job_id', jobId),
    countRows(client, 'invoices', 'job_id', jobId),
    countRows(client, 'job_documents', 'job_id', jobId),
    countRows(client, 'documents', 'job_id', jobId),
    countRows(client, 'job_disputes', 'job_id', jobId),
    countRows(client, 'job_cancellation_requests', 'job_id', jobId),
    countRows(client, 'invoice_disputes', 'job_id', jobId),
    countRows(client, 'quotes', 'converted_job_id', jobId),
    countRows(client, 'reviews', 'job_id', jobId),
  ]);

  const dependencyError = [
    stopsResult.error,
    bids.error,
    agreements.error,
    pods.error,
    invoices.error,
    jobDocuments.error,
    legacyDocuments.error,
    disputes.error,
    cancellations.error,
    invoiceDisputes.error,
    convertedQuotes.error,
    reviews.error,
  ].find(Boolean);
  if (dependencyError) {
    return {
      response: operationalError({
        status: 500,
        message: 'The load safety checks could not be completed.',
        context: `workspace.job-owner.dependencies:${jobId}`,
        cause: dependencyError,
        retryable: true,
      }),
    };
  }

  const stops = (stopsResult.data ?? []) as StopRow[];
  const progressedStopCount = stops.filter((stop) => {
    const status = String(stop.status ?? 'pending').toLowerCase();
    return status !== 'pending' || Boolean(stop.arrived_at) || Boolean(stop.completed_at);
  }).length;
  const assigned = Boolean(job.awarded_carrier_company_id || job.assigned_company_id || job.assigned_driver_id || job.vehicle_id);
  const status = preferredJobLifecycleStatus(job);
  const preAwardStatus = hasOnlyPreExecutionJobStatuses(job);
  const bidCount = bids.count;
  const executionArtifacts = agreements.count + pods.count + invoices.count + disputes.count + cancellations.count + invoiceDisputes.count + convertedQuotes.count + reviews.count;

  const editReason = 'Posted load details are locked. Send a Driver message for any change or new instruction.';

  let deleteReason: string | null = null;
  if (assigned) deleteReason = 'This load has already been awarded or allocated and can no longer be deleted by the posting company.';
  else if (!preAwardStatus) deleteReason = `Loads in ${status || 'this'} status cannot be deleted.`;
  else if (bidCount > 0) deleteReason = 'Loads with carrier quote history cannot be deleted.';
  else if (executionArtifacts > 0 || progressedStopCount > 0) deleteReason = 'This load already has protected commercial or execution history.';
  else if (jobDocuments.count > 0 || legacyDocuments.count > 0) deleteReason = 'This load has stored documents and cannot be deleted.';

  return {
    context: {
      job,
      ownerCompanyId,
      capabilities: {
        canEdit: false,
        canDelete: !deleteReason,
        editReason,
        deleteReason,
        bidCount,
      },
    },
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const auth = await authenticate(request);
  if (auth.response || !auth.client || !auth.userId) return auth.response;
  const { jobId } = await params;
  const checked = await getOwnerContext(auth.client, auth.userId, jobId);
  if (checked.response || !checked.context) return checked.response;

  return respond(200, {
    job: {
      id: text(checked.context.job.id),
      reference: `XDL-${String(checked.context.job.id ?? '').slice(0, 8).toUpperCase()}`,
      status: preferredJobLifecycleStatus(checked.context.job) || 'unknown',
      capabilities: checked.context.capabilities,
    },
  });
}

export async function PATCH() {
  return respond(405, {
    error: 'Posted load details are locked. Send a Driver message for any change or new instruction.',
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const auth = await authenticate(request);
  if (auth.response || !auth.client || !auth.userId) return auth.response;
  const client = auth.client;
  const { jobId } = await params;
  const checked = await getOwnerContext(client, auth.userId, jobId);
  if (checked.response || !checked.context) return checked.response;
  if (!checked.context.capabilities.canDelete) {
    return respond(409, { error: checked.context.capabilities.deleteReason ?? 'This load cannot be deleted.' });
  }

  const deleted = await client.rpc('delete_unbid_exchange_job_atomic', {
    p_job_id: jobId,
    p_actor_user_id: auth.userId,
  });
  if (deleted.error) {
    if (deleted.error.code === 'P0002') return respond(404, { error: 'Load not found.' });
    if (deleted.error.code === '42501') return respond(403, { error: deleted.error.message });
    if (deleted.error.code === '23514' || deleted.error.code === '23503') return respond(409, { error: deleted.error.message });
    return operationalError({
      status: 409,
      message: 'This load cannot be deleted because protected records are linked to it.',
      context: `workspace.job-owner.delete:${jobId}`,
      cause: deleted.error,
      retryable: false,
    });
  }

  return respond(200, { deleted: true, jobId });
}
