'use client';

import dynamic from 'next/dynamic';
import type { FleetMapPoint } from './FleetPositionMapClient';

const FleetPositionMapClient = dynamic(() => import('./FleetPositionMapClient'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        minHeight: '440px',
        display: 'grid',
        placeItems: 'center',
        borderRadius: '9px',
        background: '#f8fafc',
        color: '#64748b',
        fontSize: '0.82rem',
      }}
    >
      Loading live map…
    </div>
  ),
});

export type { FleetMapPoint };

export default function FleetPositionMap({
  points,
  selectedDriverId,
}: {
  points: FleetMapPoint[];
  selectedDriverId: string | null;
}) {
  return <FleetPositionMapClient points={points} selectedDriverId={selectedDriverId} />;
}
