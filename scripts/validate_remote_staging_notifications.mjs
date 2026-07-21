#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const supabaseUrl = required('STAGING_SUPABASE_URL');
const secretKey = required('STAGING_SUPABASE_SECRET_KEY');
const functionUrl = required('STAGING_NOTIFICATION_FUNCTION_URL');
const webhookSecret = required('STAGING_NOTIFICATION_WEBHOOK_SECRET');

const service = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const callFunction = async ({ secret, body = {}, method = 'POST', expected = 200 }) => {
  const response = await fetch(functionUrl, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(secret !== undefined ? { 'x-xdrive-webhook-secret': secret } : {}),
    },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (response.status !== expected) {
    throw new Error(
      `${method} notification function returned ${response.status}; expected ${expected}. Response: ${text.slice(0, 1800)}`,
    );
  }
  return payload;
};

const createUser = async ({ email, password }) => {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: email.split('@')[0], staging_fixture: true },
    app_metadata: { staging_fixture: true },
  });
  if (error || !data.user) {
    throw new Error(`Failed to create notification fixture user: ${error?.message ?? 'unknown error'}`);
  }
  return data.user;
};

const insertEvent = async ({ userId, eventType = 'onboarding_approved', payload = {}, idempotencyKey }) => {
  const entityId = randomUUID();
  const { data, error } = await service
    .from('notification_events')
    .insert({
      event_type: eventType,
      entity_type: 'onboarding_application',
      entity_id: entityId,
      recipient_user_id: userId,
      payload,
      status: 'pending',
      idempotency_key: idempotencyKey,
    })
    .select('id,event_type,status,attempt_count,next_attempt_at,processing_started_at,provider_message_id,payload')
    .single();
  if (error) throw new Error(`Failed to insert notification event: ${error.message}`);
  return data;
};

const readEvent = async (eventId) => {
  const { data, error } = await service
    .from('notification_events')
    .select('id,event_type,status,attempt_count,next_attempt_at,processing_started_at,provider_message_id,last_error,processed_at,payload')
    .eq('id', eventId)
    .single();
  if (error) throw new Error(`Failed to read notification event ${eventId}: ${error.message}`);
  return data;
};

const makeDue = async (eventId) => {
  const { error } = await service
    .from('notification_events')
    .update({
      status: 'failed',
      next_attempt_at: new Date(Date.now() - 1000).toISOString(),
      processing_started_at: null,
    })
    .eq('id', eventId);
  if (error) throw new Error(`Failed to make notification ${eventId} due: ${error.message}`);
};

const suffix = `${Date.now()}`;
const password = `StagingNotifications!${suffix}Aa`;
const createdUsers = [];
const eventIds = [];
const results = {};

