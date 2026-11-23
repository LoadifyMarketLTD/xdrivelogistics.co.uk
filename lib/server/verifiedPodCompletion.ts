import type { SupabaseClient } from '@supabase/supabase-js';
import { hasCompletePodEvidence, type PodCompletionRecord } from '../jobs/podCompletion';

type VerifiedPodRecord = PodCompletionRecord & { pod_generated_at?: unknown };

/**
 * An old pod_generated flag alone is never proof of an official signed POD.
 * Match the Production completion trigger, then verify the persisted receipt.
 */
export async function isVerifiedOfficialPodComplete(
  db: SupabaseClient,
  jobId: string,
  job: VerifiedPodRecord,
): Promise<boolean> {
  if (!hasCompletePodEvidence(job) || !job.pod_generated_at) return false;
  const photos = Array.isArray(job.delivery_photos) ? job.delivery_photos : [];
  if (photos.length < 1 || photos.length > 10
      || !photos.every(path => typeof path === 'string' && /\.(png|jpe?g)$/i.test(path))
      || new Set(photos).size !== photos.length) return false;

  const raw = job.delivery_signature_data;
  const signature = typeof raw === 'string' ? raw
    : raw && typeof raw === 'object' && !Array.isArray(raw)
      ? String((raw as Record<string, unknown>).signature_data
          ?? (raw as Record<string, unknown>).value ?? '')
      : '';
  if (!(/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(signature)
    || /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/=]+$/.test(signature)
    || /^[^/\s]+\/[^/\s]+\/(?:[^/\s]+\/)*[^/\s]+\.(png|jpe?g)$/i.test(signature))) return false;

  const { data, error } = await db
    .from('proof_of_delivery')
    .select('id,received_by')
    .eq('job_id', jobId)
    .not('received_by', 'is', null)
    .limit(25);
  if (error) throw new Error('Official POD receipt could not be verified.');
  return (data ?? []).some(row => typeof row.received_by === 'string' && row.received_by.trim().length > 0);
}
