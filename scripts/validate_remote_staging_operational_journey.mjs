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
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (expected !== undefined && !allowed.includes(response.status)) {
    throw new Error(`${method} ${path} returned ${response.status}; expected ${allowed.join('/')}. Response: ${text.slice(0, 1800)}`);
  }
  return { status: response.status, payload };
};

const createUser = async ({ email, password, accountType }) => {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { account_type: accountType, staging_fixture: true },
    app_metadata: { account_type: accountType, staging_fixture: true },
  });
  if (error || !data.user) throw new Error(`Failed to create ${accountType} user: ${error?.message ?? 'unknown error'}`);
  return data.user;
};

const signIn = async ({ email, password }) => {
  const client = createClient(supabaseUrl, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Failed to sign in ${email}: ${error?.message ?? 'missing session'}`);
  return data.session.access_token;
};

const insertOne = async (table, row, select = '*') => {
  const { data, error } = await service.from(table).insert(row).select(select).single();
  if (error) throw new Error(`Fixture insert failed for ${table}: ${error.message}`);
  return data;
};

const suffix = `${Date.now()}`;
const password = `OperationalJourney!${suffix}Aa`;
const buyerEmail = `staging.journey.buyer.${suffix}@example.test`;
const carrierEmail = `staging.journey.carrier.${suffix}@example.test`;
const createdUsers = [];
const result = {};

try {
  const buyer = await createUser({ email: buyerEmail, password, accountType: 'customer_shipper' });
  const carrier = await createUser({ email: carrierEmail, password, accountType: 'owner_driver' });
  createdUsers.push(buyer.id, carrier.id);

  const buyerCompany = await insertOne('companies', {
    name: `Operational Buyer ${suffix}`,
    email: buyerEmail,
    address_line1: '10 Operational Buyer Road',
    city: 'Blackburn',
    postcode: 'BB1 1OJ',
    country: 'UK',
    status: 'active',
    created_by: buyer.id,
  }, 'id,name');

  const carrierCompany = await insertOne('companies', {
    name: `Operational Carrier ${suffix}`,
    email: carrierEmail,
    address_line1: '20 Operational Carrier Road',
    city: 'Blackburn',
    postcode: 'BB1 1OK',
    country: 'UK',
    status: 'active',
    created_by: carrier.id,
  }, 'id,name');

  for (const [user, company, email, role, isDriver] of [
    [buyer, buyerCompany, buyerEmail, 'owner', false],
    [carrier, carrierCompany, carrierEmail, 'owner', true],
  ]) {
    const { error: profileError } = await service.from('profiles').upsert({
      user_id: user.id,
      full_name: `${company.name} Owner`,
      role,
      status: 'active',
      company_id: company.id,
      is_driver: isDriver,
    }, { onConflict: 'user_id' });
    if (profileError) throw new Error(`Profile fixture failed for ${email}: ${profileError.message}`);

    const { error: membershipError } = await service.from('company_memberships').insert({
      company_id: company.id,
      user_id: user.id,
      invited_email: email,
      role_in_company: 'owner',
      status: 'active',
    });
    if (membershipError) throw new Error(`Membership fixture failed for ${email}: ${membershipError.message}`);
  }

  const application = await insertOne('onboarding_applications', {
    user_id: carrier.id,
    email: carrierEmail,
    account_type: 'owner_driver',
    status: 'approved',
    current_step: 'workspace_unlocked',
    completion_percentage: 100,
    company_id: carrierCompany.id,
    payload: {
      full_name: `Operational Owner Driver ${suffix}`,
      email: carrierEmail,
      right_to_work_status: 'British citizen',
      cpc_required: false,
    },
    submitted_at: new Date().toISOString(),
    reviewed_at: new Date().toISOString(),
  }, 'id,user_id,company_id,status');

  const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const docType of ['driving_licence', 'proof_of_address', 'insurance', 'right_to_work']) {
    await insertOne('driver_identity_documents', {
      onboarding_application_id: application.id,
      doc_type: docType,
      file_path: `${application.id}/${docType}-${suffix}.pdf`,
      upload_status: 'uploaded',
      verification_status: 'verified',
      expiry_date: futureDate,
    }, 'id');
  }

  const driver = await insertOne('drivers', {
    company_id: carrierCompany.id,
    user_id: carrier.id,
    display_name: `Operational Owner Driver ${suffix}`,
    phone: '07111012001',
    email: carrierEmail,
    status: 'active',
    is_active: true,
    app_access: true,
  }, 'id,company_id,user_id,status,app_access');
  assert(driver.status === 'active' && driver.app_access === true, 'Approved owner driver fixture was not activated.');

  const vehicle = await insertOne('vehicles', {
    company_id: carrierCompany.id,
    assigned_driver_id: driver.id,
    type: 'lwb_van',
    reg_plate: `OJ${suffix.slice(-5)}`,
    make: 'Mercedes-Benz',
    model: 'Sprinter',
    payload_kg: 1200,
    pallets_capacity: 4,
    has_tail_lift: false,
    status: 'active',
    is_available: true,
  }, 'id,company_id,assigned_driver_id');

  const buyerToken = await signIn({ email: buyerEmail, password });
  const carrierToken = await signIn({ email: carrierEmail, password });

  await request({ path: '/api/jobs/create', method: 'POST', body: {}, expected: 401 });

  const pickupAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const deliveryAt = new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString();
  const jobKey = randomUUID();
  const jobPayload = {
    idempotencyKey: jobKey,
    companyId: buyerCompany.id,
    mode: 'customer',
    publish: true,
    clientName: `Operational Client ${suffix}`,
    clientEmail: `operational.client.${suffix}@example.test`,
    clientPhone: '07111012002',
    pickupDateTime: pickupAt,
    pickupTimeSlot: '09:00-10:00',
    pickupAddress: '100 Operational Collection Road, Blackburn',
    pickupPostcode: 'BB1 2OJ',
    collectionContact: 'Collection Contact',
    collectionPhone: '07111012003',
    deliveryDateTime: deliveryAt,
    deliveryTimeSlot: '15:00-16:00',
    deliveryAddress: '200 Operational Delivery Road, Manchester',
    deliveryPostcode: 'M1 2OJ',
    deliveryContact: 'Delivery Contact',
    deliveryPhone: '07111012004',
    vehicleLabel: 'LWB Van',
    cargoLabel: 'Pallets',
    weightKg: 500,
    pallets: 2,
    lengthCm: 240,
    widthCm: 120,
    heightCm: 140,
    cargoValueGbp: 1500,
    customerReference: `JOURNEY-${suffix}`,
    purchaseOrder: `PO-JOURNEY-${suffix}`,
    bookingReference: `BOOK-JOURNEY-${suffix}`,
    customerPrice: 350,
    targetCarrierCost: 225,
    tailLift: false,
    forklift: true,
    handball: false,
    adr: false,
    temperatureControlled: false,
    fragile: false,
    notes: 'Authenticated disposable staging job-to-invoice journey.',
  };

  await request({ path: '/api/jobs/create', method: 'POST', token: carrierToken, body: jobPayload, expected: 403 });
  const created = await request({ path: '/api/jobs/create', method: 'POST', token: buyerToken, body: jobPayload, expected: 201 });
  const jobId = created.payload?.job?.id;
  assert(typeof jobId === 'string' && created.payload?.replayed === false, 'Initial job creation failed or was marked replayed.');

  const replay = await request({ path: '/api/jobs/create', method: 'POST', token: buyerToken, body: jobPayload, expected: 200 });
  assert(replay.payload?.job?.id === jobId && replay.payload?.replayed === true, 'Job creation idempotency failed.');

  const bid = await request({
    path: '/api/driver/mobile/bids',
    method: 'POST',
    token: carrierToken,
    body: { jobId, amount: 225, message: 'Authenticated operational journey quote.' },
    expected: 201,
  });
  const bidId = bid.payload?.bidId;
  assert(typeof bidId === 'string', 'Bid submission did not return a bid id.');

  await request({
    path: '/api/driver/mobile/bids',
    method: 'POST',
    token: carrierToken,
    body: { jobId, amount: 230 },
    expected: 409,
  });

  await request({
    path: `/api/customer/bids/${bidId}/award`,
    method: 'POST',
    token: carrierToken,
    body: {},
    expected: 403,
  });

  const awarded = await request({
    path: `/api/customer/bids/${bidId}/award`,
    method: 'POST',
    token: buyerToken,
    body: {},
    expected: 200,
  });
  assert(awarded.payload?.success === true && awarded.payload?.jobId === jobId, 'Authorised API award failed.');
  assert(awarded.payload?.awardedCarrierCompanyId === carrierCompany.id, 'Award API selected the wrong carrier.');
  const agreementId = awarded.payload?.commercialAgreementId;
  assert(typeof agreementId === 'string', 'Award API did not return the immutable commercial agreement id.');

  const { data: awardedJob, error: awardedJobError } = await service
    .from('jobs')
    .select('status,current_status,assigned_driver_id,awarded_carrier_company_id')
    .eq('id', jobId)
    .single();
  if (awardedJobError) throw new Error(`Awarded job verification failed: ${awardedJobError.message}`);
  assert(awardedJob.status === 'allocated', `Awarded owner-driver job status is ${awardedJob.status}, not allocated.`);
  assert(awardedJob.assigned_driver_id === driver.id, 'Approved owner driver was not auto-allocated.');

  const driverAction = (action, expected = 200, body = {}) => request({
    path: `/api/driver/mobile/jobs/${jobId}/${action}`,
    method: 'POST',
    token: carrierToken,
    body,
    expected,
  });

  await driverAction('on-my-way-pickup');
  await driverAction('arrived-pickup');

  const loadingPhotoPath = `${jobId}/collection/authenticated-loading-photo.jpg`;
  const { error: loadingPhotoError } = await service
    .from('jobs')
    .update({ collection_photo_url: loadingPhotoPath, updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.id);
  if (loadingPhotoError) throw new Error(`Loading evidence fixture failed: ${loadingPhotoError.message}`);

  await driverAction('loaded');
  await driverAction('on-my-way-delivery');
  await driverAction('arrived-delivery');
  await driverAction('delivered', 409);

  const podPhotoPath = `${jobId}/delivery/authenticated-pod-photo.jpg`;
  await driverAction('pod', 200, {
    recipientName: 'Authenticated Recipient',
    signatureData: 'data:image/png;base64,QVVUSEVOVElDQVRFRF9TSUdOQVRVUkU=',
    photoUris: [podPhotoPath],
    documentUris: [],
    notes: 'Authenticated disposable staging POD.',
  });
  await driverAction('delivered');

  const completed = await request({
    path: `/api/admin/jobs/${jobId}/transition`,
    method: 'POST',
    token: carrierToken,
    body: {
      nextStatus: 'completed',
      expectedStatus: 'delivered',
      note: 'Completed by authenticated operational journey.',
    },
    expected: 200,
  });
  assert(completed.payload?.job?.status === 'completed', 'Operator completion did not return completed status.');

  const invoiceKey = randomUUID();
  const invoiceBody = {
    idempotency_key: invoiceKey,
    client_name: `Operational Client ${suffix}`,
    client_email: `operational.client.${suffix}@example.test`,
    payment_terms: '14 days',
    service_description: 'Authenticated marketplace delivery journey',
  };
  const generated = await request({
    path: `/api/driver/finance/jobs/${jobId}/generate-invoice`,
    method: 'POST',
    token: carrierToken,
    body: invoiceBody,
    expected: 201,
  });
  const invoiceId = generated.payload?.invoice?.id;
  assert(typeof invoiceId === 'string', 'Invoice generation did not return an invoice id.');

  const invoiceReplay = await request({
    path: `/api/driver/finance/jobs/${jobId}/generate-invoice`,
    method: 'POST',
    token: carrierToken,
    body: invoiceBody,
    expected: 200,
  });
  assert(invoiceReplay.payload?.invoice?.id === invoiceId, 'Invoice generation idempotency failed.');

  const [{ data: finalJob, error: finalJobError }, { data: agreement, error: agreementError }, { data: invoice, error: invoiceError }] = await Promise.all([
    service.from('jobs')
      .select('status,current_status,collection_photo_url,delivery_photos,pod_photos,delivery_signature_data,client_signature_name,pod_generated,pod_generated_at,assigned_driver_id,awarded_carrier_company_id')
      .eq('id', jobId).single(),
    service.from('job_commercial_agreements')
      .select('id,job_id,bid_id,buyer_company_id,supplier_company_id,agreed_amount,currency')
      .eq('id', agreementId).single(),
    service.from('invoices')
      .select('id,job_id,company_id,status,payment_status,commercial_agreement_id,buyer_company_id,supplier_company_id,invoice_origin,amount,net_amount,vat_amount,invoice_generation_idempotency_key')
      .eq('id', invoiceId).single(),
  ]);

  if (finalJobError) throw new Error(`Final job verification failed: ${finalJobError.message}`);
  if (agreementError) throw new Error(`Commercial agreement verification failed: ${agreementError.message}`);
  if (invoiceError) throw new Error(`Invoice verification failed: ${invoiceError.message}`);

  assert(finalJob.status === 'completed' && finalJob.current_status === 'completed', 'Final job is not completed.');
  assert(finalJob.collection_photo_url === loadingPhotoPath, 'Collection evidence was not preserved.');
  assert(Array.isArray(finalJob.delivery_photos) && finalJob.delivery_photos.includes(podPhotoPath), 'POD photo was not persisted.');
  assert(Boolean(finalJob.delivery_signature_data), 'POD signature was not persisted.');
  assert(finalJob.client_signature_name === 'Authenticated Recipient', 'POD recipient was not persisted.');
  assert(finalJob.pod_generated === true && finalJob.pod_generated_at, 'POD generation was not persisted.');

  assert(agreement.job_id === jobId && agreement.bid_id === bidId, 'Agreement references are incorrect.');
  assert(agreement.buyer_company_id === buyerCompany.id && agreement.supplier_company_id === carrierCompany.id, 'Agreement tenant parties are incorrect.');
  assert(Number(agreement.agreed_amount) === 225, 'Agreement amount is incorrect.');

  assert(invoice.job_id === jobId && invoice.company_id === carrierCompany.id, 'Invoice job or issuer is incorrect.');
  assert(invoice.commercial_agreement_id === agreementId, 'Invoice is not linked to the immutable agreement.');
  assert(invoice.buyer_company_id === buyerCompany.id && invoice.supplier_company_id === carrierCompany.id, 'Invoice parties are incorrect.');
  assert(invoice.invoice_origin === 'marketplace', 'Invoice origin is not marketplace.');
  assert(Number(invoice.net_amount) === 225 && Number(invoice.amount) > 0, 'Invoice amount is incorrect.');
  assert(invoice.payment_status === 'unpaid', 'New invoice is not unpaid.');

  const { count: eventCount, error: eventError } = await service
    .from('job_tracking_events')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId);
  if (eventError) throw new Error(`Tracking event count failed: ${eventError.message}`);
  assert((eventCount ?? 0) >= 7, `Expected at least 7 tracking events, found ${eventCount ?? 0}.`);

  Object.assign(result, {
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
    trackingEventCount: eventCount,
    validations: [
      'tenant-authorised job creation',
      'idempotent job posting',
      'authenticated carrier quote and duplicate prevention',
      'customer award through real API',
      'immutable commercial agreement',
      'approved owner-driver auto-allocation',
      'pickup and delivery state machine',
      'POD-required delivery guard',
      'persistent collection and delivery evidence',
      'operator completion',
      'idempotent marketplace invoice generation',
    ],
  });

  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`STAGING_OPERATIONAL_JOURNEY_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  console.error(JSON.stringify({ success: false, createdUsers, partial: result }, null, 2));
  process.exitCode = 1;
}
