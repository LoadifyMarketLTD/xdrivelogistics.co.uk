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

const request = async ({ path, method = 'GET', token, body, expected }) => {
  const response = await fetch(`${appOrigin}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (expected !== undefined && !allowed.includes(response.status)) {
    throw new Error(`${method} ${path} returned ${response.status}; expected ${allowed.join('/')}. Response: ${text.slice(0, 1800)}`);
  }
  return { status: response.status, payload };
};

const uploadDocument = async ({ invitationId, docType, token, suffix }) => {
  const form = new FormData();
  form.set('invitationId', invitationId);
  form.set('docType', docType);
  form.set('file', new Blob([
    `%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\nFleet driver ${docType} ${suffix}`,
  ], { type: 'application/pdf' }), `${docType}-${suffix}.pdf`);

  const response = await fetch(`${appOrigin}/api/driver/invitations/documents`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (response.status !== 200) {
    throw new Error(`Document upload ${docType} returned ${response.status}. Response: ${text.slice(0, 1800)}`);
  }
  return payload;
};

const createUser = async ({ email, password, accountType = 'fleet_courier' }) => {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { account_type: accountType, staging_fixture: true },
    app_metadata: { account_type: accountType, staging_fixture: true },
  });
  if (error || !data.user) throw new Error(`Failed to create ${email}: ${error?.message ?? 'unknown error'}`);
  return data.user;
};

const signIn = async ({ email, password }) => {
  const client = createClient(supabaseUrl, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Failed to sign in ${email}: ${error?.message ?? 'missing session'}`);
  return data.session.access_token;
};

const readDriverState = async ({ driverId, companyId, userId }) => {
  const [{ data: driver, error: driverError }, { data: membership, error: membershipError }, { data: profile, error: profileError }] = await Promise.all([
    service.from('drivers').select('id,status,app_access,company_id,user_id').eq('id', driverId).single(),
    service.from('company_memberships').select('status,role_in_company').eq('company_id', companyId).eq('user_id', userId).single(),
    service.from('profiles').select('status,role,is_driver').eq('user_id', userId).single(),
  ]);
  if (driverError) throw new Error(`Driver state read failed: ${driverError.message}`);
  if (membershipError) throw new Error(`Membership state read failed: ${membershipError.message}`);
  if (profileError) throw new Error(`Profile state read failed: ${profileError.message}`);
  return { driver, membership, profile };
};

const suffix = `${Date.now()}`;
const password = `FleetInvite!${suffix}Aa`;
const ownerEmail = `staging.fleet.owner.${suffix}@example.test`;
const viewerEmail = `staging.fleet.viewer.${suffix}@example.test`;
const outsiderEmail = `staging.fleet.outsider.${suffix}@example.test`;
const driverEmail = `staging.fleet.driver.${suffix}@example.test`;
const createdUsers = [];

