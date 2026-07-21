import type { SupabaseClient } from '@supabase/supabase-js';

export const FLEET_DRIVER_REQUIRED_DOCUMENTS = [
  'driving_licence',
  'proof_of_address',
  'right_to_work',
] as const;

export type FleetDriverRequiredDocument = (typeof FLEET_DRIVER_REQUIRED_DOCUMENTS)[number];

export const normalizeFleetDriverEmail = (value: string) => value.trim().toLowerCase();

export const hashFleetDriverInvitationToken = async (token: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export type FleetDriverInvitationReadiness = {
  invitationId: string;
  status: string;
  accepted: boolean;
  expired: boolean;
  requiredDocuments: readonly string[];
  uploadedDocuments: string[];
  approvedDocuments: string[];
  missingDocuments: string[];
  unapprovedDocuments: string[];
  expiredDocuments: string[];
  approvalReady: boolean;
};

export const getFleetDriverInvitationReadiness = async (
  client: SupabaseClient,
  invitationId: string,
): Promise<{ data: FleetDriverInvitationReadiness | null; error: string | null }> => {
  const { data: invitation, error: invitationError } = await client
    .from('fleet_driver_invitations')
    .select('id, driver_id, status, expires_at, accepted_at')
    .eq('id', invitationId)
    .maybeSingle();

  if (invitationError) return { data: null, error: invitationError.message };
  if (!invitation) return { data: null, error: 'Fleet driver invitation not found.' };

  const { data: documents, error: documentsError } = await client
    .from('driver_documents')
    .select('doc_type, file_path, status, expiry_date')
    .eq('driver_id', invitation.driver_id);

  if (documentsError) return { data: null, error: documentsError.message };

  const today = new Date().toISOString().slice(0, 10);
  const byType = new Map(
    (documents ?? []).map((document) => [String(document.doc_type), document]),
  );

  const uploadedDocuments = FLEET_DRIVER_REQUIRED_DOCUMENTS.filter((docType) => {
    const document = byType.get(docType);
    return Boolean(document?.file_path);
  });
  const approvedDocuments = FLEET_DRIVER_REQUIRED_DOCUMENTS.filter((docType) => {
    const document = byType.get(docType);
    return Boolean(
      document?.file_path &&
      document?.status === 'approved' &&
      (!document.expiry_date || String(document.expiry_date) >= today),
    );
  });
  const missingDocuments = FLEET_DRIVER_REQUIRED_DOCUMENTS.filter(
    (docType) => !uploadedDocuments.includes(docType),
  );
  const expiredDocuments = FLEET_DRIVER_REQUIRED_DOCUMENTS.filter((docType) => {
    const expiry = byType.get(docType)?.expiry_date;
    return Boolean(expiry && String(expiry) < today);
  });
  const unapprovedDocuments = FLEET_DRIVER_REQUIRED_DOCUMENTS.filter((docType) => {
    const document = byType.get(docType);
    return Boolean(document?.file_path) && !approvedDocuments.includes(docType);
  });
  const expiresAt = new Date(String(invitation.expires_at)).getTime();
  const expired = Number.isFinite(expiresAt) && expiresAt < Date.now() && invitation.status === 'invited';
  const accepted = Boolean(invitation.accepted_at) && ['accepted', 'approved'].includes(String(invitation.status));

  return {
    data: {
      invitationId: invitation.id,
      status: String(invitation.status),
      accepted,
      expired,
      requiredDocuments: FLEET_DRIVER_REQUIRED_DOCUMENTS,
      uploadedDocuments: [...uploadedDocuments],
      approvedDocuments: [...approvedDocuments],
      missingDocuments: [...missingDocuments],
      unapprovedDocuments: [...unapprovedDocuments],
      expiredDocuments: [...expiredDocuments],
      approvalReady:
        accepted &&
        !expired &&
        missingDocuments.length === 0 &&
        unapprovedDocuments.length === 0 &&
        expiredDocuments.length === 0,
    },
    error: null,
  };
};