try {
  await callFunction({ method: 'GET', expected: 405 });
  await callFunction({ secret: undefined, expected: 401 });
  await callFunction({ secret: `${webhookSecret}-wrong`, expected: 401 });
  results.webhookAuthentication = true;

  const successUser = await createUser({
    email: `staging.notification.success.${suffix}@example.test`,
    password,
  });
  const retryUser = await createUser({
    email: `staging.notification.retry-fail.${suffix}@example.test`,
    password,
  });
  createdUsers.push(successUser.id, retryUser.id);

  const concurrentEvent = await insertEvent({
    userId: successUser.id,
    payload: { manual_dispatch: true, recipient_user_id: successUser.id },
    idempotencyKey: `staging-concurrent-${suffix}`,
  });
  eventIds.push(concurrentEvent.id);

  const concurrentResponses = await Promise.all(
    Array.from({ length: 10 }, () => callFunction({
      secret: webhookSecret,
      body: { event_id: concurrentEvent.id },
    })),
  );
  const totalClaims = concurrentResponses.reduce((sum, response) => sum + Number(response?.claimed ?? 0), 0);
  assert(totalClaims === 1, `Concurrent processing claimed the same event ${totalClaims} times.`);

  const concurrentFinal = await readEvent(concurrentEvent.id);
  assert(concurrentFinal.status === 'sent', `Concurrent event ended in ${concurrentFinal.status}, not sent.`);
  assert(concurrentFinal.attempt_count === 1, `Concurrent event attempt count is ${concurrentFinal.attempt_count}, not 1.`);
  assert(typeof concurrentFinal.provider_message_id === 'string' && concurrentFinal.provider_message_id.startsWith('mock_'),
    'Provider message id was not recorded from the test double.');

  const duplicateReplay = await callFunction({
    secret: webhookSecret,
    body: { event_id: concurrentEvent.id },
  });
  assert(duplicateReplay?.claimed === 0, 'A sent event was reclaimed on replay.');
  const replayFinal = await readEvent(concurrentEvent.id);
  assert(replayFinal.attempt_count === 1, 'Replay changed the attempt count of a sent event.');

  const { error: duplicateKeyError } = await service.from('notification_events').insert({
    event_type: 'onboarding_approved',
    entity_type: 'onboarding_application',
    entity_id: randomUUID(),
    recipient_user_id: successUser.id,
    payload: { manual_dispatch: true },
    status: 'pending',
    idempotency_key: `staging-concurrent-${suffix}`,
  });
  assert(duplicateKeyError?.code === '23505', 'Duplicate notification idempotency key was not rejected.');
  results.atomicClaimAndDuplicatePrevention = true;

  const retryEvent = await insertEvent({
    userId: retryUser.id,
    payload: { manual_dispatch: true, recipient_user_id: retryUser.id },
    idempotencyKey: `staging-retry-${suffix}`,
  });
  eventIds.push(retryEvent.id);

  const firstFailure = await callFunction({
    secret: webhookSecret,
    body: { event_id: retryEvent.id },
  });
  assert(firstFailure?.claimed === 1 && firstFailure?.failed === 1, 'Initial deterministic provider failure was not recorded.');

  let retryState = await readEvent(retryEvent.id);
  assert(retryState.status === 'failed', `Retry event status is ${retryState.status}, not failed.`);
  assert(retryState.attempt_count === 1, 'Initial retry attempt count is not 1.');
  assert(new Date(retryState.next_attempt_at).getTime() > Date.now(), 'Initial failure did not schedule a future retry.');

  const earlyRetry = await callFunction({
    secret: webhookSecret,
    body: { event_id: retryEvent.id },
  });
  assert(earlyRetry?.claimed === 0, 'Notification was reclaimed before next_attempt_at.');

  for (let expectedAttempt = 2; expectedAttempt <= 5; expectedAttempt += 1) {
    await makeDue(retryEvent.id);
    const response = await callFunction({
      secret: webhookSecret,
      body: { event_id: retryEvent.id },
    });
    assert(response?.claimed === 1, `Retry attempt ${expectedAttempt} did not claim the event.`);
    retryState = await readEvent(retryEvent.id);
    assert(retryState.attempt_count === expectedAttempt,
      `Retry attempt count is ${retryState.attempt_count}, expected ${expectedAttempt}.`);
    if (expectedAttempt < 5) {
      assert(retryState.status === 'failed', `Retry attempt ${expectedAttempt} ended in ${retryState.status}.`);
      assert(new Date(retryState.next_attempt_at).getTime() > Date.now(),
        `Retry attempt ${expectedAttempt} did not schedule backoff.`);
    }
  }
  assert(retryState.status === 'dead_letter', `Fifth provider failure ended in ${retryState.status}, not dead_letter.`);
  assert(retryState.next_attempt_at === null, 'Dead-letter event still has a next_attempt_at value.');
  results.retryBackoffAndDeadLetter = true;

  const staleEvent = await insertEvent({
    userId: successUser.id,
    payload: { manual_dispatch: true, recipient_user_id: successUser.id },
    idempotencyKey: `staging-stale-${suffix}`,
  });
  eventIds.push(staleEvent.id);
  const { error: staleError } = await service
    .from('notification_events')
    .update({
      status: 'processing',
      processing_started_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
      attempt_count: 0,
    })
    .eq('id', staleEvent.id);
  if (staleError) throw new Error(`Failed to create stale processing fixture: ${staleError.message}`);

  const staleRecovered = await callFunction({
    secret: webhookSecret,
    body: { event_id: staleEvent.id },
  });
  assert(staleRecovered?.claimed === 1, 'Stale processing event was not reclaimed.');
  const staleFinal = await readEvent(staleEvent.id);
  assert(staleFinal.status === 'sent' && staleFinal.attempt_count === 1,
    'Stale processing event was not recovered exactly once.');
  results.staleWorkerRecovery = true;

  const secretEvent = await insertEvent({
    userId: successUser.id,
    eventType: 'onboarding_invite',
    payload: {
      manual_dispatch: true,
      recipient_user_id: successUser.id,
      account_type: 'fleet_courier',
      onboarding_url: 'https://www.xdrivelogistics.co.uk/onboarding/fleet?token=staging-secret',
      token: 'staging-secret',
      raw_token: 'staging-raw-secret',
    },
    idempotencyKey: `staging-secret-scrub-${suffix}`,
  });
  eventIds.push(secretEvent.id);
  await callFunction({ secret: webhookSecret, body: { event_id: secretEvent.id } });
  const scrubbed = await readEvent(secretEvent.id);
  assert(scrubbed.status === 'sent', 'Onboarding invitation notification was not sent through the test double.');
  for (const key of ['onboarding_url', 'token', 'raw_token', 'onboarding_token']) {
    assert(!(key in (scrubbed.payload ?? {})), `Sent notification retained secret payload field ${key}.`);
  }
  results.secretScrubbing = true;

  const automaticEvent = await insertEvent({
    userId: successUser.id,
    payload: { recipient_user_id: successUser.id },
    idempotencyKey: `staging-auto-dispatch-${suffix}`,
  });
  eventIds.push(automaticEvent.id);

  let automaticFinal = automaticEvent;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    automaticFinal = await readEvent(automaticEvent.id);
    if (automaticFinal.status === 'sent') break;
    if (automaticFinal.status === 'dead_letter') break;
    await sleep(1000);
  }
  assert(automaticFinal.status === 'sent',
    `Database trigger to authenticated Edge Function ended in ${automaticFinal.status}. Error: ${automaticFinal.last_error ?? 'none'}`);
  assert(automaticFinal.attempt_count === 1, 'Automatic dispatch did not complete in exactly one provider attempt.');
  results.databaseTriggerAndVaultDispatch = true;

  console.log(JSON.stringify({
    success: true,
    functionUrl,
    eventIds,
    results,
    concurrentProviderMessageId: concurrentFinal.provider_message_id,
    deadLetterAttemptCount: retryState.attempt_count,
    automaticEventId: automaticEvent.id,
  }, null, 2));
} catch (error) {
  console.error(`STAGING_NOTIFICATION_VALIDATION_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  console.error(JSON.stringify({ success: false, createdUsers, eventIds, results }, null, 2));
  process.exitCode = 1;
}
