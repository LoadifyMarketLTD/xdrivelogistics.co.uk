import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { terminalJobStatus } from '../../../../../../lib/jobs/jobLifecycleStatus';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';
import { operationalError } from '../../../_lib/operationalError';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const instructionSchema = z.object({
  instruction: z.string().trim().min(1, 'Instruction is required.').max(2000, 'Instruction is too long.'),
});

type AdminClient = NonNullable<typeof supabaseAdmin>;

type InstructionContext = {
  job: Record<string, unknown>;
  ownerCompanyId: string;
  ownerCompanyName: string;
  assignedDriverId: string | null;
  canAdd: boolean;
  reason: string | null;
};

const text = (value: unknown) => typeof value === 'string' ? value : value == null ? null : String(value);

async function authenticate(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return {
      response: operationalError({
        status: 503,
        message: 'Driver instructions are temporarily unavailable.',
        context: 'workspace.driver-instructions.config',
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

async function loadContext(client: AdminClient, userId: string, jobId: string): Promise<{ context?: InstructionContext; response?: NextResponse }> {
  const { data: rawJob, error: jobError } = await client
    .from('jobs')
    .select('id, company_id, status, current_status, awarded_carrier_company_id, assigned_company_id, assigned_driver_id, vehicle_id')
    .eq('id', jobId)
    .maybeSingle();
  if (jobError) {
    return {
      response: operationalError({
        status: 500,
        message: 'The load could not be checked.',
        context: `workspace.driver-instructions.job:${jobId}`,
        cause: jobError,
        retryable: true,
      }),
    };
  }
  if (!rawJob) return { response: respond(404, { error: 'Load not found.' }) };

  const job = rawJob as Record<string, unknown>;
  const ownerCompanyId = text(job.company_id);
  if (!ownerCompanyId) return { response: respond(409, { error: 'The posting company is unavailable for this load.' }) };

  const [{ data: membership, error: membershipError }, { data: ownerCompany, error: companyError }] = await Promise.all([
    client
      .from('company_memberships')
      .select('role_in_company')
      .eq('company_id', ownerCompanyId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .in('role_in_company', ['owner', 'admin', 'dispatcher'])
      .maybeSingle(),
    client.from('companies').select('name').eq('id', ownerCompanyId).maybeSingle(),
  ]);
  if (membershipError || companyError) {
    return {
      response: operationalError({
        status: 500,
        message: 'Your posting-company access could not be verified.',
        context: `workspace.driver-instructions.membership:${jobId}`,
        cause: membershipError ?? companyError,
        retryable: true,
      }),
    };
  }
  if (!membership) return { response: respond(403, { error: 'Only the posting company can add Driver instructions.' }) };

  const terminalStatus = terminalJobStatus(job);
  const executionBound = Boolean(
    job.awarded_carrier_company_id
    || job.assigned_company_id
    || job.assigned_driver_id
    || job.vehicle_id
  );

  let reason: string | null = null;
  if (terminalStatus) {
    reason = 'This load is already closed. New Driver instructions can no longer be added.';
  } else if (!executionBound) {
    reason = 'Driver instructions become available after the load has been awarded or allocated. Before award, use Edit Load to update private execution instructions.';
  }

  return {
    context: {
      job,
      ownerCompanyId,
      ownerCompanyName: text(ownerCompany?.name) ?? 'Posting company',
      assignedDriverId: text(job.assigned_driver_id),
      canAdd: !reason,
      reason,
    },
  };
}

async function loadInstructions(client: AdminClient, jobId: string) {
  const { data, error } = await client
    .from('job_tracking_events')
    .select('id, event_time, created_at, user_id, user_name, message, notes, meta')
    .eq('job_id', jobId)
    .eq('event_type', 'driver_instruction_added')
    .order('event_time', { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    instruction: text(row.message) ?? text(row.notes) ?? '',
    createdAt: text(row.event_time) ?? text(row.created_at),
    createdBy: text(row.user_name) ?? 'Posting company',
  })).filter((row) => row.instruction.trim().length > 0);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const auth = await authenticate(request);
  if (auth.response || !auth.client || !auth.userId) return auth.response;
  const { jobId } = await params;
  const checked = await loadContext(auth.client, auth.userId, jobId);
  if (checked.response || !checked.context) return checked.response;

  try {
    const instructions = await loadInstructions(auth.client, jobId);
    return respond(200, {
      canAdd: checked.context.canAdd,
      reason: checked.context.reason,
      assignedDriver: Boolean(checked.context.assignedDriverId),
      instructions,
    });
  } catch (error) {
    return operationalError({
      status: 500,
      message: 'Driver instructions could not be loaded.',
      context: `workspace.driver-instructions.list:${jobId}`,
      cause: error,
      retryable: true,
    });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const auth = await authenticate(request);
  if (auth.response || !auth.client || !auth.userId) return auth.response;
  const client = auth.client;
  const { jobId } = await params;

  const parsed = instructionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond(400, { error: parsed.error.issues[0]?.message ?? 'Instruction is invalid.' });

  // Re-read job state immediately before the append so an award/completion race
  // cannot turn this endpoint into a general-purpose job mutation path.
  const checked = await loadContext(client, auth.userId, jobId);
  if (checked.response || !checked.context) return checked.response;
  if (!checked.context.canAdd) return respond(409, { error: checked.context.reason ?? 'A Driver instruction cannot be added to this load.' });

  const now = new Date().toISOString();
  const instruction = parsed.data.instruction;
  const { data: event, error: eventError } = await client
    .from('job_tracking_events')
    .insert({
      job_id: jobId,
      event_type: 'driver_instruction_added',
      event_time: now,
      user_id: auth.userId,
      created_by: auth.userId,
      user_name: checked.context.ownerCompanyName,
      message: instruction,
      notes: instruction,
      meta: {
        source: 'posting_company',
        visibility: 'execution',
        immutable: true,
        company_id: checked.context.ownerCompanyId,
      },
    })
    .select('id, event_time, created_at, user_name, message, notes')
    .single();
  if (eventError || !event) {
    return operationalError({
      status: 500,
      message: 'The Driver instruction could not be saved.',
      context: `workspace.driver-instructions.append:${jobId}`,
      cause: eventError ?? new Error('Instruction append returned no event.'),
      retryable: true,
    });
  }

  let driverInboxNotified = false;
  if (checked.context.assignedDriverId) {
    const { data: driver, error: driverError } = await client
      .from('drivers')
      .select('user_id')
      .eq('id', checked.context.assignedDriverId)
      .maybeSingle();
    if (!driverError && driver?.user_id) {
      const { error: notificationError } = await client.from('notifications').insert({
        company_id: checked.context.ownerCompanyId,
        user_id: driver.user_id,
        title: `New instruction for XDL-${jobId.slice(0, 8).toUpperCase()}`,
        body: instruction,
        type: 'driver_instruction',
        created_at: now,
      });
      driverInboxNotified = !notificationError;
    }
  }

  return respond(201, {
    instruction: {
      id: String(event.id),
      instruction: text(event.message) ?? text(event.notes) ?? instruction,
      createdAt: text(event.event_time) ?? text(event.created_at) ?? now,
      createdBy: text(event.user_name) ?? checked.context.ownerCompanyName,
    },
    assignedDriver: Boolean(checked.context.assignedDriverId),
    driverInboxNotified,
  });
}
