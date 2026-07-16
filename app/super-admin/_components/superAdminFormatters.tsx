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

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#1D57D8', text: '#F4F6F8' },
  posted: { bg: '#1D57D8', text: '#F4F6F8' },
  allocated: { bg: '#1D57D8', text: '#F4F6F8' },
  in_transit: { bg: '#1D57D8', text: '#F4F6F8' },
  delivered: { bg: '#1D57D8', text: '#F4F6F8' },
  cancelled: { bg: '#F5A300', text: '#F4F6F8' },
  disputed: { bg: '#F5A300', text: '#F4F6F8' },
  active: { bg: '#1D57D8', text: '#F4F6F8' },
  suspended: { bg: '#F5A300', text: '#F4F6F8' },
  pending: { bg: '#F5A300', text: '#F4F6F8' },
  pending_approval: { bg: '#F5A300', text: '#F4F6F8' },
  rejected: { bg: '#F5A300', text: '#F4F6F8' },
  paid: { bg: '#1D57D8', text: '#F4F6F8' },
};

export function StatusChip({ value }: { value: string | null | undefined }) {
  const rawValue = (value ?? 'unknown').toString();
  const normalized = rawValue.toLowerCase();
  const palette = STATUS_COLORS[normalized] ?? { bg: '#1D57D8', text: '#F4F6F8' };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.12rem 0.5rem',
        borderRadius: '999px',
        backgroundColor: palette.bg,
        color: palette.text,
        fontSize: '0.72rem',
        fontWeight: 700,
        textTransform: 'uppercase',
      }}
    >
      {rawValue.replaceAll('_', ' ')}
    </span>
  );
}
