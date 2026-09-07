import type { DriverOperationalEligibility } from '../../driver/_lib/operationalEligibility';

export type SecureLoadState = 'clear' | 'review' | 'blocked' | 'awaiting_assignment';
export type SecureCredentialState = 'verified' | 'blocked' | 'unavailable' | 'not_assigned';

export type SecureLoadJobFacts = {
  status?: string | null;
  current_status?: string | null;
  assigned_driver_id?: string | null;
  vehicle_id?: string | null;
  cargo_value_gbp?: number | null;
  special_requirements?: string | null;
  document_checklist?: string[] | null;
  direct_delivery_required?: boolean | null;
  pod_required?: boolean | null;
  pod_generated?: boolean | null;
  delivery_signature_data?: unknown;
  delivery_photos?: unknown;
  pod_photos?: unknown;
  hard_copy_pod?: string | null;
};

const EXECUTION_STATUSES = new Set([
  'allocated', 'accepted', 'assigned', 'in_progress', 'on_my_way', 'on_my_way_to_pickup',
  'on_site_pickup', 'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery',
  'on_site_delivery', 'delivered', 'completed', 'invoiced', 'paid',
]);
const COMPLETED_STATUSES = new Set(['delivered', 'completed', 'invoiced', 'paid']);
const MARKETPLACE_ONLY_BLOCKERS = new Set(['commercial_bidding_not_permitted']);

const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();
const countArray = (value: unknown) => Array.isArray(value) ? value.length : 0;

function executionCredentialBlockers(eligibility: DriverOperationalEligibility | null) {
  if (!eligibility) return [];
  return eligibility.blockers.filter((blocker) => !MARKETPLACE_ONLY_BLOCKERS.has(blocker));
}

export function deriveSecureLoadIntelligence(
  job: SecureLoadJobFacts,
  eligibility: DriverOperationalEligibility | null,
  eligibilityUnavailable: boolean,
  trackingEvidencePresent: boolean,
  uploadedJobDocuments: number,
) {
  const status = norm(job.current_status ?? job.status);
  const assigned = Boolean(job.assigned_driver_id);
  const executing = EXECUTION_STATUSES.has(status);
  const completed = COMPLETED_STATUSES.has(status);
  const highValueGoods = norm(job.special_requirements).includes('high value goods');
  const requestedDocuments = Array.isArray(job.document_checklist) ? job.document_checklist.length : 0;
  const podRequired = job.pod_required === true;
  const podEvidencePresent = Boolean(
    job.pod_generated
    || job.delivery_signature_data
    || countArray(job.delivery_photos)
    || countArray(job.pod_photos)
    || norm(job.hard_copy_pod),
  );

  const executionBlockers = executionCredentialBlockers(eligibility);
  let credentialState: SecureCredentialState = 'not_assigned';
  if (assigned && eligibilityUnavailable) credentialState = 'unavailable';
  else if (assigned && executionBlockers.length === 0 && eligibility) credentialState = 'verified';
  else if (assigned) credentialState = 'blocked';

  const blockers: string[] = [];
  if (executing && !assigned) blockers.push('execution_driver_not_assigned');
  if (assigned && eligibilityUnavailable) blockers.push('credential_verification_unavailable');
  if (assigned && eligibility) blockers.push(...executionBlockers);
  if (
    assigned
    && eligibility?.canonicalVehicleId
    && job.vehicle_id
    && eligibility.canonicalVehicleId !== job.vehicle_id
  ) {
    blockers.push('job_vehicle_differs_from_canonical_driver_vehicle');
  }
  if (completed && podRequired && !podEvidencePresent) blockers.push('required_pod_evidence_missing');

  const reviewSignals: string[] = [];
  if (highValueGoods) reviewSignals.push('high_value_goods');
  if ((job.cargo_value_gbp ?? 0) > 0) reviewSignals.push('cargo_value_declared');
  if (job.direct_delivery_required === true) reviewSignals.push('direct_delivery');
  if (podRequired) reviewSignals.push('pod_required');
  if (requestedDocuments > 0) reviewSignals.push('requested_documents');
  if (executing && !trackingEvidencePresent) reviewSignals.push('execution_tracking_not_present');

  const flags = [
    highValueGoods ? 'High Value Goods' : null,
    (job.cargo_value_gbp ?? 0) > 0 ? 'Cargo value declared' : null,
    job.direct_delivery_required === true ? 'Direct delivery' : null,
    podRequired ? 'POD required' : null,
    requestedDocuments > 0 ? `${requestedDocuments} requested document${requestedDocuments === 1 ? '' : 's'}` : null,
  ].filter((value): value is string => Boolean(value));

  let state: SecureLoadState;
  if (blockers.length) state = 'blocked';
  else if (!assigned) state = 'awaiting_assignment';
  else if (reviewSignals.length) state = 'review';
  else state = 'clear';

  return {
    state,
    credentialState,
    blockers: Array.from(new Set(blockers)),
    reviewSignals,
    flags,
    highValueGoods,
    cargoValueGbp: job.cargo_value_gbp ?? null,
    directDeliveryRequired: job.direct_delivery_required === true,
    podRequired,
    podEvidencePresent,
    requestedDocuments,
    uploadedJobDocuments,
    trackingEvidencePresent,
    eligibilityChecks: eligibility?.checks ?? null,
    canonicalVehicleId: eligibility?.canonicalVehicleId ?? null,
  };
}
