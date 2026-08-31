import Link from 'next/link';
import type { ReactNode } from 'react';
import type { PlatformEntityType } from './types';

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
      className="sa-button"
      style={{ minHeight: compact ? 28 : 32, padding: compact ? '0 8px' : '0 10px', textDecoration: 'none', whiteSpace: 'nowrap' }}
      aria-label={`Inspect ${entityType}`}
    >
      <span>{children}</span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}
