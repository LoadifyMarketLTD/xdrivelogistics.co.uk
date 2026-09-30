'use client';

import dynamic from 'next/dynamic';
import type { FleetMapMode, FleetMapPoint } from './FleetPositionMapClient';

const FleetPositionMapClient = dynamic(() => import('./FleetPositionMapClient'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: '100%', minHeight: 0,
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
  height = 440,
}: {
  points: FleetMapPoint[];
  selectedDriverId: string | null;
  mode?: FleetMapMode;
  height?: number | string;
}) {
  return <div style={{ height, minWidth: 0, overflow: 'hidden' }} data-fleet-map-wrapper><FleetPositionMapClient points={points} selectedDriverId={selectedDriverId} mode={mode} height={height} /></div>;
}
