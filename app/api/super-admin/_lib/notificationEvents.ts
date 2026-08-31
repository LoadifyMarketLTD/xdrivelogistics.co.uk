export type NotificationEventBaseRow = {
  id: string;
  event_type: string;
  entity_type?: string | null;
  entity_id: string;
  recipient_user_id: string | null;
  payload: Record<string, unknown> | null;
  status: string;
  created_at: string;
  processed_at: string | null;
};

export type NotificationEventDurabilityRow = NotificationEventBaseRow & {
  last_error: string | null;
  attempt_count: number | null;
  next_attempt_at: string | null;
};

export type NotificationEventRow = NotificationEventBaseRow & {
  last_error: string | null;
  attempt_count: number | null;
  next_attempt_at: string | null;
};

const DURABILITY_COLUMN_PATTERN = /\b(?:notification_events\.)?(last_error|attempt_count|next_attempt_at)\b/i;
const MISSING_DURABILITY_COLUMN_PATTERNS = [
  /\bcolumn\s+(?:"|')?(?:notification_events\.)?(?:last_error|attempt_count|next_attempt_at)(?:"|')?\s+does not exist\b/i,
  /\bcould not find the\s+(?:"|')?(?:last_error|attempt_count|next_attempt_at)(?:"|')?\s+column(?:\s+of\s+(?:"|')?notification_events(?:"|')?)?\s+in the schema cache\b/i,
];
const MISSING_DURABILITY_COLUMN_CODES = new Set(['42703', 'PGRST204']);

export function normalizeBaseRow(row: NotificationEventBaseRow): NotificationEventRow {
  return {
    id: row.id,
    event_type: row.event_type,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    recipient_user_id: row.recipient_user_id,
    payload: row.payload,
    status: row.status,
    created_at: row.created_at,
    processed_at: row.processed_at,
    last_error: null,
    attempt_count: null,
    next_attempt_at: null,
  };
}

export function normalizeDurabilityRow(row: NotificationEventDurabilityRow): NotificationEventRow {
  return {
    id: row.id,
    event_type: row.event_type,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    recipient_user_id: row.recipient_user_id,
    payload: row.payload,
    status: row.status,
    created_at: row.created_at,
    processed_at: row.processed_at,
    last_error: row.last_error,
    attempt_count: row.attempt_count,
    next_attempt_at: row.next_attempt_at,
  };
}

export function isMissingDurabilityColumnError(err: { message: string; code?: string | null }): boolean {
  const message = err.message ?? '';
  if (!DURABILITY_COLUMN_PATTERN.test(message)) return false;
  if (err.code && MISSING_DURABILITY_COLUMN_CODES.has(err.code)) return true;
  return MISSING_DURABILITY_COLUMN_PATTERNS.some((pattern) => pattern.test(message));
}
