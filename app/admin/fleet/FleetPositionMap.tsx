'use client';

import dynamic from 'next/dynamic';
import type { FleetMapMode, FleetMapPoint } from './FleetPositionMapClient';

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
      Loading map…
    </div>
  ),
});

export type { FleetMapMode, FleetMapPoint };

export default function FleetPositionMap({
  points,
  selectedDriverId,
  mode = 'live',
}: {
  points: FleetMapPoint[];
  selectedDriverId: string | null;
  mode?: FleetMapMode;
}) {
  return <FleetPositionMapClient points={points} selectedDriverId={selectedDriverId} mode={mode} />;
}
