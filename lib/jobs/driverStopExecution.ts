export const DRIVER_STOP_STATUSES = ['pending','en_route','arrived','completed','cancelled','skipped'] as const;
export type DriverStopStatus = typeof DRIVER_STOP_STATUSES[number];

export const DELIVERY_OUTCOMES = [
  'Completed Delivery',
  'Incorrect Goods',
  'Incorrect Address',
  'Job Cancelled',
  'Delivery Refused',
  'No Unloading Facilities',
  'Damaged Goods',
] as const;
export type DeliveryOutcome = typeof DELIVERY_OUTCOMES[number];

export const CANCELLATION_PARTIES = [
  'posting_company',
  'customer',
  'broker_dispatcher',
  'collection_contact',
  'delivery_contact',
  'other_authorised_party',
] as const;

export const INSTRUCTION_CHANNELS = ['phone','message','email','in_person','other'] as const;

export const GOODS_DISPOSITIONS = [
  'none',
  'return_to_collection',
  'return_to_sender_depot',
  'await_instructions',
  'redirect_authorised',
  'replacement_stop',
] as const;

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const number = (value: unknown, min: number, max: number, integer = false) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) return NaN;
  return parsed;
};

const paths = (value: unknown, max = 10) => {
  if (value === null || value === undefined) return [] as string[];
  if (!Array.isArray(value) || value.length > max || value.some(item => typeof item !== 'string')) return null;
  const result = value.map(item => String(item).trim());
  return result.some(item => !item) ? null : result;
};

const isoDateTime = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : NaN;
};

export type ParsedStopCompletion = {
  customerReference: string | null;
  itemCount: number | null;
  packaging: string | null;
  weightKg: number | null;
  etaMinutes: number | null;
  etaAt: string | null;
  notes: string | null;
  recipientName: string | null;
  leftAt: string | null;
  deliveryStatus: string | null;
  deliveredOn: string | null;
  photoPaths: string[];
  documentPaths: string[];
  signaturePath: string | null;
  canonicalFinalPod: boolean;
};

export function parseStopCompletion(
  rawValue: unknown,
  stopType: 'collection' | 'delivery',
  options: { finalStop?: boolean; nowMs?: number } = {},
): { ok: true; value: ParsedStopCompletion } | { ok: false; error: string } {
  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
    return { ok: false, error: stopType === 'delivery' ? 'A POD is required for every completed delivery stop.' : 'Collection stop evidence is required.' };
  }
  const raw = rawValue as Record<string, unknown>;
  const itemCount = number(raw.itemCount, stopType === 'delivery' ? 1 : 0, 100000, true);
  const weightKg = number(raw.weightKg, 0, 100000);
  const etaMinutes = number(raw.etaMinutes, 0, 1440);
  const etaAt = isoDateTime(raw.etaAt);
  const deliveredOn = isoDateTime(raw.deliveredOn);
  const photoPaths = paths(raw.photoPaths);
  const documentPaths = paths(raw.documentPaths);
  if ([itemCount, weightKg, etaMinutes, etaAt, deliveredOn].some(value => Number.isNaN(value))) {
    return { ok: false, error: 'Stop handover values are invalid.' };
  }
  if (!photoPaths || !documentPaths) return { ok: false, error: 'Too many or invalid stop evidence files.' };

  const recipientName = text(raw.recipientName, 160);
  const leftAt = text(raw.leftAt, 160);
  const deliveryStatus = text(raw.deliveryStatus, 80);
  const signaturePath = text(raw.signaturePath, 500);
  const canonicalFinalPod = raw.canonicalFinalPod === true;

  if (stopType === 'collection' && photoPaths.length < 1) {
    return { ok: false, error: 'At least one verified collection photo is required for this stop.' };
  }

  if (stopType === 'delivery') {
    if (deliveryStatus !== 'Completed Delivery') {
      return { ok: false, error: 'Resolve the delivery exception before completing this stop.' };
    }
    if (!recipientName) return { ok: false, error: 'Received By is required for a completed delivery stop.' };
    if (!leftAt) return { ok: false, error: 'Left At is required for a completed delivery stop.' };
    if (itemCount === null) return { ok: false, error: 'Number of Items is required for a completed delivery stop.' };
    if (!deliveredOn || typeof deliveredOn !== 'string') return { ok: false, error: 'Delivered On is required for a completed delivery stop.' };
    const nowMs = options.nowMs ?? Date.now();
    if (new Date(deliveredOn).getTime() > nowMs + 5 * 60_000) {
      return { ok: false, error: 'Delivered On cannot be in the future.' };
    }
    if (options.finalStop && canonicalFinalPod) {
      // The final stop may reference the canonical final POD instead of duplicating its files.
    } else {
      if (!signaturePath) return { ok: false, error: 'A recipient signature is required for every delivery stop.' };
      if (photoPaths.length < 1) return { ok: false, error: 'At least one verified delivery photo is required for every delivery stop.' };
    }
  }

  return {
    ok: true,
    value: {
      customerReference: text(raw.customerReference, 120) || null,
      itemCount,
      packaging: text(raw.packaging, 120) || null,
      weightKg,
      etaMinutes,
      etaAt: typeof etaAt === 'string' ? etaAt : null,
      notes: text(raw.notes, 2000) || null,
      recipientName: recipientName || null,
      leftAt: leftAt || null,
      deliveryStatus: deliveryStatus || null,
      deliveredOn: typeof deliveredOn === 'string' ? deliveredOn : null,
      photoPaths,
      documentPaths,
      signaturePath: signaturePath || null,
      canonicalFinalPod,
    },
  };
}

