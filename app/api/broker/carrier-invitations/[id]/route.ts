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

const patchSchema = z.object({
  action: z.enum(['accept', 'reject']),
});

/**
 * PATCH /api/broker/carrier-invitations/[id]
 *
 * Allows a carrier user to accept or reject a broker invitation addressed
 * to their company (matched by carrier_company_id) or their auth email
 * (matched by carrier_email).
 *
 * On success, inserts a notification_event for the broker so they are
 * informed of the carrier's decision.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Service not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized — missing bearer token.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return json(401, { error: 'Unauthorized — invalid or expired token.' });
  }

  const { id: invitationId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Validation failed.', details: parsed.error.flatten() });
  }

  const { action } = parsed.data;
  const admin = supabaseAdmin;

  // Resolve the caller's company and email
  const { data: membership } = await admin
    .from('company_memberships')
    .select('company_id, role_in_company, status')
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return json(403, { error: 'Active company membership required.' });
  }

  const callerCompanyId = membership.company_id as string;
  const callerEmail = authData.user.email?.toLowerCase() ?? '';

  // Fetch the invitation
  const { data: inv } = await admin
    .from('broker_carrier_invitations')
    .select('id, broker_company_id, carrier_company_id, invited_email, status, invited_by')
    .eq('id', invitationId)
    .maybeSingle();

  if (!inv) return json(404, { error: 'Invitation not found.' });

  // Verify this invitation is addressed to the caller
  const addressedByCompany = inv.carrier_company_id === callerCompanyId;
  const addressedByEmail =
    inv.invited_email !== null &&
    inv.invited_email.toLowerCase() === callerEmail;

  if (!addressedByCompany && !addressedByEmail) {
    return json(403, { error: 'This invitation is not addressed to your company.' });
  }

  if (inv.status !== 'pending') {
    return json(409, { error: `Invitation is already ${inv.status}.` });
  }

  const newStatus = action === 'accept' ? 'accepted' : 'rejected';

  const { error: updateError } = await admin
    .from('broker_carrier_invitations')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', invitationId);

  if (updateError) return json(500, { error: updateError.message });

  // Notify the broker: find admin/owner users of the broker company
  const { data: brokerMembers } = await admin
    .from('company_memberships')
    .select('user_id')
    .eq('company_id', inv.broker_company_id)
    .eq('status', 'active')
    .in('role_in_company', ['owner', 'admin'])
    .limit(5);

  if (brokerMembers && brokerMembers.length > 0) {
    const eventType =
      action === 'accept' ? 'carrier_invitation_accepted' : 'carrier_invitation_rejected';

    const notificationRows = brokerMembers.map((m) => ({
      event_type: eventType,
      entity_type: 'broker_carrier_invitation',
      entity_id: invitationId,
      company_id: inv.broker_company_id,
      recipient_user_id: m.user_id,
      payload: {
        invitation_id: invitationId,
        broker_company_id: inv.broker_company_id,
        carrier_company_id: callerCompanyId,
        carrier_email: inv.invited_email,
        action,
        responded_by: authData.user.id,
      },
    }));

    await admin.from('notification_events').insert(notificationRows);
  }

  // If accepted and invitation was by email only, link carrier_company_id now
  if (action === 'accept' && !inv.carrier_company_id) {
    await admin
      .from('broker_carrier_invitations')
      .update({ carrier_company_id: callerCompanyId })
      .eq('id', invitationId);
  }

  return json(200, { updated: true, status: newStatus, invitationId });
}
