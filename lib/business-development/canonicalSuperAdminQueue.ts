import type { SupabaseClient } from '@supabase/supabase-js';

export type CrmCanonicalQueueItem = {
  id: string;
  type: string;
  severity: 'P0' | 'P1' | 'P2';
  title: string;
  description: string;
  entityType: string;
  entityId: string;
  entityName: string;
  detectedAt: string;
  ageMinutes: number;
  href: string;
};
export type CrmQueueSnapshot =
  | { ready: true; privacyCount: number; followUpCount: number; inboundCount: number; retentionCount: number; items: CrmCanonicalQueueItem[] }
  | { ready: false; privacyCount: null; followUpCount: null; inboundCount: null; retentionCount: null; items: []; error: string };

const PAGE_LIMIT = 50;
const ageMinutes = (date: string, now: Date) =>
  Math.max(0, Math.floor((now.getTime() - new Date(date).getTime()) / 60_000));

/**
 * Optional read-only CRM extension to the canonical Super Admin Action Queue.
 * Enabled only after the exact XDrive CRM schema is independently verified.
 * No support tickets, notifications, emails or data mutations are created.
 * Privacy requests created through general Support remain in that canonical
 * source, whereas CRM-origin requests retain their own source identity.
 */
export async function readCrmActionQueue(
  db: SupabaseClient,
  now: Date,
): Promise<CrmQueueSnapshot> {
  const [privacy, followUps, inbound, retention] = await Promise.all([
    db.from('crm_privacy_requests')
      .select('id,request_type,status,created_at', { count: 'exact' })
      .in('status', ['received', 'reviewing', 'approved'])
      .order('created_at', { ascending: true })
      .limit(PAGE_LIMIT),
    db.from('crm_prospect_organisations')
      .select('id,next_follow_up_at', { count: 'exact' })
      .not('status', 'in', '(converted,disqualified)')
      .not('next_follow_up_at', 'is', null)
      .lte('next_follow_up_at', now.toISOString())
      .order('next_follow_up_at', { ascending: true })
      .limit(PAGE_LIMIT),
    db.from('crm_business_interests')
      .select('id,created_at', { count: 'exact' })
      .in('status', ['new','reviewing'])
      .order('created_at', { ascending: true })
      .limit(PAGE_LIMIT),
    db.from('crm_business_interests')
      .select('id,retained_until', { count: 'exact' })
      .lte('retained_until', now.toISOString())
      .order('retained_until', { ascending: true })
      .limit(PAGE_LIMIT),
  ]);
  if (privacy.error || followUps.error || inbound.error || retention.error ||
      privacy.count === null || followUps.count === null ||
      inbound.count === null || retention.count === null)
    return {
      ready: false, privacyCount: null, followUpCount: null, inboundCount: null, retentionCount: null, items: [],
      error: 'CRM action sources unavailable or schema not deployed; do not report zero.',
    };

  const items: CrmCanonicalQueueItem[] = [
    ...(privacy.data ?? []).map(row => ({
      id: 'crm-privacy-' + row.id,
      type: 'crm_privacy_review',
      severity: 'P1' as const,
      title: 'CRM privacy request needs review',
      description: 'CRM data-rights request (' + String(row.request_type) + '); review verified identity and actual statutory deadline.',
      entityType: 'crm_privacy_request',
      entityId: String(row.id),
      entityName: 'CRM data-rights request',
      detectedAt: String(row.created_at),
      ageMinutes: ageMinutes(String(row.created_at), now),
      href: '/super-admin/business-development#crm-privacy',
    })),
    ...(inbound.data ?? []).map(row => ({
      id: 'crm-inbound-' + row.id,
      type: 'crm_business_interest_review',
      severity: 'P2' as const,
      title: 'Commercial enquiry awaiting review',
      description: 'Unverified inbound business interest. No company account, marketing contact or booking has been created.',
      entityType: 'crm_business_interest',
      entityId: String(row.id),
      entityName: 'Business interest',
      detectedAt: String(row.created_at),
      ageMinutes: ageMinutes(String(row.created_at), now),
      href: '/super-admin/business-development#crm-inbound',
    })),
    ...(retention.data ?? []).map(row => ({
      id: 'crm-retention-' + row.id,
      type: 'crm_business_interest_retention',
      severity: 'P1' as const,
      title: 'Business enquiry retention review due',
      description: 'Data retention date reached. Human review of statutory duties and legal holds is required before any deletion.',
      entityType: 'crm_business_interest',
      entityId: String(row.id),
      entityName: 'Business interest retention',
      detectedAt: String(row.retained_until),
      ageMinutes: ageMinutes(String(row.retained_until), now),
      href: '/super-admin/business-development#crm-inbound',
    })),
    ...(followUps.data ?? []).map(row => ({
      id: 'crm-followup-' + row.id,
      type: 'crm_follow_up_due',
      severity: 'P2' as const,
      title: 'Commercial prospect follow-up due',
      description: 'Owner review is due; no outreach has been sent automatically.',
      entityType: 'crm_prospect',
      entityId: String(row.id),
      entityName: 'Commercial prospect',
      detectedAt: String(row.next_follow_up_at),
      ageMinutes: ageMinutes(String(row.next_follow_up_at), now),
      href: '/super-admin/business-development#crm-follow-ups',
    })),
  ];
  return { ready: true, privacyCount: privacy.count, followUpCount: followUps.count, inboundCount: inbound.count, retentionCount: retention.count, items };
}
