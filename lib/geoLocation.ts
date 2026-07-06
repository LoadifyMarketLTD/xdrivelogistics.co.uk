export type Coordinates = { lat: number | null; lng: number | null };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberFrom(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function readDoubleLE(hex: string, byteOffset: number) {
  const clean = hex.replace(/^\\x/i, '');
  const start = byteOffset * 2;
  if (clean.length < start + 16) return null;
  const bytes = clean.slice(start, start + 16).match(/../g);
  if (!bytes) return null;
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  bytes.forEach((byte, index) => view.setUint8(index, Number.parseInt(byte, 16)));
  return view.getFloat64(0, true);
}

function parseEwkbPoint(value: string): Coordinates | null {
  const clean = value.replace(/^\\x/i, '');
  if (!/^[0-9a-f]+$/i.test(clean) || clean.length < 42) return null;
  if (clean.slice(0, 2) !== '01') return null;

  // EWKB point with SRID has endian byte + type + SRID before x/y.
  const x = readDoubleLE(clean, 9);
  const y = readDoubleLE(clean, 17);
  if (x === null || y === null) return null;
  return { lat: y, lng: x };
}

export function coordinatesFromLocation(value: unknown): Coordinates {
  const location = asRecord(value);
  const directLat = numberFrom(location.lat ?? location.latitude);
  const directLng = numberFrom(location.lng ?? location.lon ?? location.longitude);
  if (directLat !== null && directLng !== null) return { lat: directLat, lng: directLng };

  const coordinates = Array.isArray(location.coordinates) ? location.coordinates : [];
  const lng = numberFrom(coordinates[0]);
  const lat = numberFrom(coordinates[1]);
  if (lat !== null && lng !== null) return { lat, lng };

  if (typeof value === 'string') {
    const wkt = value.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
    if (wkt) return { lat: Number(wkt[2]), lng: Number(wkt[1]) };

    const ewkb = parseEwkbPoint(value);
    if (ewkb) return ewkb;
  }

  return { lat: null, lng: null };
}

export function toPostgisPoint(lng: number, lat: number) {
  return `SRID=4326;POINT(${lng} ${lat})`;
}
