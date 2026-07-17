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
  draft: { bg: '#334155', text: '#e2e8f0' },
  posted: { bg: '#1d4ed8', text: '#dbeafe' },
  allocated: { bg: '#7c3aed', text: '#ede9fe' },
  in_transit: { bg: '#0f766e', text: '#ccfbf1' },
  delivered: { bg: '#166534', text: '#dcfce7' },
  cancelled: { bg: '#991b1b', text: '#fee2e2' },
  disputed: { bg: '#9a3412', text: '#ffedd5' },
  active: { bg: '#166534', text: '#dcfce7' },
  suspended: { bg: '#991b1b', text: '#fee2e2' },
  pending: { bg: '#854d0e', text: '#fef9c3' },
  pending_approval: { bg: '#854d0e', text: '#fef9c3' },
  rejected: { bg: '#9a3412', text: '#ffedd5' },
  paid: { bg: '#166534', text: '#dcfce7' },
};

export function StatusChip({ value }: { value: string | null | undefined }) {
  const rawValue = (value ?? 'unknown').toString();
  const normalized = rawValue.toLowerCase();
  const palette = STATUS_COLORS[normalized] ?? { bg: '#334155', text: '#e2e8f0' };
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
