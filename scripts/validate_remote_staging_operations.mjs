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

const one = (value) => Array.isArray(value) ? value[0] : value;

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
  return { client, token: data.session.access_token };
};

const insertOne = async (table, row, select = '*') => {
  const { data, error } = await service.from(table).insert(row).select(select).single();
  if (error) throw new Error(`Failed to insert ${table}: ${error.message}`);
  return data;
};

const suffix = `${Date.now()}`;
const password = `StagingOps!${suffix}Aa`;
const buyerEmail = `staging.ops.buyer.${suffix}@example.test`;
const carrierEmail = `staging.ops.carrier.${suffix}@example.test`;
const results = {};

try {
  const unauthorized = await request({
    path: '/api/jobs/create',
    method: 'POST',
    body: {},
    expected: 401,
  });
  assert(unauthorized.payload?.error, 'Unauthenticated job creation did not return an error payload.');

  const buyerUser = await createConfirmedUser({
    email: buyerEmail,
    password,
    accountType: 'customer_shipper',
  });
  const carrierUser = await createConfirmedUser({
    email: carrierEmail,
    password,
    accountType: 'owner_driver',
  });

  const buyerCompany = await insertOne('companies', {
    name: `Staging Operations Buyer ${suffix}`,
    email: buyerEmail,
    address_line1: '10 Staging Buyer Street',
    city: 'Blackburn',
    postcode: 'BB1 1AA',
    country: 'UK',
    status: 'active',
    created_by: buyerUser.id,
  }, 'id,name,status');

  const carrierCompany = await insertOne('companies', {
    name: `Staging Operations Carrier ${suffix}`,
    email: carrierEmail,
    address_line1: '20 Staging Carrier Street',
    city: 'Blackburn',
    postcode: 'BB1 1AB',
    country: 'UK',
    status: 'active',
    created_by: carrierUser.id,
  }, 'id,name,status');

  await insertOne('company_memberships', {
    company_id: buyerCompany.id,
    user_id: buyerUser.id,
    role_in_company: 'owner',
    status: 'active',
  }, 'id');

  await insertOne('company_memberships', {
    company_id: carrierCompany.id,
    user_id: carrierUser.id,
    role_in_company: 'owner',
    status: 'active',
  }, 'id');

  const driver = await insertOne('drivers', {
    company_id: carrierCompany.id,
    user_id: carrierUser.id,
    display_name: `Staging Owner Driver ${suffix}`,
    phone: '07111009999',
    email: carrierEmail,
    status: 'active',
    is_active: true,
    app_access: true,
  }, 'id,company_id,user_id,status,app_access');

  const vehicle = await insertOne('vehicles', {
    company_id: carrierCompany.id,
    assigned_driver_id: driver.id,
    type: 'lwb_van',
    reg_plate: `ST${suffix.slice(-5)}`,
    make: 'Mercedes-Benz',
    model: 'Sprinter',
    payload_kg: 1200,
    pallets_capacity: 4,
    has_tail_lift: false,
    status: 'active',
    is_available: true,
  }, 'id,company_id,assigned_driver_id,status');

  const { token: buyerToken } = await signIn({ email: buyerEmail, password });
  const { token: carrierToken } = await signIn({ email: carrierEmail, password });

  await request({
    path: '/api/driver/mobile/bids',
    method: 'POST',
    token: buyerToken,
    body: { jobId: randomUUID(), amount: 200 },
    expected: 403,
  });

  const pickupAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const deliveryAt = new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString();
  const jobIdempotencyKey = randomUUID();
  const createPayload = {
    idempotencyKey: jobIdempotencyKey,
    companyId: buyerCompany.id,
    mode: 'customer',
    publish: true,
    clientName: `Staging Operations Client ${suffix}`,
    clientEmail: `staging.ops.client.${suffix}@example.test`,
    clientPhone: '07111008888',
    pickupDateTime: pickupAt,
    pickupTimeSlot: '09:00-10:00',
    pickupAddress: '100 Collection Road, Blackburn',
    pickupPostcode: 'BB1 2AA',
    collectionContact: 'Collection Contact',
    collectionPhone: '07111001111',
    deliveryDateTime: deliveryAt,
    deliveryTimeSlot: '15:00-16:00',
    deliveryAddress: '200 Delivery Road, Manchester',
    deliveryPostcode: 'M1 2AA',
    deliveryContact: 'Delivery Contact',
    deliveryPhone: '07111002222',
    vehicleLabel: 'LWB Van',
    cargoLabel: 'Pallets',
    weightKg: 500,
    pallets: 2,
    lengthCm: 240,
    widthCm: 120,
    heightCm: 140,
    cargoValueGbp: 1500,
    customerReference: `OPS-${suffix}`,
    purchaseOrder: `PO-${suffix}`,
    bookingReference: `BOOK-${suffix}`,
    customerPrice: 350,
    targetCarrierCost: 225,
    tailLift: false,
    forklift: true,
    handball: false,
    adr: false,
    temperatureControlled: false,
    fragile: false,
    notes: 'Disposable staging end-to-end operations validation.',
  };

  await request({
    path: '/api/jobs/create',
    method: 'POST',
    token: carrierToken,
    body: createPayload,
    expected: 403,
  });

  const created = await request({
    path: '/api/jobs/create',
    method: 'POST',
    token: buyerToken,
    body: createPayload,
    expected: 201,
  });
  const jobId = created.payload?.job?.id;
  assert(typeof jobId === 'string', 'Job creation did not return a job id.');
  assert(created.payload?.replayed === false, 'First job creation was unexpectedly reported as replayed.');

  const replay = await request({
    path: '/api/jobs/create',
    method: 'POST',
    token: buyerToken,
    body: createPayload,
    expected: 200,
  });
  assert(replay.payload?.job?.id === jobId, 'Idempotent job replay returned a different job.');
  assert(replay.payload?.replayed === true, 'Repeated job creation was not marked as replayed.');

  const bidResponse = await request({
    path: '/api/driver/mobile/bids',
    method: 'POST',
    token: carrierToken,
    body: {
      jobId,
      amount: 225,
      message: 'Staging carrier quote for complete operations validation.',
    },
    expected: 201,
  });
  const bidId = bidResponse.payload?.bidId;
  assert(typeof bidId === 'string', 'Bid submission did not return a bid id.');

  await request({
    path: '/api/driver/mobile/bids',
    method: 'POST',
    token: carrierToken,
    body: { jobId, amount: 230 },
    expected: 409,
  });

  const { data: awardData, error: awardError } = await service.rpc('accept_job_bid_atomic', {
    p_bid_id: bidId,
    p_actor_user_id: buyerUser.id,
  });
  if (awardError) throw new Error(`Bid award RPC failed: ${awardError.message}`);
  const award = one(awardData);
  assert(award?.success === true, `Bid award failed: ${award?.error_message ?? 'unknown error'}`);
  const agreementId = award?.commercial_agreement_id;
  assert(typeof agreementId === 'string', 'Bid award did not create a commercial agreement.');

  const { data: allocatedJob, error: allocatedError } = await service
    .from('jobs')
    .select('id,status,current_status,company_id,awarded_carrier_company_id,assigned_driver_id,creation_idempotency_key')
    .eq('id', jobId)
    .single();
  if (allocatedError) throw new Error(`Failed to verify awarded job: ${allocatedError.message}`);
  assert(allocatedJob.status === 'allocated', `Awarded owner-driver job was not auto-allocated: ${allocatedJob.status}.`);
  assert(allocatedJob.awarded_carrier_company_id === carrierCompany.id, 'Job was awarded to the wrong carrier company.');
  assert(allocatedJob.assigned_driver_id === driver.id, 'Owner-driver was not assigned automatically.');

  const { data: agreement, error: agreementError } = await service
    .from('job_commercial_agreements')
    .select('id,job_id,bid_id,buyer_company_id,supplier_company_id,agreed_amount,currency')
    .eq('id', agreementId)
    .single();
  if (agreementError) throw new Error(`Failed to verify commercial agreement: ${agreementError.message}`);
  assert(agreement.job_id === jobId && agreement.bid_id === bidId, 'Commercial agreement references are incorrect.');
  assert(agreement.buyer_company_id === buyerCompany.id, 'Commercial agreement buyer is incorrect.');
  assert(agreement.supplier_company_id === carrierCompany.id, 'Commercial agreement supplier is incorrect.');
  assert(Number(agreement.agreed_amount) === 225, 'Commercial agreement amount is incorrect.');

  const driverAction = async (action, expected = 200, body) => request({
    path: `/api/driver/mobile/jobs/${jobId}/${action}`,
    method: 'POST',
    token: carrierToken,
    body: body ?? {},
    expected,
  });

  await driverAction('on-my-way-pickup');
  await driverAction('arrived-pickup');

  const loadingPhotoPath = `${jobId}/collection/staging-loading-photo.jpg`;
  const { error: loadingPhotoError } = await service
    .from('jobs')
    .update({ collection_photo_url: loadingPhotoPath, updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.id);
  if (loadingPhotoError) throw new Error(`Failed to persist loading photo path: ${loadingPhotoError.message}`);

  await driverAction('loaded');
  await driverAction('on-my-way-delivery');
  await driverAction('arrived-delivery');
  await driverAction('delivered', 409);

  const podPhotoPath = `${jobId}/delivery/staging-pod-photo.jpg`;
  await driverAction('pod', 200, {
    recipientName: 'Staging Recipient',
    signatureData: 'data:image/png;base64,U1RBR0lOR19TSUdOQVRVUkU=',
    photoUris: [podPhotoPath],
    documentUris: [],
    notes: 'Disposable staging POD validation.',
  });

  await driverAction('delivered');

  const completed = await request({
    path: `/api/admin/jobs/${jobId}/transition`,
    method: 'POST',
    token: carrierToken,
    body: {
      nextStatus: 'completed',
      expectedStatus: 'delivered',
      note: 'Completed by staging operations validation.',
    },
    expected: 200,
  });
  assert(completed.payload?.job?.status === 'completed', 'Operator completion did not return completed status.');

  const invoiceKey = randomUUID();
  const invoiceRequest = {
    idempotency_key: invoiceKey,
    client_name: `Staging Operations Client ${suffix}`,
    client_email: `staging.ops.client.${suffix}@example.test`,
    payment_terms: '14 days',
    service_description: 'Staging marketplace delivery validation',
  };

  const generatedInvoice = await request({
    path: `/api/driver/finance/jobs/${jobId}/generate-invoice`,
    method: 'POST',
    token: carrierToken,
    body: invoiceRequest,
    expected: 201,
  });
  const invoiceId = generatedInvoice.payload?.invoice?.id;
  assert(typeof invoiceId === 'string', 'Invoice generation did not return an invoice id.');

  const invoiceReplay = await request({
    path: `/api/driver/finance/jobs/${jobId}/generate-invoice`,
    method: 'POST',
    token: carrierToken,
    body: invoiceRequest,
    expected: 200,
  });
  assert(invoiceReplay.payload?.invoice?.id === invoiceId, 'Invoice idempotency replay returned a different invoice.');

  const { data: finalJob, error: finalJobError } = await service
    .from('jobs')
    .select('status,current_status,collection_photo_url,delivery_photos,pod_photos,delivery_signature_data,client_signature_name,pod_generated,pod_generated_at,assigned_driver_id,awarded_carrier_company_id')
    .eq('id', jobId)
    .single();
  if (finalJobError) throw new Error(`Failed to verify final job state: ${finalJobError.message}`);
  assert(finalJob.status === 'completed' && finalJob.current_status === 'completed', 'Final job state is not completed.');
  assert(finalJob.collection_photo_url === loadingPhotoPath, 'Loading photo path was not preserved.');
  assert(Array.isArray(finalJob.delivery_photos) && finalJob.delivery_photos.includes(podPhotoPath), 'POD photo was not persisted.');
  assert(Boolean(finalJob.delivery_signature_data), 'POD signature was not persisted.');
  assert(finalJob.client_signature_name === 'Staging Recipient', 'POD recipient was not persisted.');
  assert(finalJob.pod_generated === true, 'POD was not marked generated.');

  const { data: invoice, error: invoiceError } = await service
    .from('invoices')
    .select('id,job_id,company_id,status,payment_status,commercial_agreement_id,buyer_company_id,supplier_company_id,invoice_origin,amount,net_amount,vat_amount,invoice_generation_idempotency_key')
    .eq('id', invoiceId)
    .single();
  if (invoiceError) throw new Error(`Failed to verify generated invoice: ${invoiceError.message}`);
  assert(invoice.job_id === jobId, 'Invoice is linked to the wrong job.');
  assert(invoice.company_id === carrierCompany.id, 'Invoice issuer company is incorrect.');
  assert(invoice.commercial_agreement_id === agreementId, 'Invoice is not linked to the commercial agreement.');
  assert(invoice.buyer_company_id === buyerCompany.id, 'Invoice buyer company is incorrect.');
  assert(invoice.supplier_company_id === carrierCompany.id, 'Invoice supplier company is incorrect.');
  assert(invoice.invoice_origin === 'marketplace', 'Invoice origin is not marketplace.');
  assert(Number(invoice.amount) > 0 && Number(invoice.net_amount) === 225, 'Invoice amount is incorrect.');
  assert(invoice.payment_status === 'unpaid', 'New invoice payment status is not unpaid.');

  const { count: trackingCount, error: trackingError } = await service
    .from('job_tracking_events')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId);
  if (trackingError) throw new Error(`Failed to count tracking events: ${trackingError.message}`);
  assert((trackingCount ?? 0) >= 7, `Expected at least 7 tracking events, found ${trackingCount ?? 0}.`);

  Object.assign(results, {
    success: true,
    buyerCompanyId: buyerCompany.id,
    carrierCompanyId: carrierCompany.id,
    driverId: driver.id,
    vehicleId: vehicle.id,
    jobId,
    bidId,
    commercialAgreementId: agreementId,
    invoiceId,
    finalJobStatus: finalJob.status,
    trackingEventCount: trackingCount,
    validations: [
      'tenant authorization',
      'idempotent job creation',
      'driver quote and duplicate prevention',
      'atomic bid award',
      'owner-driver auto-allocation',
      'immutable commercial agreement linkage',
      'loading photo persistence',
      'canonical pickup and delivery lifecycle',
      'POD-required delivery guard',
      'persistent POD evidence',
      'operator completion',
      'idempotent marketplace invoice generation',
    ],
  });

  console.log(JSON.stringify(results, null, 2));
} catch (error) {
  console.error(`STAGING_OPERATIONS_VALIDATION_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  console.error(JSON.stringify({ success: false, partial: results }, null, 2));
  process.exitCode = 1;
}
