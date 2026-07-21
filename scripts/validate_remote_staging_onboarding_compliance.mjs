#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const appOrigin = required('STAGING_APP_ORIGIN').replace(/\/$/, '');
const supabaseUrl = required('STAGING_SUPABASE_URL');
const publicKey = required('STAGING_SUPABASE_PUBLIC_KEY');
const secretKey = required('STAGING_SUPABASE_SECRET_KEY');

const service = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const parseResponse = async (response) => {
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { text, payload };
};

const request = async ({ path, method = 'GET', token, body, expected }) => {
  const response = await fetch(`${appOrigin}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const { text, payload } = await parseResponse(response);
  if (expected !== undefined && response.status !== expected) {
    throw new Error(
      `${method} ${path} returned ${response.status}; expected ${expected}. Response: ${text.slice(0, 1600)}`,
    );
  }
  return { status: response.status, payload };
};

const uploadDocument = async ({ token, docType, suffix }) => {
  const form = new FormData();
  form.set('docType', docType);
  const pdf = new Blob([
    `%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\nXDrive staging ${docType} ${suffix}`,
  ], { type: 'application/pdf' });
  form.set('file', pdf, `${docType}-${suffix}.pdf`);

  const response = await fetch(`${appOrigin}/api/onboarding/documents`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  const { text, payload } = await parseResponse(response);
  if (response.status !== 200) {
    throw new Error(`Document upload ${docType} returned ${response.status}. Response: ${text.slice(0, 1600)}`);
  }
  assert(payload?.docType === docType, `Document upload returned the wrong type for ${docType}.`);
  return payload;
};

const createConfirmedUser = async ({ email, password, accountType }) => {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      account_type: accountType,
      requested_role: accountType,
      staging_fixture: true,
    },
    app_metadata: {
      account_type: accountType,
      requested_role: accountType,
      staging_fixture: true,
    },
  });
  if (error || !data.user) {
    throw new Error(`Failed to create ${accountType} auth user: ${error?.message ?? 'unknown error'}`);
  }
  return data.user;
};

const signIn = async ({ email, password }) => {
  const client = createClient(supabaseUrl, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`Failed to sign in ${email}: ${error?.message ?? 'missing session'}`);
  }
  return { token: data.session.access_token };
};

const payloads = {
  customer: ({ email, suffix }) => ({
    full_name: `Staging Customer ${suffix}`,
    contact_email: email,
    contact_phone: '07111000001',
    company_name: `Staging Customer ${suffix}`,
    billing_address: '1 Staging Street, Blackburn, BB1 1AA',
  }),
  broker: ({ email, suffix }) => ({
    company_name: `Staging Broker Ltd ${suffix}`,
    trading_name: `Staging Broker ${suffix}`,
    company_number: `SB${suffix.slice(-6)}`,
    vat_number: `GB${suffix.slice(-9)}`,
    billing_address: '2 Staging Street, Blackburn, BB1 1AB',
    trading_address: '2 Staging Street, Blackburn, BB1 1AB',
    contact_person: `Broker Contact ${suffix}`,
    finance_contact: `Finance Contact ${suffix}`,
    contact_email: email,
    contact_phone: '07111000002',
  }),
  fleet: ({ suffix }) => ({
    legal_company_name: `Staging Fleet Ltd ${suffix}`,
    trading_name: `Staging Fleet ${suffix}`,
    company_number: `SF${suffix.slice(-6)}`,
    vat_number: `GB${suffix.slice(-9)}`,
    registered_address: '3 Staging Street, Blackburn, BB1 1AC',
    trading_address: '3 Staging Street, Blackburn, BB1 1AC',
    contact_person: `Fleet Contact ${suffix}`,
    compliance_contact: `Compliance Contact ${suffix}`,
    transport_contact: `Transport Contact ${suffix}`,
    operator_licence_required: false,
  }),
  'owner-driver': ({ email, suffix }) => ({
    full_name: `Staging Owner Driver ${suffix}`,
    dob: '1990-01-01',
    nationality: 'British',
    address: '4 Staging Street, Blackburn, BB1 1AD',
    phone: '07111000004',
    email,
    right_to_work_status: 'British citizen',
    visa_type: '',
    visa_expiry: '',
    share_code: '',
    settled_status: false,
    pre_settled_status: false,
    cpc_required: false,
    registration: `ST${suffix.slice(-5)}`,
    make: 'Mercedes-Benz',
    model: 'Sprinter',
    payload: '1200 kg',
    dimensions: '4.0m x 2.0m x 1.85m',
  }),
};

const requiredDocuments = {
  customer: [],
  broker: ['company_registration', 'public_liability', 'vat_registration'],
  fleet: ['company_registration', 'public_liability', 'goods_in_transit', 'vehicle_insurance', 'vat_registration'],
  'owner-driver': ['driving_licence', 'proof_of_address', 'insurance', 'right_to_work'],
};

const journeys = [
  { segment: 'customer', accountType: 'customer_shipper', submitStatus: ['approved'] },
  { segment: 'broker', accountType: 'broker_shipper', submitStatus: ['under_review', 'submitted'] },
  { segment: 'fleet', accountType: 'fleet_courier', submitStatus: ['under_review', 'submitted'] },
  { segment: 'owner-driver', accountType: 'owner_driver', submitStatus: ['under_review', 'submitted'] },
];

const assertApproximate48HourExpiry = (value, label) => {
  const expiry = new Date(value).getTime();
  const hours = (expiry - Date.now()) / 3_600_000;
  assert(Number.isFinite(hours) && hours > 47 && hours <= 49, `${label}: token expiry was ${hours.toFixed(2)} hours, not approximately 48.`);
};

const validateInvitationControls = async ({ token, userId, applicationId }) => {
  const { data: original, error: originalError } = await service
    .from('onboarding_applications')
    .select('token_hash, token_expires_at, token_last_sent_at, token_revoked_at')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .single();
  if (originalError) throw new Error(`Invitation fixture read failed: ${originalError.message}`);
  assert(original.token_hash, 'Initial invitation token hash is missing.');
  assertApproximate48HourExpiry(original.token_expires_at, 'Initial invitation');

  const revoked = await request({ path: '/api/onboarding/init', method: 'DELETE', token, expected: 200 });
  assert(revoked.payload?.invitationRevoked === true && revoked.payload?.resumeAllowed === false,
    'Revocation did not disable invitation resume.');

  const passiveInit = await request({ path: '/api/onboarding/init', method: 'POST', token, body: {}, expected: 200 });
  assert(passiveInit.payload?.invitationRevoked === true, 'Passive init cleared the revocation state.');
  assert(passiveInit.payload?.invitationRegenerated === false, 'Passive init regenerated a revoked invitation.');
  assert(passiveInit.payload?.resumeAllowed === false, 'Passive init allowed a revoked invitation to resume.');

  const rateLimited = await request({
    path: '/api/onboarding/init',
    method: 'POST',
    token,
    body: { forceRegenerateToken: true },
    expected: 429,
  });
  assert(Number(rateLimited.payload?.retryAfterSeconds) > 0, 'Invitation resend cooldown did not return retry guidance.');

  const oldSentAt = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { error: cooldownError } = await service
    .from('onboarding_applications')
    .update({ token_last_sent_at: oldSentAt })
    .eq('id', applicationId)
    .eq('user_id', userId);
  if (cooldownError) throw new Error(`Failed to age invitation cooldown fixture: ${cooldownError.message}`);

  const resent = await request({
    path: '/api/onboarding/init',
    method: 'POST',
    token,
    body: { forceRegenerateToken: true },
    expected: 200,
  });
  assert(resent.payload?.invitationResent === true, 'Explicit resend did not report success.');
  assert(resent.payload?.invitationRevoked === false && resent.payload?.resumeAllowed === true,
    'Explicit resend did not restore invitation resume.');
  assertApproximate48HourExpiry(resent.payload?.tokenExpiresAt, 'Resent invitation');

  const { data: refreshed, error: refreshedError } = await service
    .from('onboarding_applications')
    .select('token_hash, token_expires_at, token_revoked_at')
    .eq('id', applicationId)
    .single();
  if (refreshedError) throw new Error(`Resent invitation read failed: ${refreshedError.message}`);
  assert(refreshed.token_hash && refreshed.token_hash !== original.token_hash, 'Resend did not rotate the invitation token.');
  assert(refreshed.token_revoked_at === null, 'Resend did not clear token_revoked_at.');
};

const suffix = `${Date.now()}`;
const password = `Staging!${suffix}Aa`;
const createdUsers = [];
const results = [];
let previousDocumentFixture = null;
const expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

try {
  const unauthorized = await request({ path: '/api/onboarding/init', method: 'POST', body: {}, expected: 401 });
  assert(unauthorized.payload?.error, 'Unauthorized onboarding init did not return an error payload.');

  const adminEmail = `staging.owner.${suffix}@example.test`;
  const adminUser = await createConfirmedUser({ email: adminEmail, password, accountType: 'fleet_courier' });
  createdUsers.push(adminUser.id);

  const { error: ownerProfileError } = await service.from('profiles').upsert({
    user_id: adminUser.id,
    full_name: `Staging Platform Owner ${suffix}`,
    role: 'owner',
    status: 'active',
    is_driver: false,
  }, { onConflict: 'user_id' });
  if (ownerProfileError) throw new Error(`Failed to prepare staging owner profile: ${ownerProfileError.message}`);
  const { token: adminToken } = await signIn({ email: adminEmail, password });

  for (const journey of journeys) {
    const email = `staging.${journey.segment}.${suffix}@example.test`;
    const user = await createConfirmedUser({ email, password, accountType: journey.accountType });
    createdUsers.push(user.id);
    const { token } = await signIn({ email, password });

    const init = await request({ path: '/api/onboarding/init', method: 'POST', token, body: {}, expected: 200 });
    assert(init.payload?.accountType === journey.accountType, `${journey.segment}: incorrect account type from init.`);
    const applicationId = init.payload?.onboardingApplicationId;
    assert(typeof applicationId === 'string', `${journey.segment}: init did not return an application id.`);
    assertApproximate48HourExpiry(init.payload?.tokenExpiresAt, `${journey.segment} invitation`);

    if (journey.segment === 'fleet') {
      await validateInvitationControls({ token, userId: user.id, applicationId });
    }

    const getSession = await request({ path: `/api/onboarding/${journey.segment}/session`, token, expected: 200 });
    assert(getSession.payload?.application?.id === applicationId, `${journey.segment}: session did not resume the same application.`);

    const wrongSegment = journey.segment === 'customer' ? 'broker' : 'customer';
    await request({ path: `/api/onboarding/${wrongSegment}/session`, token, expected: 403 });
    await request({ path: `/api/super-admin/onboarding/${applicationId}/documents`, token, expected: 403 });

    await request({
      path: `/api/onboarding/${journey.segment}/session`,
      method: 'PATCH',
      token,
      body: {
        payload: payloads[journey.segment]({ email, suffix }),
        status: 'in_progress',
        currentStep: 'staging_validation_complete',
        completionPercentage: 100,
      },
      expected: 200,
    });

    const docs = requiredDocuments[journey.segment];
    if (docs.length > 0) {
      const blockedSubmit = await request({
        path: `/api/onboarding/submit/${journey.segment}`,
        method: 'POST',
        token,
        body: {},
        expected: 409,
      });
      assert(Array.isArray(blockedSubmit.payload?.missingDocuments), `${journey.segment}: missing document list was not returned.`);
      assert(docs.every((docType) => blockedSubmit.payload.missingDocuments.includes(docType)),
        `${journey.segment}: submit gate did not report every mandatory document.`);

      for (const docType of docs) {
        await uploadDocument({ token, docType, suffix });
      }
      const replaced = await uploadDocument({ token, docType: docs[0], suffix: `${suffix}-replacement` });
      assert(replaced.replacedExistingDocument === true, `${journey.segment}: repeated upload created a duplicate instead of replacing.`);
    }

    const submitted = await request({
      path: `/api/onboarding/submit/${journey.segment}`,
      method: 'POST',
      token,
      body: {},
      expected: 200,
    });
    assert(journey.submitStatus.includes(submitted.payload?.status),
      `${journey.segment}: unexpected submit status ${submitted.payload?.status}.`);
    const companyId = submitted.payload?.company_id;
    assert(typeof companyId === 'string', `${journey.segment}: submission did not return a company id.`);

    if (journey.accountType === 'owner_driver') {
      const { data: pendingDriver, error: pendingDriverError } = await service
        .from('drivers')
        .select('id, app_access, status')
        .eq('user_id', user.id)
        .single();
      if (pendingDriverError) throw new Error(`owner-driver: failed to read pending driver: ${pendingDriverError.message}`);
      assert(pendingDriver.app_access === false, 'owner-driver: app_access must remain false until super-admin approval.');
    }

    if (submitted.payload?.status !== 'approved') {
      const blockedApproval = await request({
        path: `/api/super-admin/onboarding/${applicationId}`,
        method: 'PATCH',
        token: adminToken,
        body: { action: 'approve', notes: 'Approval must remain blocked until compliance is verified.' },
        expected: 409,
      });
      assert(Array.isArray(blockedApproval.payload?.unverifiedDocuments),
        `${journey.segment}: approval gate did not report unverified documents.`);

      const reviewQueue = await request({
        path: `/api/super-admin/onboarding/${applicationId}/documents`,
        token: adminToken,
        expected: 200,
      });
      const documents = reviewQueue.payload?.documents ?? [];
      assert(documents.length === docs.length, `${journey.segment}: expected ${docs.length} documents, found ${documents.length}.`);
      assert(reviewQueue.payload?.readiness?.uploadReady === true, `${journey.segment}: upload readiness is false after uploads.`);
      assert(reviewQueue.payload?.readiness?.approvalReady === false, `${journey.segment}: approval readiness became true before review.`);
      assert(documents.every((document) => typeof document.signedUrl === 'string' && document.signedUrl.length > 0),
        `${journey.segment}: private document preview URL was not generated.`);

      if (previousDocumentFixture && documents.length > 0) {
        await request({
          path: `/api/super-admin/onboarding/${applicationId}/documents`,
          method: 'PATCH',
          token: adminToken,
          body: {
            kind: previousDocumentFixture.kind,
            documentId: previousDocumentFixture.documentId,
            action: 'approve',
            notes: 'Cross-application document mutation must fail.',
            expiryDate,
          },
          expected: 404,
        });
      }

      for (const document of documents) {
        const reviewed = await request({
          path: `/api/super-admin/onboarding/${applicationId}/documents`,
          method: 'PATCH',
          token: adminToken,
          body: {
            kind: document.kind,
            documentId: document.id,
            action: 'approve',
            notes: 'Automated disposable staging compliance approval.',
            expiryDate,
          },
          expected: 200,
        });
        assert(reviewed.payload?.success === true, `${journey.segment}: document ${document.doc_type} was not approved.`);
      }

      previousDocumentFixture = documents[0]
        ? { kind: documents[0].kind, documentId: documents[0].id }
        : previousDocumentFixture;

      const approvedQueue = await request({
        path: `/api/super-admin/onboarding/${applicationId}/documents`,
        token: adminToken,
        expected: 200,
      });
      assert(approvedQueue.payload?.readiness?.approvalReady === true,
        `${journey.segment}: approval readiness did not become true after document verification.`);
      assert(approvedQueue.payload?.readiness?.expiredDocuments?.length === 0,
        `${journey.segment}: newly approved staging documents were marked expired.`);

      const reviewed = await request({
        path: `/api/super-admin/onboarding/${applicationId}`,
        method: 'PATCH',
        token: adminToken,
        body: { action: 'approve', notes: 'Automated disposable staging validation.' },
        expected: 200,
      });
      assert(reviewed.payload?.status === 'approved', `${journey.segment}: approval did not return approved.`);

      if (documents[0]) {
        await request({
          path: `/api/super-admin/onboarding/${applicationId}/documents`,
          method: 'PATCH',
          token: adminToken,
          body: {
            kind: documents[0].kind,
            documentId: documents[0].id,
            action: 'reject',
            notes: 'Approved evidence must be locked.',
            expiryDate,
          },
          expected: 409,
        });
      }
    }

    const { data: application, error: applicationError } = await service
      .from('onboarding_applications')
      .select('status, company_id, completion_percentage')
      .eq('id', applicationId)
      .single();
    if (applicationError) throw new Error(`${journey.segment}: failed to verify application: ${applicationError.message}`);
    assert(application.status === 'approved', `${journey.segment}: final application status is ${application.status}.`);
    assert(application.company_id === companyId, `${journey.segment}: final company id changed unexpectedly.`);
    assert(application.completion_percentage === 100, `${journey.segment}: completion is not 100.`);

    const { data: membership, error: membershipError } = await service
      .from('company_memberships')
      .select('status, role_in_company')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .single();
    if (membershipError) throw new Error(`${journey.segment}: membership verification failed: ${membershipError.message}`);
    assert(membership.status === 'active', `${journey.segment}: membership is not active.`);

    const { data: company, error: companyError } = await service
      .from('companies')
      .select('status')
      .eq('id', companyId)
      .single();
    if (companyError) throw new Error(`${journey.segment}: company verification failed: ${companyError.message}`);
    assert(company.status === 'active', `${journey.segment}: company is not active after approval.`);

    if (journey.accountType === 'owner_driver') {
      const { data: approvedDriver, error: approvedDriverError } = await service
        .from('drivers')
        .select('app_access, status')
        .eq('user_id', user.id)
        .single();
      if (approvedDriverError) throw new Error(`owner-driver: final driver verification failed: ${approvedDriverError.message}`);
      assert(approvedDriver.app_access === true, 'owner-driver: app_access was not enabled after approval.');
      assert(approvedDriver.status === 'active', 'owner-driver: driver is not active after approval.');
    }

    results.push({
      journey: journey.segment,
      applicationId,
      companyId,
      finalStatus: application.status,
      membershipRole: membership.role_in_company,
      verifiedDocuments: docs.length,
    });
  }

  console.log(JSON.stringify({
    success: true,
    invitationControls: ['48-hour expiry', 'revocation persistence', 'resend cooldown', 'explicit token rotation'],
    complianceControls: ['mandatory upload gate', 'private preview', 'per-document approval', 'approval gate', 'approved evidence lock'],
    isolationControls: ['account-type route isolation', 'owner-only review API', 'cross-application document mutation blocked'],
    results,
  }, null, 2));
} catch (error) {
  console.error(`STAGING_ONBOARDING_COMPLIANCE_VALIDATION_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  console.error(JSON.stringify({ success: false, completed: results, createdUserIds: createdUsers }, null, 2));
  process.exitCode = 1;
}
