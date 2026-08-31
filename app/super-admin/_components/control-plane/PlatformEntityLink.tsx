import Link from 'next/link';
import type { ReactNode } from 'react';
import type { PlatformEntityType } from './types';

const X = {
  blue: '#1D57D8',
  navy: '#0B2F6B',
  border: '#D9E1EA',
  white: '#FFFFFF',
} as const;

export function platformEntityHref(entityType: PlatformEntityType, entityId: string) {
  return `/super-admin/inspect/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`;
}

export default function PlatformEntityLink({
  entityType,
  entityId,
  children,
  href,
  compact = false,
}: {
  entityType: PlatformEntityType;
  entityId: string;
  children: ReactNode;
  href?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href ?? platformEntityHref(entityType, entityId)}
      style={{
        minHeight: compact ? '28px' : '32px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: compact ? '0 7px' : '0 9px',
        border: `1px solid ${X.border}`,
        borderRadius: '4px',
        background: X.white,
        color: X.blue,
        fontSize: compact ? '10px' : '11px',
        fontWeight: 800,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
      aria-label={`Inspect ${entityType}`}
    >
      <span>{children}</span>
      <span aria-hidden="true" style={{ color: X.navy }}>→</span>
    </Link>
  );
}
