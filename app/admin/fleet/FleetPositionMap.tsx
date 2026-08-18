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
        borderRadius: '4px',
        background: '#f8fafc',
        color: '#64748b',
        fontSize: '12px',
      }}
    >
      Loading live map…
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
