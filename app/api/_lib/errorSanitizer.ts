type DbLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export function sanitizeDbError(
  error: unknown,
  fallback = 'An internal error occurred.'
): string {
  if (!error || typeof error !== 'object') return fallback;

  const dbError = error as DbLikeError;
  const code = String(dbError.code ?? '');
  const message = String(dbError.message ?? '');

  if (code === '23505') return 'Duplicate record.';
  if (code === '23503') return 'Referenced record not found.';
  if (code === '42703' || code === 'PGRST204') return 'Internal data error.';
  if (code === '42501') return 'You do not have permission to perform this action.';
  if (code === '22P02') return 'Invalid identifier or value format.';
  if (code === '23514') return 'Submitted data failed validation.';
  if (code === 'P0001' && /overpayment/i.test(message)) {
    return 'Payment amount exceeds the outstanding invoice balance.';
  }

  return fallback;
}
