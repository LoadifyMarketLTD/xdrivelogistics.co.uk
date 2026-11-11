export type OperationalDriverStatus = 'online' | 'busy' | 'offline' | 'sold';

const DRIVER_APPEARANCE = {
  online: { color: '#168553', textColor: '#FFFFFF', label: 'AVAILABLE', glyph: 'A' },
  busy: { color: '#F5A300', textColor: '#101828', label: 'BUSY', glyph: 'B' },
  offline: { color: '#D92D20', textColor: '#FFFFFF', label: 'OFFLINE', glyph: 'O' },
  sold: { color: '#667085', textColor: '#FFFFFF', label: 'UNAVAILABLE', glyph: 'U' },
} as const;

export function operationalDriverAppearance(status: OperationalDriverStatus) {
  return DRIVER_APPEARANCE[status];
}

export function operationalMarkerSize(isCoarsePointer: boolean): number {
  return isCoarsePointer ? 44 : 28;
}

export function isValidMapPoint(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90
    && typeof lng === 'number' && Number.isFinite(lng) && Math.abs(lng) <= 180;
}
