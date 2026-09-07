import type { SupabaseClient } from '@supabase/supabase-js';

type AdminClient = SupabaseClient;

export type MessageRow = {
  id: string;
  company_id: string | null;
  conversation_id: string | null;
  sender_user_id: string | null;
  recipient_user_id: string | null;
  body: string;
  created_at: string | null;
};

export type ParticipantIdentity = {
  userId: string;
  name: string | null;
  companyId: string | null;
  companyName: string | null;
};

export type MessageContext = {
  kind: 'quote' | 'job';
  conversationId: string;
  bidId: string | null;
  jobId: string;
  loadRef: string;
  routeLabel: string;
  status: string | null;
  jobStatus: string | null;
};

const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;

export function counterpartIds(messages: MessageRow[], userId: string) {
  const ids = new Set<string>();
  for (const message of messages) {
    if (message.sender_user_id === userId && message.recipient_user_id) ids.add(message.recipient_user_id);
    if (message.recipient_user_id === userId && message.sender_user_id) ids.add(message.sender_user_id);
  }
  ids.delete(userId);
  return [...ids];
}

export async function loadParticipantIdentityMap(client: AdminClient, userIds: string[]) {
  const identities = new Map<string, ParticipantIdentity>();
  const uniqueUserIds = [...new Set(userIds)].filter(Boolean);
  if (!uniqueUserIds.length) return identities;

  const [profilesResult, driversResult, membershipsResult] = await Promise.all([
    client.from('profiles').select('user_id, full_name').in('user_id', uniqueUserIds),
    client.from('drivers').select('user_id, display_name, company_id').in('user_id', uniqueUserIds),
    client.from('company_memberships').select('user_id, company_id, status').in('user_id', uniqueUserIds).eq('status', 'active'),
  ]);

  const companyIds = new Set<string>();
  const nameByUser = new Map<string, string>();
  if (!profilesResult.error) {
    for (const row of profilesResult.data ?? []) {
      const userId = text(row.user_id); const name = text(row.full_name);
      if (userId && name) nameByUser.set(userId, name);
    }
  }
  if (!driversResult.error) {
    for (const row of driversResult.data ?? []) {
      const userId = text(row.user_id); const name = text(row.display_name); const companyId = text(row.company_id);
      if (userId && name && !nameByUser.has(userId)) nameByUser.set(userId, name);
      if (companyId) companyIds.add(companyId);
    }
  }

  const companyByUser = new Map<string, string>();
  if (!membershipsResult.error) {
    const activeByUser = new Map<string, Set<string>>();
    for (const row of membershipsResult.data ?? []) {
      const userId = text(row.user_id); const companyId = text(row.company_id);
      if (!userId || !companyId) continue;
      const set = activeByUser.get(userId) ?? new Set<string>(); set.add(companyId); activeByUser.set(userId, set); companyIds.add(companyId);
    }
    for (const [userId, ids] of activeByUser) if (ids.size === 1) companyByUser.set(userId, [...ids][0]);
  }

  if (!driversResult.error) {
    for (const row of driversResult.data ?? []) {
      const userId = text(row.user_id); const companyId = text(row.company_id);
      if (userId && companyId && !companyByUser.has(userId)) companyByUser.set(userId, companyId);
    }
  }

  const companyNames = new Map<string, string>();
  if (companyIds.size) {
    const { data, error } = await client.from('companies').select('id, name').in('id', [...companyIds]);
    if (!error) for (const row of data ?? []) {
      const companyId = text(row.id); const name = text(row.name);
      if (companyId && name) companyNames.set(companyId, name);
    }
  }

  for (const userId of uniqueUserIds) {
    const companyId = companyByUser.get(userId) ?? null;
    identities.set(userId, {
      userId,
      name: nameByUser.get(userId) ?? null,
      companyId,
      companyName: companyId ? companyNames.get(companyId) ?? null : null,
    });
  }
  return identities;
}

export async function loadMessageContextMap(client: AdminClient, conversationIds: string[]) {
  const contexts = new Map<string, MessageContext>();
  const ids = [...new Set(conversationIds)].filter(Boolean);
  if (!ids.length) return { contexts, partial: false };

  const [bidsResult, directJobsResult] = await Promise.all([
    client.from('job_bids').select('id, job_id, status').in('id', ids),
    client.from('jobs').select('id, load_ref, booking_reference, customer_reference, status, current_status, pickup_location, delivery_location').in('id', ids),
  ]);
  const bids = bidsResult.error ? [] : (bidsResult.data ?? []);
  const directJobs = directJobsResult.error ? [] : (directJobsResult.data ?? []);
  const bidJobIds = bids.map((row) => text(row.job_id)).filter((value): value is string => Boolean(value));

  const bidJobsResult = bidJobIds.length
    ? await client.from('jobs').select('id, load_ref, booking_reference, customer_reference, status, current_status, pickup_location, delivery_location').in('id', [...new Set(bidJobIds)])
    : { data: [], error: null };
  const allJobs = [...directJobs, ...(bidJobsResult.error ? [] : bidJobsResult.data ?? [])];
  const jobById = new Map(allJobs.map((row) => [String(row.id), row]));
  const jobLabel = (job: Record<string, unknown>, jobId: string) => text(job.load_ref) ?? text(job.booking_reference) ?? text(job.customer_reference) ?? `XDL-${jobId.slice(0, 8).toUpperCase()}`;
  const routeLabel = (job: Record<string, unknown>) => [text(job.pickup_location), text(job.delivery_location)].filter(Boolean).join(' → ') || 'Route unavailable';

  for (const bid of bids) {
    const bidId = text(bid.id); const jobId = text(bid.job_id);
    if (!bidId || !jobId) continue;
    const job = (jobById.get(jobId) ?? {}) as Record<string, unknown>;
    contexts.set(bidId, {
      kind: 'quote', conversationId: bidId, bidId, jobId,
      loadRef: jobLabel(job, jobId), routeLabel: routeLabel(job),
      status: text(bid.status), jobStatus: text(job.current_status) ?? text(job.status),
    });
  }

  for (const rawJob of directJobs) {
    const job = rawJob as Record<string, unknown>; const jobId = text(job.id);
    if (!jobId || contexts.has(jobId)) continue;
    contexts.set(jobId, {
      kind: 'job', conversationId: jobId, bidId: null, jobId,
      loadRef: jobLabel(job, jobId), routeLabel: routeLabel(job),
      status: text(job.current_status) ?? text(job.status), jobStatus: text(job.current_status) ?? text(job.status),
    });
  }

  return { contexts, partial: Boolean(bidsResult.error || directJobsResult.error || bidJobsResult.error) };
}
