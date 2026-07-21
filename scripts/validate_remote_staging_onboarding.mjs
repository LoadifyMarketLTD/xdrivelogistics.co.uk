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
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (expected !== undefined && response.status !== expected) {
    throw new Error(
      `${method} ${path} returned ${response.status}; expected ${expected}. Response: ${text.slice(0, 1200)}`,
    );
  }

  return { status: response.status, payload };
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
  return { client, token: data.session.access_token };
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
    registration: `ST${suffix.slice(-5)}`,
    make: 'Mercedes-Benz',
    model: 'Sprinter',
    payload: '1200 kg',
    dimensions: '4.0m x 2.0m x 1.85m',
  }),
};

const journeys = [
  { segment: 'customer', accountType: 'customer_shipper', submitStatus: ['approved'] },
  { segment: 'broker', accountType: 'broker_shipper', submitStatus: ['under_review', 'submitted'] },
  { segment: 'fleet', accountType: 'fleet_courier', submitStatus: ['submitted', 'under_review'] },
  { segment: 'owner-driver', accountType: 'owner_driver', submitStatus: ['submitted', 'under_review'] },
];

const suffix = `${Date.now()}`;
const password = `Staging!${suffix}Aa`;
const createdUsers = [];
const results = [];

try {
  const unauthorized = await request({ path: '/api/onboarding/init', method: 'POST', body: {}, expected: 401 });
  assert(unauthorized.payload?.error, 'Unauthorized onboarding init did not return an error payload.');

  const adminEmail = `staging.owner.${suffix}@example.test`;
  const adminUser = await createConfirmedUser({
    email: adminEmail,
    password,
    accountType: 'fleet_courier',
  });
  createdUsers.push(adminUser.id);

  const { error: ownerProfileError } = await service.from('profiles').upsert(
    {
      user_id: adminUser.id,
      full_name: `Staging Platform Owner ${suffix}`,
      role: 'owner',
      status: 'active',
      is_driver: false,
    },
    { onConflict: 'user_id' },
  );
  if (ownerProfileError) throw new Error(`Failed to prepare staging owner profile: ${ownerProfileError.message}`);

  const { token: adminToken } = await signIn({ email: adminEmail, password });

  for (const journey of journeys) {
    const email = `staging.${journey.segment}.${suffix}@example.test`;
    const user = await createConfirmedUser({ email, password, accountType: journey.accountType });
    createdUsers.push(user.id);
    const { token } = await signIn({ email, password });

    const init = await request({
      path: '/api/onboarding/init',
      method: 'POST',
      token,
      body: {},
      expected: 200,
    });
    assert(init.payload?.accountType === journey.accountType, `${journey.segment}: incorrect account type from init.`);
    const applicationId = init.payload?.onboardingApplicationId;
    assert(typeof applicationId === 'string', `${journey.segment}: init did not return an application id.`);

    const getSession = await request({
      path: `/api/onboarding/${journey.segment}/session`,
      token,
      expected: 200,
    });
    assert(getSession.payload?.application?.id === applicationId, `${journey.segment}: session did not resume the same application.`);

    const wrongSegment = journey.segment === 'customer' ? 'broker' : 'customer';
    await request({
      path: `/api/onboarding/${wrongSegment}/session`,
      token,
      expected: 403,
    });

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

    const submitted = await request({
      path: `/api/onboarding/submit/${journey.segment}`,
      method: 'POST',
      token,
      body: {},
      expected: 200,
    });

    assert(
      journey.submitStatus.includes(submitted.payload?.status),
      `${journey.segment}: unexpected submit status ${submitted.payload?.status}.`,
    );
    const companyId = submitted.payload?.company_id;
    assert(typeof companyId === 'string', `${journey.segment}: submission did not return a company id.`);

    if (journey.accountType === 'owner_driver') {
      const { data: pendingDriver, error: pendingDriverError } = await service
        .from('drivers')
        .select('id, app_access, status')
        .eq('user_id', user.id)
        .single();
      if (pendingDriverError) throw new Error(`owner-driver: failed to read pending driver: ${pendingDriverError.message}`);
      assert(
        pendingDriver.app_access === false,
        'owner-driver: app_access must remain false until super-admin approval.',
      );
    }

    if (submitted.payload?.status !== 'approved') {
      const reviewed = await request({
        path: `/api/super-admin/onboarding/${applicationId}`,
        method: 'PATCH',
        token: adminToken,
        body: { action: 'approve', notes: 'Automated disposable staging validation' },
        expected: 200,
      });
      assert(reviewed.payload?.status === 'approved', `${journey.segment}: approval did not return approved.`);
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
    });
  }

  console.log(JSON.stringify({ success: true, results }, null, 2));
} catch (error) {
  console.error(`STAGING_ONBOARDING_VALIDATION_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  console.error(JSON.stringify({ success: false, completed: results, createdUserIds: createdUsers }, null, 2));
  process.exitCode = 1;
}
