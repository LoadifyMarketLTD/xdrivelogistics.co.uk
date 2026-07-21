#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const supabaseUrl = required('STAGING_SUPABASE_URL');
const publicKey = required('STAGING_SUPABASE_PUBLIC_KEY');
const secretKey = required('STAGING_SUPABASE_SECRET_KEY');

const service = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const createUser = async ({ email, password }) => {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: email.split('@')[0], staging_fixture: true },
    app_metadata: { staging_fixture: true },
  });
  if (error || !data.user) throw new Error(`Failed to create ${email}: ${error?.message ?? 'unknown error'}`);
  return data.user;
};

const authenticatedClient = async ({ email, password }) => {
  const client = createClient(supabaseUrl, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Failed to sign in ${email}: ${error?.message ?? 'missing session'}`);
  return client;
};

const insertOne = async (table, row, select = '*') => {
  const { data, error } = await service.from(table).insert(row).select(select).single();
  if (error) throw new Error(`Fixture insert failed for ${table}: ${error.message}`);
  return data;
};

const assertVisible = async (client, table, id, label) => {
  const { data, error } = await client.from(table).select('id').eq('id', id);
  if (error) throw new Error(`${label}: own-row SELECT failed: ${error.message}`);
  assert(Array.isArray(data) && data.length === 1, `${label}: own row was not visible.`);
};

const assertHidden = async (client, table, id, label) => {
  const { data, error } = await client.from(table).select('id').eq('id', id);
  if (error) throw new Error(`${label}: foreign-row SELECT returned an API error instead of an empty RLS result: ${error.message}`);
  assert(Array.isArray(data) && data.length === 0, `${label}: foreign row leaked through SELECT.`);
};

const assertUpdateHidden = async (client, table, id, patch, label) => {
  const { data, error } = await client.from(table).update(patch).eq('id', id).select('id');
  if (error) {
    // An explicit RLS denial is also fail-closed.
    assert(['42501', 'PGRST301'].includes(error.code) || /row-level security|permission/i.test(error.message),
      `${label}: foreign UPDATE failed for an unexpected reason: ${error.message}`);
    return;
  }
  assert(Array.isArray(data) && data.length === 0, `${label}: foreign UPDATE modified or returned a protected row.`);
};

const assertDeleteHidden = async (client, table, id, label) => {
  const { data, error } = await client.from(table).delete().eq('id', id).select('id');
  if (error) {
    assert(['42501', 'PGRST301'].includes(error.code) || /row-level security|permission/i.test(error.message),
      `${label}: foreign DELETE failed for an unexpected reason: ${error.message}`);
    return;
  }
  assert(Array.isArray(data) && data.length === 0, `${label}: foreign DELETE removed or returned a protected row.`);
};

const assertInsertDenied = async (client, table, row, label) => {
  const { data, error } = await client.from(table).insert(row).select('id');
  assert(Boolean(error) || !Array.isArray(data) || data.length === 0, `${label}: foreign INSERT succeeded.`);
  if (error) {
    assert(
      ['42501', '23503', '23514', 'PGRST301'].includes(error.code) ||
        /row-level security|permission|forbidden|violates|not approved|cannot/i.test(error.message),
      `${label}: foreign INSERT failed for an unexpected reason: ${error.message}`,
    );
  }
};

const suffix = `${Date.now()}`;
const password = `TenantIsolation!${suffix}Aa`;
const emailA = `staging.tenant.a.${suffix}@example.test`;
const emailB = `staging.tenant.b.${suffix}@example.test`;
const createdUsers = [];
const results = [];

try {
  const userA = await createUser({ email: emailA, password });
  const userB = await createUser({ email: emailB, password });
  createdUsers.push(userA.id, userB.id);

  const companyA = await insertOne('companies', {
    name: `Tenant A ${suffix}`,
    email: emailA,
    address_line1: '1 Tenant A Road',
    city: 'Blackburn',
    postcode: 'BB1 1TA',
    country: 'UK',
    status: 'active',
    created_by: userA.id,
  }, 'id,name');
  const companyB = await insertOne('companies', {
    name: `Tenant B ${suffix}`,
    email: emailB,
    address_line1: '1 Tenant B Road',
    city: 'Manchester',
    postcode: 'M1 1TB',
    country: 'UK',
    status: 'active',
    created_by: userB.id,
  }, 'id,name');

  for (const [user, company, email] of [[userA, companyA, emailA], [userB, companyB, emailB]]) {
    const { error: profileError } = await service.from('profiles').upsert({
      user_id: user.id,
      full_name: `Tenant Owner ${company.name}`,
      role: 'owner',
      status: 'active',
      company_id: company.id,
      is_driver: false,
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

  const driverA = await insertOne('drivers', {
    company_id: companyA.id,
    user_id: null,
    display_name: `Tenant A Driver ${suffix}`,
    email: `driver.a.${suffix}@example.test`,
    phone: '07111010001',
    status: 'invited',
    app_access: false,
  }, 'id,company_id');

  const vehicleA = await insertOne('vehicles', {
    company_id: companyA.id,
    assigned_driver_id: driverA.id,
    type: 'lwb_van',
    reg_plate: `TA${suffix.slice(-5)}`,
    make: 'Mercedes-Benz',
    model: 'Sprinter',
    payload_kg: 1200,
    pallets_capacity: 4,
    has_tail_lift: false,
  }, 'id,company_id');

  const driverDocumentA = await insertOne('driver_documents', {
    driver_id: driverA.id,
    doc_type: 'driving_licence',
    file_path: `tenant-a/${driverA.id}/licence.pdf`,
    status: 'pending',
  }, 'id,driver_id');

  const vehicleDocumentA = await insertOne('vehicle_documents', {
    vehicle_id: vehicleA.id,
    doc_type: 'insurance',
    file_path: `tenant-a/${vehicleA.id}/insurance.pdf`,
    status: 'pending',
  }, 'id,vehicle_id');

  const jobA = await insertOne('jobs', {
    company_id: companyA.id,
    created_by: userA.id,
    status: 'draft',
    exchange_visibility: 'private',
    pickup_location: 'Tenant A Collection',
    pickup_postcode: 'BB1 1AA',
    delivery_location: 'Tenant A Delivery',
    delivery_postcode: 'M1 1AA',
    pickup_datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    delivery_datetime: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(),
    vehicle_type: 'lwb_van',
    cargo_type: 'pallets',
    budget_amount: 250,
  }, 'id,company_id');

  const bidA = await insertOne('job_bids', {
    job_id: jobA.id,
    company_id: companyA.id,
    bidder_user_id: userA.id,
    amount: 200,
    bid_price_gbp: 200,
    currency: 'GBP',
    message: 'Tenant A private withdrawn bid',
    status: 'withdrawn',
  }, 'id,job_id,company_id');

  const jobDocumentA = await insertOne('job_documents', {
    job_id: jobA.id,
    uploaded_by: userA.id,
    doc_type: 'pod',
    file_path: `tenant-a/${jobA.id}/pod.pdf`,
  }, 'id,job_id');

  const trackingEventA = await insertOne('job_tracking_events', {
    job_id: jobA.id,
    created_by: userA.id,
    event_type: 'status_change',
    message: 'Tenant A private tracking event',
    meta: { staging_fixture: true },
  }, 'id,job_id');

  const documentA = await insertOne('documents', {
    company_id: companyA.id,
    job_id: jobA.id,
    driver_id: driverA.id,
    doc_type: 'pod',
    file_path: `tenant-a/${jobA.id}/general-pod.pdf`,
    created_by: userA.id,
  }, 'id,company_id');

  const invoiceA = await insertOne('invoices', {
    company_id: companyA.id,
    created_by: userA.id,
    invoice_number: `TEN-A-${suffix}`,
    job_ref: `TEN-A-JOB-${suffix}`,
    job_id: jobA.id,
    due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    status: 'Pending',
    client_name: 'Tenant A Client',
    client_email: emailA,
    amount: 300,
    net_amount: 250,
    vat_amount: 50,
    vat_rate: 20,
    currency: 'GBP',
  }, 'id,company_id');

  const paymentA = await insertOne('payments', {
    company_id: companyA.id,
    invoice_id: invoiceA.id,
    amount: 100,
    currency: 'GBP',
    status: 'pending',
    provider: 'staging',
    provider_ref: `tenant-a-${suffix}`,
  }, 'id,company_id');

  const messageA = await insertOne('messages', {
    company_id: companyA.id,
    conversation_id: randomUUID(),
    sender_user_id: userA.id,
    recipient_user_id: userA.id,
    body: `Tenant A private message ${suffix}`,
  }, 'id,company_id');

  const clientA = await authenticatedClient({ email: emailA, password });
  const clientB = await authenticatedClient({ email: emailB, password });

  const fixtures = [
    ['companies', companyA.id, { name: `Leaked ${suffix}` }],
    ['drivers', driverA.id, { display_name: `Leaked ${suffix}` }],
    ['vehicles', vehicleA.id, { make: `Leaked ${suffix}` }],
    ['driver_documents', driverDocumentA.id, { status: 'approved' }],
    ['vehicle_documents', vehicleDocumentA.id, { status: 'approved' }],
    ['jobs', jobA.id, { load_details: `Leaked ${suffix}` }],
    ['job_bids', bidA.id, { message: `Leaked ${suffix}` }],
    ['job_documents', jobDocumentA.id, { file_path: `leaked/${suffix}.pdf` }],
    ['job_tracking_events', trackingEventA.id, { message: `Leaked ${suffix}` }],
    ['documents', documentA.id, { file_path: `leaked/${suffix}.pdf` }],
    ['invoices', invoiceA.id, { client_name: `Leaked ${suffix}` }],
    ['payments', paymentA.id, { provider_ref: `leaked-${suffix}` }],
    ['messages', messageA.id, { body: `Leaked ${suffix}` }],
  ];

  for (const [table, id, patch] of fixtures) {
    await assertVisible(clientA, table, id, table);
    await assertHidden(clientB, table, id, table);
    await assertUpdateHidden(clientB, table, id, patch, table);
    await assertDeleteHidden(clientB, table, id, table);
    results.push({ table, ownRead: 'allowed', foreignRead: 'hidden', foreignUpdate: 'denied', foreignDelete: 'denied' });
  }

  await assertInsertDenied(clientB, 'drivers', {
    company_id: companyA.id,
    display_name: 'Cross-tenant driver',
    status: 'invited',
    app_access: false,
  }, 'drivers');
  await assertInsertDenied(clientB, 'vehicles', {
    company_id: companyA.id,
    type: 'lwb_van',
    reg_plate: `XB${suffix.slice(-5)}`,
  }, 'vehicles');
  await assertInsertDenied(clientB, 'jobs', {
    company_id: companyA.id,
    created_by: userB.id,
    status: 'draft',
    exchange_visibility: 'private',
    pickup_location: 'Cross tenant pickup',
    delivery_location: 'Cross tenant delivery',
  }, 'jobs');
  await assertInsertDenied(clientB, 'documents', {
    company_id: companyA.id,
    job_id: jobA.id,
    doc_type: 'other',
    file_path: `cross-tenant/${suffix}.pdf`,
    created_by: userB.id,
  }, 'documents');
  await assertInsertDenied(clientB, 'invoices', {
    company_id: companyA.id,
    created_by: userB.id,
    invoice_number: `CROSS-${suffix}`,
    job_ref: `CROSS-${suffix}`,
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    client_name: 'Cross Tenant',
    amount: 1,
    net_amount: 1,
    vat_amount: 0,
    vat_rate: 0,
  }, 'invoices');
  await assertInsertDenied(clientB, 'payments', {
    company_id: companyA.id,
    invoice_id: invoiceA.id,
    amount: 1,
    currency: 'GBP',
    status: 'pending',
  }, 'payments');
  await assertInsertDenied(clientB, 'messages', {
    company_id: companyA.id,
    conversation_id: randomUUID(),
    sender_user_id: userB.id,
    recipient_user_id: userA.id,
    body: 'Cross-tenant message must fail',
  }, 'messages');

  const { data: messageToB, error: messageToBError } = await service.from('messages').insert({
    company_id: companyA.id,
    conversation_id: randomUUID(),
    sender_user_id: userA.id,
    recipient_user_id: userB.id,
    body: `Explicit participant message ${suffix}`,
  }).select('id').single();
  if (messageToBError) throw new Error(`Participant message fixture failed: ${messageToBError.message}`);
  await assertVisible(clientB, 'messages', messageToB.id, 'messages explicit participant exception');
  results.push({ table: 'messages', legitimateCrossCompanyParticipantRead: 'allowed' });

  const { data: foreignCompanyAfter, error: verifyError } = await service
    .from('companies')
    .select('name')
    .eq('id', companyA.id)
    .single();
  if (verifyError) throw new Error(`Post-test fixture verification failed: ${verifyError.message}`);
  assert(foreignCompanyAfter.name === companyA.name, 'Foreign mutation attempts changed the protected company row.');

  console.log(JSON.stringify({
    success: true,
    companyA: companyA.id,
    companyB: companyB.id,
    protectedTables: fixtures.map(([table]) => table),
    insertDenials: ['drivers', 'vehicles', 'jobs', 'documents', 'invoices', 'payments', 'messages'],
    legitimateException: 'A direct message remains visible to its explicit recipient even across company boundaries.',
    results,
  }, null, 2));
} catch (error) {
  console.error(`STAGING_TENANT_ISOLATION_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  console.error(JSON.stringify({ success: false, createdUsers, completed: results }, null, 2));
  process.exitCode = 1;
}
