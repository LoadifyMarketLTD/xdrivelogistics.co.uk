import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

const postSchema = z.object({
  carrierEmail: z.string().email().optional(),
  carrierCompanyId: z.string().uuid().optional(),
  message: z.string().max(2000).optional(),
}).refine(
  (data) => data.carrierEmail !== undefined || data.carrierCompanyId !== undefined,
  { message: 'Either carrierEmail or carrierCompanyId must be provided.' }
);

const deleteSchema = z.object({
  invitationId: z.string().uuid(),
});

const resolveCallerCompany = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { error: json(503, { error: 'Service not configured.' }) };
  }
  const token = getBearerToken(request);
  if (!token) return { error: json(401, { error: 'Unauthorized — missing bearer token.' }) };

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return { error: json(401, { error: 'Unauthorized — invalid or expired token.' }) };
  }

  const { data: membership } = await supabaseAdmin
    .from('company_memberships')
    .select('company_id, role_in_company, status')
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return { error: json(403, { error: 'Active company membership required.' }) };
  }

  const managerRoles = ['owner', 'admin', 'company_admin', 'admin_staff', 'company'];
  const canManage = managerRoles.includes(membership.role_in_company);

  return { user: authData.user, companyId: membership.company_id as string, canManage };
};

export async function GET(request: NextRequest) {
  const resolved = await resolveCallerCompany(request);
  if ('error' in resolved) return resolved.error;
  const { companyId } = resolved;
  const admin = supabaseAdmin!;

  const { data: rows, error } = await admin
    .from('broker_carrier_invitations')
    .select('id, invited_email, carrier_company_id, status, message, created_at, updated_at')
    .eq('broker_company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return json(500, { error: error.message });

  // Enrich with company names where available
  const companyIds = (rows ?? [])
    .map((row) => row.carrier_company_id)
    .filter((id): id is string => typeof id === 'string');

  const nameMap = new Map<string, string>();
  if (companyIds.length > 0) {
    const { data: companies } = await admin
      .from('companies')
      .select('id, name')
      .in('id', companyIds);
    for (const company of companies ?? []) {
      nameMap.set(company.id, company.name);
    }
  }

  return json(200, {
    invitations: (rows ?? []).map((row) => ({
      ...row,
      carrierCompanyName: row.carrier_company_id ? (nameMap.get(row.carrier_company_id) ?? null) : null,
    })),
    canManage: resolved.canManage,
  });
}

export async function POST(request: NextRequest) {
  const resolved = await resolveCallerCompany(request);
  if ('error' in resolved) return resolved.error;
  const { user, companyId, canManage } = resolved;

  if (!canManage) {
    return json(403, { error: 'Admin or owner role required to invite carriers.' });
  }

  const admin = supabaseAdmin!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Validation failed.', details: parsed.error.flatten() });
  }

  const { carrierEmail, carrierCompanyId, message } = parsed.data;

  // Check for duplicate pending invitation
  const { data: existing } = await admin
    .from('broker_carrier_invitations')
    .select('id, status')
    .eq('broker_company_id', companyId)
    .eq('status', 'pending')
    .or(
      [
        carrierEmail ? `invited_email.eq.${carrierEmail}` : null,
        carrierCompanyId ? `carrier_company_id.eq.${carrierCompanyId}` : null,
      ]
        .filter(Boolean)
        .join(',')
    )
    .limit(1)
    .maybeSingle();

  if (existing) {
    return json(409, { error: 'An active invitation already exists for this carrier.' });
  }

  const { data: inserted, error: insertError } = await admin
    .from('broker_carrier_invitations')
    .insert({
      broker_company_id: companyId,
      invited_email: carrierEmail ?? null,
      carrier_company_id: carrierCompanyId ?? null,
      status: 'pending',
      message: message ?? null,
      invited_by: user.id,
    })
    .select('id, invited_email, carrier_company_id, status, message, created_at')
    .maybeSingle();

  if (insertError) return json(500, { error: insertError.message });

  // Notify the carrier if they are already a platform user.
  // Use profiles.user_id joined via company_memberships to find the carrier's user by email.
  // This is fire-and-forget: notification failure must not block the invitation response.
  if (carrierEmail && inserted?.id) {
    const invId = inserted.id;
    void (async () => {
      try {
        // Supabase admin does not expose getUserByEmail; query profiles via auth email
        // match through company_memberships invited_email as a best-effort lookup.
        // Fall back to a broadcast notification (recipient_user_id = null) so the
        // edge function can resolve the recipient from the payload email.
        await admin.from('notification_events').insert({
          event_type: 'carrier_invitation_received',
          entity_type: 'broker_carrier_invitation',
          entity_id: invId,
          company_id: companyId,
          recipient_user_id: null,
          payload: {
            invitation_id: invId,
            broker_company_id: companyId,
            carrier_email: carrierEmail,
            message: message ?? null,
          },
        });
      } catch {
        // Non-critical: notification failure must not block the invitation response
      }
    })();
  }

  return json(201, { invitation: inserted });
}

export async function DELETE(request: NextRequest) {
  const resolved = await resolveCallerCompany(request);
  if ('error' in resolved) return resolved.error;
  const { companyId, canManage } = resolved;

  if (!canManage) {
    return json(403, { error: 'Admin or owner role required to revoke carrier invitations.' });
  }

  const admin = supabaseAdmin!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Validation failed.', details: parsed.error.flatten() });
  }

  const { invitationId } = parsed.data;

  // Verify ownership
  const { data: inv } = await admin
    .from('broker_carrier_invitations')
    .select('id, broker_company_id, status')
    .eq('id', invitationId)
    .maybeSingle();

  if (!inv) return json(404, { error: 'Invitation not found.' });
  if (inv.broker_company_id !== companyId) {
    return json(403, { error: 'Access denied — invitation does not belong to your company.' });
  }

  const { error: updateError } = await admin
    .from('broker_carrier_invitations')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', invitationId);

  if (updateError) return json(500, { error: updateError.message });

  return json(200, { revoked: true, invitationId });
}
