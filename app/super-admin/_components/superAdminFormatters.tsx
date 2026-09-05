'use client';

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function routeSummary(
  pickupLocation: string | null | undefined,
  pickupPostcode: string | null | undefined,
  deliveryLocation: string | null | undefined,
  deliveryPostcode: string | null | undefined,
): string {
  const pickup = [pickupLocation, pickupPostcode].filter(Boolean).join(' · ') || '—';
  const delivery = [deliveryLocation, deliveryPostcode].filter(Boolean).join(' · ') || '—';
  return `${pickup} → ${delivery}`;
}

const BLUE = '#1A73E8';
const GREEN = '#34A853';
const YELLOW = '#FBBC05';
const RED = '#EA4335';
const GREY = '#8A9099';
const TEXT = '#4A4A4A';
const WHITE = '#FFFFFF';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: GREY, text: WHITE },
  posted: { bg: BLUE, text: WHITE },
  allocated: { bg: BLUE, text: WHITE },
  in_transit: { bg: BLUE, text: WHITE },
  delivered: { bg: GREEN, text: WHITE },
  cancelled: { bg: RED, text: WHITE },
  disputed: { bg: RED, text: WHITE },
  active: { bg: GREEN, text: WHITE },
  available: { bg: GREEN, text: WHITE },
  ready: { bg: GREEN, text: WHITE },
  suspended: { bg: RED, text: WHITE },
  critical: { bg: RED, text: WHITE },
  rejected: { bg: RED, text: WHITE },
  pending: { bg: YELLOW, text: TEXT },
  pending_approval: { bg: YELLOW, text: TEXT },
  attention: { bg: YELLOW, text: TEXT },
  paid: { bg: GREEN, text: WHITE },
  offline: { bg: GREY, text: WHITE },
};

export function StatusChip({ value }: { value: string | null | undefined }) {
  const rawValue = (value ?? 'unknown').toString();
  const normalized = rawValue.toLowerCase();
  const palette = STATUS_COLORS[normalized] ?? { bg: GREY, text: WHITE };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: '8px',
        backgroundColor: palette.bg,
        color: palette.text,
        fontFamily: 'Inter, Roboto, Arial, sans-serif',
        fontSize: '14px',
        fontWeight: 700,
        textTransform: 'uppercase',
      }}
    >
      {rawValue.replaceAll('_', ' ')}
    </span>
  );
}
