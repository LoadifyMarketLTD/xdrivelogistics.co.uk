import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';
import { getResetPasswordEmailRedirectTo } from '../../../../../lib/authFlow';
import { getFleetDriverInvitationReadiness } from '../../../../../lib/server/fleetDriverInvitations';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });
const ADMIN_ROLES = ['owner', 'admin', 'dispatcher'];

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('review_document'),
    documentId: z.string().uuid(),
    decision: z.enum(['approve', 'reject']),
    expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  }),
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('revoke') }),
  z.object({ action: z.literal('resend') }),
]);

type AdminContext = {
  userId: string;
  invitation: {
    id: string;
    company_id: string;
    driver_id: string;
    user_id: string;
    invited_email: string;
    status: string;
    expires_at: string;
  };
};

const resolveAdminContext = async (request: NextRequest, invitationId: string): Promise<AdminContext | null> => {
  if (!supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data: invitation, error: invitationError } = await supabaseAdmin
    .from('fleet_driver_invitations')
    .select('id, company_id, driver_id, user_id, invited_email, status, expires_at')
    .eq('id', invitationId)
    .maybeSingle();
  if (invitationError || !invitation) return null;

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('id')
    .eq('company_id', invitation.company_id)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .in('role_in_company', ADMIN_ROLES)
    .maybeSingle();
  if (membershipError || !membership) return null;

  return { userId: authData.user.id, invitation };
};

const signedUrl = async (path: string | null) => {
  if (!path || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.storage
    .from('onboarding-documents')
    .createSignedUrl(path, 10 * 60);
  return error ? null : data.signedUrl;
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Server auth is not configured.' });
  const { id } = await params;
  const context = await resolveAdminContext(request, id);
  if (!context) return json(404, { error: 'Invitation not found.' });

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, user_id, display_name, email, phone, status, app_access')
    .eq('id', context.invitation.driver_id)
    .eq('company_id', context.invitation.company_id)
    .maybeSingle();
  if (driverError || !driver) return json(404, { error: 'Driver not found.' });

  const { data: rawDocuments, error: documentError } = await supabaseAdmin
    .from('driver_documents')
    .select('id, driver_id, doc_type, file_path, status, expiry_date, rejection_reason, verified_by, verified_at, created_at')
    .eq('driver_id', driver.id)
    .not('file_path', 'is', null)
    .order('doc_type');
  if (documentError) return json(500, { error: documentError.message });

  const documents = await Promise.all(
    (rawDocuments ?? []).map(async (document) => ({
      ...document,
      signedUrl: await signedUrl(document.file_path),
    })),
  );

  const { data: readiness, error: readinessError } = await getFleetDriverInvitationReadiness(supabaseAdmin, id);
  if (readinessError) return json(500, { error: readinessError });

  return json(200, { invitation: context.invitation, driver, documents, readiness });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Server auth is not configured.' });
  const { id } = await params;
  const context = await resolveAdminContext(request, id);
  if (!context) return json(404, { error: 'Invitation not found.' });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'Invalid invitation review action.' });

  if (parsed.data.action === 'review_document') {
    if (context.invitation.status !== 'accepted') {
      return json(409, { error: 'Documents can only be reviewed after invitation acceptance and before final approval.' });
    }

    const { data: document, error: lookupError } = await supabaseAdmin
      .from('driver_documents')
      .select('id, file_path')
      .eq('id', parsed.data.documentId)
      .eq('driver_id', context.invitation.driver_id)
      .maybeSingle();
    if (lookupError) return json(500, { error: lookupError.message });
    if (!document?.file_path) return json(404, { error: 'Document not found.' });

    const { error: updateError } = await supabaseAdmin
      .from('driver_documents')
      .update({
        status: parsed.data.decision === 'approve' ? 'approved' : 'rejected',
        expiry_date: parsed.data.expiryDate ?? null,
        rejection_reason:
          parsed.data.decision === 'reject' ? parsed.data.notes || 'Document rejected.' : null,
        verified_by: context.userId,
        verified_at: new Date().toISOString(),
      })
      .eq('id', document.id)
      .eq('driver_id', context.invitation.driver_id);
    if (updateError) return json(500, { error: updateError.message });

    const { data: readiness, error: readinessError } = await getFleetDriverInvitationReadiness(supabaseAdmin, id);
    if (readinessError) return json(500, { error: readinessError });
    return json(200, { success: true, documentId: document.id, readiness });
  }

  if (parsed.data.action === 'approve') {
    const { data: readiness, error: readinessError } = await getFleetDriverInvitationReadiness(supabaseAdmin, id);
    if (readinessError || !readiness) return json(500, { error: readinessError ?? 'Readiness unavailable.' });
    if (!readiness.approvalReady) return json(409, { error: 'Fleet driver compliance is incomplete.', readiness });

    const { data, error } = await supabaseAdmin.rpc('approve_fleet_driver_invitation', {
      p_invitation_id: id,
      p_actor_user_id: context.userId,
    });
    if (error) return json(error.code === '23514' ? 409 : 500, { error: error.message });
    return json(200, { success: true, invitation: data });
  }

  if (parsed.data.action === 'revoke') {
    const { data, error } = await supabaseAdmin.rpc('revoke_fleet_driver_invitation', {
      p_invitation_id: id,
      p_actor_user_id: context.userId,
    });
    if (error) return json(error.code === '42501' ? 403 : 500, { error: error.message });
    return json(200, { success: true, invitation: data });
  }

  const { data: rotated, error: rotateError } = await supabaseAdmin.rpc(
    'rotate_fleet_driver_invitation_token',
    {
      p_invitation_id: id,
      p_actor_user_id: context.userId,
      p_force: false,
    },
  );
  const tokenResult = Array.isArray(rotated) ? rotated[0] : rotated;
  if (rotateError || !tokenResult?.raw_token) {
    return json(rotateError?.code === 'P0001' ? 429 : 500, {
      error: rotateError?.message ?? 'Failed to rotate invitation token.',
    });
  }

  await supabaseAdmin
    .from('drivers')
    .update({ status: 'invited', app_access: false, updated_at: new Date().toISOString() })
    .eq('id', context.invitation.driver_id);
  await supabaseAdmin
    .from('company_memberships')
    .update({ status: 'invited', role_in_company: 'driver', updated_at: new Date().toISOString() })
    .eq('company_id', context.invitation.company_id)
    .eq('user_id', context.invitation.user_id);

  const baseRedirect = getResetPasswordEmailRedirectTo().replace(/\?.*$/, '');
  const invitationUrl = `${baseRedirect}?type=fleet-driver-invite&invitation=${encodeURIComponent(
    tokenResult.raw_token,
  )}`;
  const { error: deliveryError } = await supabaseAdmin.auth.resetPasswordForEmail(
    context.invitation.invited_email,
    { redirectTo: invitationUrl },
  );

  return json(deliveryError ? 202 : 200, {
    success: true,
    invitationSent: !deliveryError,
    expiresAt: tokenResult.expires_at,
    deliveryWarning: deliveryError?.message ?? null,
    ...(process.env.XDRIVE_EXPOSE_STAGING_INVITATION_TOKEN === 'true'
      ? { stagingInvitationToken: tokenResult.raw_token }
      : {}),
  });
}