try {
  const owner = await createUser({ email: ownerEmail, password });
  const viewer = await createUser({ email: viewerEmail, password });
  const outsider = await createUser({ email: outsiderEmail, password });
  const invitedDriverUser = await createUser({ email: driverEmail, password, accountType: 'driver' });
  createdUsers.push(owner.id, viewer.id, outsider.id, invitedDriverUser.id);

  const { data: company, error: companyError } = await service.from('companies').insert({
    name: `Staging Fleet Invitation Ltd ${suffix}`,
    email: ownerEmail,
    address_line1: '1 Invitation Road',
    city: 'Blackburn',
    postcode: 'BB1 1FI',
    country: 'UK',
    status: 'active',
    created_by: owner.id,
  }).select('id').single();
  if (companyError) throw new Error(`Company creation failed: ${companyError.message}`);

  const { data: ownerMembership, error: ownerMembershipError } = await service.from('company_memberships').insert({
    company_id: company.id,
    user_id: owner.id,
    role_in_company: 'owner',
    status: 'active',
  }).select('id').single();
  if (ownerMembershipError) throw new Error(`Owner membership failed: ${ownerMembershipError.message}`);

  const { error: viewerMembershipError } = await service.from('company_memberships').insert({
    company_id: company.id,
    user_id: viewer.id,
    role_in_company: 'viewer',
    status: 'active',
  });
  if (viewerMembershipError) throw new Error(`Viewer membership failed: ${viewerMembershipError.message}`);

  const ownerToken = await signIn({ email: ownerEmail, password });
  const viewerToken = await signIn({ email: viewerEmail, password });
  const outsiderToken = await signIn({ email: outsiderEmail, password });
  const driverToken = await signIn({ email: driverEmail, password });

  const invitePayload = {
    companyId: company.id,
    membershipId: ownerMembership.id,
    displayName: `Staging Fleet Driver ${suffix}`,
    email: driverEmail,
    phone: '07111009001',
  };

  await request({
    path: '/api/admin/driver-invitations',
    method: 'POST',
    token: viewerToken,
    body: invitePayload,
    expected: 403,
  });
  await request({
    path: '/api/admin/driver-invitations',
    method: 'POST',
    token: outsiderToken,
    body: invitePayload,
    expected: 403,
  });

  const invited = await request({
    path: '/api/admin/driver-invitations',
    method: 'POST',
    token: ownerToken,
    body: invitePayload,
    expected: [201, 202],
  });
  const invitationId = invited.payload?.invitationId;
  const invitationToken = invited.payload?.stagingInvitationToken;
  const driverId = invited.payload?.driver?.id;
  assert(typeof invitationId === 'string', 'Invitation id was not returned.');
  assert(typeof invitationToken === 'string' && invitationToken.length >= 32, 'Staging invitation token was not exposed to the isolated validation lane.');
  assert(typeof driverId === 'string', 'Driver id was not returned.');
  assert(invited.payload?.appAccess === false && invited.payload?.membershipStatus === 'invited', 'Invitation granted access prematurely.');

  const hours = (new Date(invited.payload.expiresAt).getTime() - Date.now()) / 3_600_000;
  assert(hours > 47 && hours <= 49, `Invitation expiry is ${hours.toFixed(2)} hours, not approximately 48.`);

  let state = await readDriverState({ driverId, companyId: company.id, userId: invitedDriverUser.id });
  assert(state.driver.status === 'invited' && state.driver.app_access === false, 'Driver row was active before acceptance.');
  assert(state.membership.status === 'invited' && state.membership.role_in_company === 'driver', 'Membership was active before acceptance.');

  await request({
    path: '/api/driver/mobile/jobs',
    token: driverToken,
    expected: 403,
  });
  await request({
    path: '/api/driver/invitations/accept',
    method: 'POST',
    token: driverToken,
    body: { token: `${invitationToken}wrong` },
    expected: 404,
  });

  const accepted = await request({
    path: '/api/driver/invitations/accept',
    method: 'POST',
    token: driverToken,
    body: { token: invitationToken },
    expected: 200,
  });
  assert(accepted.payload?.accepted === true && accepted.payload?.appAccess === false, 'Acceptance enabled application access prematurely.');
  assert(accepted.payload?.readiness?.missingDocuments?.length === 3, 'Acceptance did not require all fleet driver documents.');

  await request({
    path: `/api/admin/driver-invitations/${invitationId}`,
    method: 'PATCH',
    token: ownerToken,
    body: { action: 'approve' },
    expected: 409,
  });
  await request({
    path: `/api/admin/driver-invitations/${invitationId}`,
    token: outsiderToken,
    expected: 404,
  });

  for (const docType of ['driving_licence', 'proof_of_address', 'right_to_work']) {
    await uploadDocument({ invitationId, docType, token: driverToken, suffix });
  }
  const replacement = await uploadDocument({ invitationId, docType: 'driving_licence', token: driverToken, suffix: `${suffix}-replacement` });
  assert(replacement.replacedExistingDocument === true, 'Repeated fleet driver upload did not replace the existing row.');

  let review = await request({
    path: `/api/admin/driver-invitations/${invitationId}`,
    token: ownerToken,
    expected: 200,
  });
  assert(review.payload?.documents?.length === 3, `Expected 3 uploaded documents, found ${review.payload?.documents?.length}.`);
  assert(review.payload.documents.every((document) => typeof document.signedUrl === 'string' && document.signedUrl.length > 0), 'Private signed document URLs were not generated.');

  const expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const document of review.payload.documents) {
    const result = await request({
      path: `/api/admin/driver-invitations/${invitationId}`,
      method: 'PATCH',
      token: ownerToken,
      body: {
        action: 'review_document',
        documentId: document.id,
        decision: 'approve',
        expiryDate,
        notes: 'Disposable staging fleet driver compliance approval.',
      },
      expected: 200,
    });
    assert(result.payload?.success === true, `Document ${document.doc_type} was not approved.`);
  }

  review = await request({
    path: `/api/admin/driver-invitations/${invitationId}`,
    token: ownerToken,
    expected: 200,
  });
  assert(review.payload?.readiness?.approvalReady === true, 'Fleet driver readiness did not become approval-ready.');

  const approved = await request({
    path: `/api/admin/driver-invitations/${invitationId}`,
    method: 'PATCH',
    token: ownerToken,
    body: { action: 'approve' },
    expected: 200,
  });
  assert(approved.payload?.success === true, 'Final fleet driver approval failed.');

  state = await readDriverState({ driverId, companyId: company.id, userId: invitedDriverUser.id });
  assert(state.driver.status === 'active' && state.driver.app_access === true, 'Approved fleet driver did not receive app access.');
  assert(state.membership.status === 'active' && state.membership.role_in_company === 'driver', 'Approved fleet driver membership is not active.');
  assert(state.profile.status === 'active' && state.profile.is_driver === true, 'Approved fleet driver profile is not active.');

  const replay = await request({
    path: '/api/driver/invitations/accept',
    method: 'POST',
    token: driverToken,
    body: {},
    expected: 200,
  });
  assert(replay.payload?.appAccess === true, 'Approved tokenless resume did not report active access.');

  const revoked = await request({
    path: `/api/admin/driver-invitations/${invitationId}`,
    method: 'PATCH',
    token: ownerToken,
    body: { action: 'revoke' },
    expected: 200,
  });
  assert(revoked.payload?.success === true, 'Invitation revocation failed.');
  state = await readDriverState({ driverId, companyId: company.id, userId: invitedDriverUser.id });
  assert(state.driver.status === 'suspended' && state.driver.app_access === false, 'Revocation did not remove driver access.');
  assert(state.membership.status === 'suspended', 'Revocation did not suspend membership.');

  await request({
    path: '/api/driver/mobile/jobs',
    token: driverToken,
    expected: 403,
  });

  const { error: cooldownAgeError } = await service
    .from('fleet_driver_invitations')
    .update({ last_sent_at: new Date(Date.now() - 2 * 60 * 1000).toISOString() })
    .eq('id', invitationId);
  if (cooldownAgeError) throw new Error(`Failed to age resend cooldown: ${cooldownAgeError.message}`);

  const resent = await request({
    path: `/api/admin/driver-invitations/${invitationId}`,
    method: 'PATCH',
    token: ownerToken,
    body: { action: 'resend' },
    expected: [200, 202],
  });
  const resentToken = resent.payload?.stagingInvitationToken;
  assert(typeof resentToken === 'string' && resentToken !== invitationToken, 'Resend did not rotate the invitation token.');
  state = await readDriverState({ driverId, companyId: company.id, userId: invitedDriverUser.id });
  assert(state.driver.status === 'invited' && state.driver.app_access === false, 'Resend did not restore invited fail-closed state.');
  assert(state.membership.status === 'invited', 'Resend did not restore invited membership state.');

  const { error: expireError } = await service
    .from('fleet_driver_invitations')
    .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
    .eq('id', invitationId);
  if (expireError) throw new Error(`Failed to expire invitation fixture: ${expireError.message}`);

  await request({
    path: '/api/driver/invitations/accept',
    method: 'POST',
    token: driverToken,
    body: { token: resentToken },
    expected: 410,
  });

  const { data: finalInvitation, error: finalInvitationError } = await service
    .from('fleet_driver_invitations')
    .select('status,accepted_at,approved_at,revoked_at,expires_at')
    .eq('id', invitationId)
    .single();
  if (finalInvitationError) throw new Error(`Final invitation read failed: ${finalInvitationError.message}`);
  assert(finalInvitation.status === 'expired', `Final invitation status is ${finalInvitation.status}, not expired.`);

  console.log(JSON.stringify({
    success: true,
    invitationId,
    driverId,
    companyId: company.id,
    validated: [
      'owner-only creation',
      '48-hour expiry',
      'pending membership and no app access',
      'authenticated acceptance',
      'mandatory private document uploads',
      'replacement without duplicates',
      'signed admin preview',
      'atomic approval',
      'tokenless safe resume',
      'revoke',
      'resend token rotation',
      'expired token denial',
    ],
  }, null, 2));
} catch (error) {
  console.error(`STAGING_FLEET_DRIVER_INVITATION_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  console.error(JSON.stringify({ success: false, createdUsers }, null, 2));
  process.exitCode = 1;
}