export type ParsedCancellation = {
  scope: 'stop' | 'job';
  cancelledByRole: string;
  cancelledByName: string | null;
  reason: string;
  instructionChannel: string;
  goodsInCustody: boolean;
  goodsDisposition: string;
  resolutionAddress: string | null;
  notes: string | null;
};

export function parseStopCancellation(rawValue: unknown): { ok: true; value: ParsedCancellation } | { ok: false; error: string } {
  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
    return { ok: false, error: 'Cancellation details are required.' };
  }
  const raw = rawValue as Record<string, unknown>;
  const scope = raw.scope === 'job' ? 'job' : 'stop';
  const cancelledByRole = text(raw.cancelledByRole, 80);
  const cancelledByName = text(raw.cancelledByName, 160);
  const reason = text(raw.reason, 1000);
  const instructionChannel = text(raw.instructionChannel, 40);
  const goodsInCustody = raw.goodsInCustody === true;
  const requestedDisposition = text(raw.goodsDisposition, 80) || 'none';
  const goodsDisposition = goodsInCustody ? requestedDisposition : 'none';
  const resolutionAddress = text(raw.resolutionAddress, 500);
  const notes = text(raw.notes, 2000);

  if (!(CANCELLATION_PARTIES as readonly string[]).includes(cancelledByRole)) {
    return { ok: false, error: 'Select who instructed the cancellation.' };
  }
  if (reason.length < 5) return { ok: false, error: 'A cancellation reason of at least 5 characters is required.' };
  if (!(INSTRUCTION_CHANNELS as readonly string[]).includes(instructionChannel)) {
    return { ok: false, error: 'Select how the cancellation instruction was received.' };
  }
  if (!(GOODS_DISPOSITIONS as readonly string[]).includes(goodsDisposition)) {
    return { ok: false, error: 'Select what must happen to the goods.' };
  }
  if (goodsInCustody && goodsDisposition === 'none') {
    return { ok: false, error: 'Goods in custody require a recorded disposition.' };
  }
  if (goodsInCustody && ['return_to_sender_depot','redirect_authorised','replacement_stop'].includes(goodsDisposition) && !resolutionAddress) {
    return { ok: false, error: 'A return or replacement address is required for this instruction.' };
  }

  return { ok: true, value: {
    scope,
    cancelledByRole,
    cancelledByName: cancelledByName || null,
    reason,
    instructionChannel,
    goodsInCustody,
    goodsDisposition,
    resolutionAddress: resolutionAddress || null,
    notes: notes || null,
  }};
}

export function isTerminalStopStatus(status: string) {
  // "skipped" is retained only for legacy rows. It is deliberately NOT terminal
  // for driver progression because it has no canonical cancellation/POD record.
  return status === 'completed' || status === 'cancelled';
}

export function canDriverTransitionStop(current: string, next: string) {
  if (next === 'en_route') return current === 'pending';
  if (next === 'arrived') return current === 'en_route';
  if (next === 'completed') return current === 'arrived';
  if (next === 'cancelled') return ['pending','en_route','arrived'].includes(current);
  if (next === 'exception') return ['en_route','arrived'].includes(current);
  return false;
}

export function deliveryOutcomeIsException(value: string) {
  return value !== 'Completed Delivery' && (DELIVERY_OUTCOMES as readonly string[]).includes(value);
}
