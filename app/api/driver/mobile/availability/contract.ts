export const VALID_AVAILABILITY_STATUS = ['available', 'busy', 'offline'] as const;
export const VALID_AVAILABILITY_SLOTS = ['AM', 'PM', 'EVENING'] as const;

export type AvailabilityStatus = (typeof VALID_AVAILABILITY_STATUS)[number];
export type AvailabilitySlotName = (typeof VALID_AVAILABILITY_SLOTS)[number];

export type AvailabilitySlot = {
  day_of_week: number;
  slot: AvailabilitySlotName;
  available: boolean;
};

export type ParsedAvailabilityPutBody = {
  availability_status?: AvailabilityStatus;
  slots?: AvailabilitySlot[];
};

export function normalizeAvailabilityStatus(value: unknown): AvailabilityStatus {
  if (typeof value !== 'string') return 'offline';
  if ((VALID_AVAILABILITY_STATUS as readonly string[]).includes(value)) return value as AvailabilityStatus;
  return 'offline';
}

export function normalizeAvailabilitySlots(rows: Array<{ day_of_week: unknown; slot: unknown; available: unknown }>): AvailabilitySlot[] {
  const defaults = new Map<string, AvailabilitySlot>();
  for (let day = 0; day <= 6; day += 1) {
    for (const slot of VALID_AVAILABILITY_SLOTS) {
      defaults.set(`${day}:${slot}`, { day_of_week: day, slot, available: false });
    }
  }

  for (const row of rows) {
    const day = Number(row.day_of_week);
    const slot = String(row.slot ?? '').toUpperCase();
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    if (!(VALID_AVAILABILITY_SLOTS as readonly string[]).includes(slot)) continue;
    defaults.set(`${day}:${slot}`, {
      day_of_week: day,
      slot: slot as AvailabilitySlotName,
      available: Boolean(row.available),
    });
  }

  return Array.from(defaults.values());
}

export function validateAvailabilityPutBody(body: unknown): { ok: true; value: ParsedAvailabilityPutBody } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object.' };
  }

  const asRecord = body as Record<string, unknown>;
  const parsed: ParsedAvailabilityPutBody = {};

  if (Object.prototype.hasOwnProperty.call(asRecord, 'availability_status')) {
    const status = asRecord.availability_status;
    if (typeof status !== 'string' || !(VALID_AVAILABILITY_STATUS as readonly string[]).includes(status)) {
      return { ok: false, error: `availability_status must be one of: ${VALID_AVAILABILITY_STATUS.join(', ')}.` };
    }
    parsed.availability_status = status as AvailabilityStatus;
  }

  if (Object.prototype.hasOwnProperty.call(asRecord, 'slots')) {
    const slots = asRecord.slots;
    if (!Array.isArray(slots)) return { ok: false, error: 'slots must be an array.' };
    const parsedSlots: AvailabilitySlot[] = [];
    for (const slotRow of slots) {
      if (typeof slotRow !== 'object' || slotRow === null || Array.isArray(slotRow)) {
        return { ok: false, error: 'Each slot must be an object.' };
      }
      const row = slotRow as Record<string, unknown>;
      const day = row.day_of_week;
      const slot = row.slot;
      const available = row.available;
      if (!Number.isInteger(day) || Number(day) < 0 || Number(day) > 6) {
        return { ok: false, error: 'Each slot.day_of_week must be an integer 0–6.' };
      }
      if (typeof slot !== 'string' || !(VALID_AVAILABILITY_SLOTS as readonly string[]).includes(slot)) {
        return { ok: false, error: `Each slot.slot must be one of: ${VALID_AVAILABILITY_SLOTS.join(', ')}.` };
      }
      if (typeof available !== 'boolean') {
        return { ok: false, error: 'Each slot.available must be a boolean.' };
      }
      parsedSlots.push({
        day_of_week: Number(day),
        slot: slot as AvailabilitySlotName,
        available,
      });
    }
    parsed.slots = parsedSlots;
  }

  return { ok: true, value: parsed };
}
