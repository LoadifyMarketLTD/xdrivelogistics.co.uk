import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const resolveObjectPath = (rawPath: string) => {
  const value = rawPath.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, '');

  try {
    const url = new URL(value);
    const marker = '/storage/v1/object/';
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    const parts = url.pathname
      .slice(markerIndex + marker.length)
      .split('/')
      .filter(Boolean);
    const accessMode = parts.shift();
    if (!['sign', 'public', 'authenticated'].includes(accessMode ?? '')) return null;
    const bucket = decodeURIComponent(parts.shift() ?? '');
    if (bucket !== 'onboarding-documents') return null;
    const objectPath = parts.map((part) => decodeURIComponent(part)).join('/');
    return objectPath || null;
  } catch {
    return null;
  }
};

const isCanonicalOnboardingObjectPath = (
  objectPath: string,
  ownerUserId: string,
  onboardingApplicationId: string,
) => {
  const segments = objectPath.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) return false;
  return segments.length >= 3
    && segments[0] === ownerUserId
    && segments[1] === onboardingApplicationId;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Company document service is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized — missing bearer token.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return respond(401, { error: 'Unauthorized — invalid or expired token.' });
  }

  const documentId = request.nextUrl.searchParams.get('id')?.trim();
  if (!documentId) return respond(400, { error: 'Document ID is required.' });

  const { data: document, error: documentError } = await supabaseAdmin
    .from('company_documents')
    .select('id, company_id, onboarding_application_id, file_path')
    .eq('id', documentId)
    .maybeSingle();

  if (documentError) return respond(500, { error: documentError.message });
  if (!document) return respond(404, { error: 'Company document not found.' });

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('id')
    .eq('user_id', authData.user.id)
    .eq('company_id', document.company_id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (membershipError) return respond(500, { error: membershipError.message });
  if (!membership) {
    return respond(403, { error: 'Forbidden — this document is outside your company workspace.' });
  }

  const onboardingApplicationId = String(document.onboarding_application_id ?? '').trim();
  if (!onboardingApplicationId) {
    return respond(404, { error: 'No canonical onboarding source is linked to this company document.' });
  }

  const { data: onboardingApplication, error: onboardingError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, user_id, company_id')
    .eq('id', onboardingApplicationId)
    .maybeSingle();

  if (onboardingError) return respond(500, { error: onboardingError.message });
  if (!onboardingApplication) {
    return respond(404, { error: 'The onboarding source for this company document was not found.' });
  }

  const { data: sourceCompany, error: sourceCompanyError } = await supabaseAdmin
    .from('companies')
    .select('id, created_by')
    .eq('id', document.company_id)
    .maybeSingle();

  if (sourceCompanyError) return respond(500, { error: sourceCompanyError.message });
  if (!sourceCompany) return respond(404, { error: 'Company workspace not found.' });

  const onboardingBelongsToCompany = onboardingApplication.company_id === document.company_id
    || sourceCompany.created_by === onboardingApplication.user_id;
  if (!onboardingBelongsToCompany) {
    return respond(403, { error: 'Forbidden — document onboarding source does not belong to this company.' });
  }

  const objectPath = resolveObjectPath(String(document.file_path ?? ''));
  if (!objectPath) {
    return respond(404, { error: 'No valid stored file is linked to this company document.' });
  }
  if (!isCanonicalOnboardingObjectPath(objectPath, onboardingApplication.user_id, onboardingApplication.id)) {
    return respond(403, { error: 'Forbidden — stored file path does not match the document onboarding source.' });
  }

  const { data: signed, error: signedError } = await supabaseAdmin.storage
    .from('onboarding-documents')
    .createSignedUrl(objectPath, 120);

  if (signedError || !signed?.signedUrl) {
    return respond(500, { error: signedError?.message ?? 'Unable to create a document link.' });
  }

  return respond(200, { signedUrl: signed.signedUrl, expiresIn: 120 });
}
