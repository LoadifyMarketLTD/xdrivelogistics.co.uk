#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

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
      `${method} ${path} returned ${response.status}; expected ${expected}. Response: ${text.slice(0, 1600)}`,
    );
  }

  return { status: response.status, payload };
};

const createConfirmedUser = async ({ email, password, accountType }) => {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { account_type: accountType, staging_fixture: true },
    app_metadata: { account_type: accountType, staging_fixture: true },
  });
  if (error || !data.user) {
    throw new Error(`Failed to create ${accountType} user: ${error?.message ?? 'unknown error'}`);
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
  return data.session.access_token;
};

const insertOne = async (table, row, select = '*') => {
  const { data, error } = await service.from(table).insert(row).select(select).single();
  if (error) throw new Error(`Failed to insert ${table}: ${error.message}`);
  return data;
};

const updateOne = async (table, id, patch, select = '*') => {
  const { data, error } = await service.from(table).update(patch).eq('id', id).select(select).single();
  if (error) throw new Error(`Failed to update ${table}: ${error.message}`);
  return data;
};

const suffix = `${Date.now()}`;
const password = `StagingPermissions!${suffix}Aa`;
const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const createdUserIds = [];

try {
  const identities = {
    owner: { email: `staging.permissions.owner.${suffix}@example.test`, accountType: 'customer_shipper' },
    viewer: { email: `staging.permissions.viewer.${suffix}@example.test`, accountType: 'customer_shipper' },
    outsider: { email: `staging.permissions.outsider.${suffix}@example.test`, accountType: 'customer_shipper' },
    carrier: { email: `staging.permissions.carrier.${suffix}@example.test`, accountType: 'owner_driver' },
    otherDriver: { email: `staging.permissions.other-driver.${suffix}@example.test`, accountType: 'fleet_courier' },
  };

  for (const identity of Object.values(identities)) {
    identity.user = await createConfirmedUser({ ...identity, password });
    identity.token = await signIn({ email: identity.email, password });
    createdUserIds.push(identity.user.id);
  }

  const buyerCompany = await insertOne('companies', {
    name: `Staging Permission Buyer ${suffix}`,
    email: identities.owner.email,
    address_line1: '10 Permission Street',
    city: 'Blackburn',
    postcode: 'BB1 1PA',
    country: 'UK',
    status: 'active',
    created_by: identities.owner.user.id,
  }, 'id,name,status');

  const carrierCompany = await insertOne('companies', {
    name: `Staging Permission Carrier ${suffix}`,
    email: identities.carrier.email,
    address_line1: '20 Permission Street',
    city: 'Blackburn',
    postcode: 'BB1 1PB',
    country: 'UK',
    status: 'active',
    created_by: identities.carrier.user.id,
  }, 'id,name,status');

  const otherCompany = await insertOne('companies', {
    name: `Staging Permission Other Fleet ${suffix}`,
    email: identities.otherDriver.email,
    address_line1: '30 Permission Street',
    city: 'Blackburn',
    postcode: 'BB1 1PC',
    country: 'UK',
    status: 'active',
    created_by: identities.otherDriver.user.id,
  }, 'id,name,status');

  await insertOne('company_memberships', {
    company_id: buyerCompany.id,
    user_id: identities.owner.user.id,
    role_in_company: 'owner',
    status: 'active',
  }, 'id');
  await insertOne('company_memberships', {
    company_id: buyerCompany.id,
    user_id: identities.viewer.user.id,
    role_in_company: 'viewer',
    status: 'active',
  }, 'id');
  await insertOne('company_memberships', {
    company_id: carrierCompany.id,
    user_id: identities.carrier.user.id,
    role_in_company: 'owner',
    status: 'active',
  }, 'id');
  await insertOne('company_memberships', {
    company_id: otherCompany.id,
    user_id: identities.otherDriver.user.id,
    role_in_company: 'driver',
    status: 'active',
  }, 'id');

  const carrierDriver = await insertOne('drivers', {
    company_id: carrierCompany.id,
    user_id: identities.carrier.user.id,
    display_name: `Staging Permission Carrier ${suffix}`,
    phone: '07111007001',
    email: identities.carrier.email,
    status: 'active',
    is_active: true,
    app_access: true,
  }, 'id,company_id,user_id,status,app_access');

  await insertOne('vehicles', {
    company_id: carrierCompany.id,
    assigned_driver_id: carrierDriver.id,
    type: 'lwb_van',
    reg_plate: `PA${suffix.slice(-5)}`,
    make: 'Mercedes-Benz',
    model: 'Sprinter',
    payload_kg: 1200,
    pallets_capacity: 4,
    has_tail_lift: false,
    status: 'active',
    is_available: true,
  }, 'id');

  const otherDriver = await insertOne('drivers', {
    company_id: otherCompany.id,
    user_id: identities.otherDriver.user.id,
    display_name: `Staging Other Driver ${suffix}`,
    phone: '07111007002',
    email: identities.otherDriver.email,
    status: 'active',
    is_active: true,
    app_access: true,
  }, 'id,company_id,user_id,status,app_access');

  const pickupAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const deliveryAt = new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString();
  const createPayload = {
    idempotencyKey: randomUUID(),
    companyId: buyerCompany.id,
    mode: 'customer',
    publish: true,
    clientName: `Permission Matrix Client ${suffix}`,
    clientEmail: `permission.client.${suffix}@example.test`,
    clientPhone: '07111007003',
    pickupDateTime: pickupAt,
    pickupTimeSlot: '09:00-10:00',
    pickupAddress: '100 Permission Collection Road, Blackburn',
    pickupPostcode: 'BB1 2PA',
    collectionContact: 'Collection Contact',
    collectionPhone: '07111007004',
    deliveryDateTime: deliveryAt,
    deliveryTimeSlot: '15:00-16:00',
    deliveryAddress: '200 Permission Delivery Road, Manchester',
    deliveryPostcode: 'M1 2PA',
    deliveryContact: 'Delivery Contact',
    deliveryPhone: '07111007005',
    vehicleLabel: 'LWB Van',
    cargoLabel: 'Pallets',
    weightKg: 500,
    pallets: 2,
    lengthCm: 240,
    widthCm: 120,
    heightCm: 140,
    cargoValueGbp: 1500,
    customerReference: `PERM-${suffix}`,
    purchaseOrder: `PO-PERM-${suffix}`,
    bookingReference: `BOOK-PERM-${suffix}`,
    customerPrice: 350,
    targetCarrierCost: 225,
    tailLift: false,
    forklift: true,
    handball: false,
    adr: false,
    temperatureControlled: false,
    fragile: false,
    notes: 'Disposable staging award and driver permission matrix.',
  };

  const created = await request({
    path: '/api/jobs/create',
    method: 'POST',
    token: identities.owner.token,
    body: createPayload,
    expected: 201,
  });
  const jobId = created.payload?.job?.id;
  assert(typeof jobId === 'string', 'Job creation did not return a job id.');

  const bid = await request({
    path: '/api/driver/mobile/bids',
    method: 'POST',
    token: identities.carrier.token,
    body: { jobId, amount: 225, message: 'Permission matrix carrier quote.' },
    expected: 201,
  });
  const bidId = bid.payload?.bidId;
  assert(typeof bidId === 'string', 'Bid creation did not return a bid id.');

  await request({
    path: `/api/customer/bids/${bidId}/award`,
    method: 'POST',
    token: identities.viewer.token,
    body: {},
    expected: 403,
  });
  await request({
    path: `/api/customer/bids/${bidId}/award`,
    method: 'POST',
    token: identities.outsider.token,
    body: {},
    expected: 403,
  });
  await request({
    path: `/api/customer/bids/${bidId}/award`,
    method: 'POST',
    token: identities.carrier.token,
    body: {},
    expected: 403,
  });

  const awarded = await request({
    path: `/api/customer/bids/${bidId}/award`,
    method: 'POST',
    token: identities.owner.token,
    body: {},
    expected: 200,
  });
  assert(awarded.payload?.success === true, 'Authorised owner award did not succeed.');
  assert(awarded.payload?.jobId === jobId, 'Award response returned the wrong job id.');

  const { data: allocatedJob, error: allocatedError } = await service
    .from('jobs')
    .select('id,status,assigned_driver_id,awarded_carrier_company_id')
    .eq('id', jobId)
    .single();
  if (allocatedError) throw new Error(`Failed to read awarded job: ${allocatedError.message}`);
  assert(allocatedJob.awarded_carrier_company_id === carrierCompany.id, 'Awarded carrier company is incorrect.');
  assert(allocatedJob.assigned_driver_id === carrierDriver.id, 'Approved owner driver was not auto-allocated.');

  await request({
    path: `/api/driver/mobile/jobs/${jobId}/on-my-way-pickup`,
    method: 'POST',
    token: identities.otherDriver.token,
    body: {},
    expected: 404,
  });

  await updateOne('drivers', carrierDriver.id, { app_access: false }, 'id,app_access,status');
  await request({
    path: `/api/driver/mobile/jobs/${jobId}/on-my-way-pickup`,
    method: 'POST',
    token: identities.carrier.token,
    body: {},
    expected: 403,
  });
  await updateOne('drivers', carrierDriver.id, { app_access: true }, 'id,app_access,status');

  await updateOne('drivers', carrierDriver.id, { status: 'suspended' }, 'id,app_access,status');
  await request({
    path: `/api/driver/mobile/jobs/${jobId}/on-my-way-pickup`,
    method: 'POST',
    token: identities.carrier.token,
    body: {},
    expected: 403,
  });
  await updateOne('drivers', carrierDriver.id, { status: 'active', app_access: true }, 'id,app_access,status');

  await request({
    path: `/api/driver/mobile/jobs/${jobId}/on-my-way-pickup`,
    method: 'POST',
    token: identities.carrier.token,
    body: {},
    expected: 200,
  });

  const application = await insertOne('onboarding_applications', {
    user_id: identities.carrier.user.id,
    email: identities.carrier.email,
    account_type: 'owner_driver',
    status: 'approved',
    current_step: 'workspace_unlocked',
    completion_percentage: 100,
    company_id: carrierCompany.id,
    payload: {
      full_name: `Staging Permission Carrier ${suffix}`,
      right_to_work_status: 'British citizen',
      cpc_required: false,
    },
  }, 'id,user_id,status,company_id');

  const documentRows = [];
  for (const docType of ['driving_licence', 'proof_of_address', 'insurance', 'right_to_work']) {
    const document = await insertOne('driver_identity_documents', {
      onboarding_application_id: application.id,
      doc_type: docType,
      file_path: `${application.id}/${docType}-${suffix}.pdf`,
      upload_status: 'uploaded',
      verification_status: 'verified',
      expiry_date: futureDate,
    }, 'id,doc_type,expiry_date');
    documentRows.push(document);
  }

  const { data: compliantDriver, error: compliantDriverError } = await service
    .from('drivers')
    .select('id,app_access,status')
    .eq('id', carrierDriver.id)
    .single();
  if (compliantDriverError) throw new Error(`Failed to read compliant driver: ${compliantDriverError.message}`);
  assert(compliantDriver.app_access === true, 'Verified current documents did not preserve driver access.');

  const licence = documentRows.find((document) => document.doc_type === 'driving_licence');
  await updateOne('driver_identity_documents', licence.id, { expiry_date: expiredDate }, 'id,expiry_date');

  const { data: expiredDriver, error: expiredDriverError } = await service
    .from('drivers')
    .select('id,app_access,status')
    .eq('id', carrierDriver.id)
    .single();
  if (expiredDriverError) throw new Error(`Failed to read expired driver state: ${expiredDriverError.message}`);
  assert(expiredDriver.app_access === false, 'Expired mandatory evidence did not revoke app access.');

  await request({
    path: `/api/driver/mobile/jobs/${jobId}/arrived-pickup`,
    method: 'POST',
    token: identities.carrier.token,
    body: {},
    expected: 403,
  });

  await updateOne('driver_identity_documents', licence.id, { expiry_date: futureDate }, 'id,expiry_date');
  const { data: restoredDriver, error: restoredDriverError } = await service
    .from('drivers')
    .select('id,app_access,status')
    .eq('id', carrierDriver.id)
    .single();
  if (restoredDriverError) throw new Error(`Failed to read restored driver state: ${restoredDriverError.message}`);
  assert(restoredDriver.app_access === true, 'Current verified evidence did not restore app access.');

  await request({
    path: `/api/driver/mobile/jobs/${jobId}/arrived-pickup`,
    method: 'POST',
    token: identities.carrier.token,
    body: {},
    expected: 200,
  });

  console.log(JSON.stringify({
    success: true,
    jobId,
    bidId,
    authorisedAwardRole: 'owner',
    deniedAwardActors: ['viewer', 'unrelated tenant', 'carrier'],
    driverGuards: ['unassigned driver', 'app_access false', 'suspended', 'expired mandatory document'],
    restoredAccessAfterCurrentEvidence: true,
    otherDriverId: otherDriver.id,
  }, null, 2));
} catch (error) {
  console.error(`STAGING_AWARD_PERMISSION_VALIDATION_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  console.error(JSON.stringify({ success: false, createdUserIds }, null, 2));
  process.exitCode = 1;
}
