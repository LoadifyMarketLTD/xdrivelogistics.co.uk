type ZoneKind = 'ULEZ' | 'CAZ';

type LocationInput = {
  address?: string | null;
  postcode?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type EnvironmentalZoneMatch = {
  zone: ZoneKind;
  source: 'postcode' | 'address' | 'coords';
  confidence: 'confirmed' | 'estimated';
  details: string;
};

export type EnvironmentalZoneCheck = {
  pickup: EnvironmentalZoneMatch | null;
  delivery: EnvironmentalZoneMatch | null;
  hasHit: boolean;
  summary: string;
};

type JobLike = {
  pickup_location?: string | null;
  pickup_postcode?: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  delivery_location?: string | null;
  delivery_postcode?: string | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
};

const POSTCODE_REGEX = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;
const LONDON_POSTCODE_AREAS = new Set(['E', 'EC', 'N', 'NW', 'SE', 'SW', 'W', 'WC', 'BR', 'CR', 'DA', 'EN', 'HA', 'IG', 'KT', 'RM', 'SM', 'UB', 'TW']);

type Polygon = Array<[number, number]>;

type ZoneGeometry = {
  zone: ZoneKind;
  label: string;
  polygon: Polygon;
};

const CAZ_HINTS: Array<{ zone: ZoneKind; label: string; keywords: string[]; postcodeAreas: string[] }> = [
  { zone: 'ULEZ', label: 'London ULEZ', keywords: ['LONDON', 'ULEZ', 'ULTRA LOW EMISSION ZONE'], postcodeAreas: Array.from(LONDON_POSTCODE_AREAS) },
  { zone: 'CAZ', label: 'Birmingham CAZ', keywords: ['BIRMINGHAM'], postcodeAreas: ['B'] },
  { zone: 'CAZ', label: 'Bath CAZ', keywords: ['BATH'], postcodeAreas: ['BA'] },
  { zone: 'CAZ', label: 'Bradford CAZ', keywords: ['BRADFORD'], postcodeAreas: ['BD'] },
  { zone: 'CAZ', label: 'Bristol CAZ', keywords: ['BRISTOL'], postcodeAreas: ['BS'] },
  { zone: 'CAZ', label: 'Portsmouth CAZ', keywords: ['PORTSMOUTH'], postcodeAreas: ['PO'] },
  { zone: 'CAZ', label: 'Sheffield CAZ', keywords: ['SHEFFIELD'], postcodeAreas: ['S'] },
  { zone: 'CAZ', label: 'Tyneside CAZ', keywords: ['TYNE', 'NEWCASTLE', 'GATESHEAD'], postcodeAreas: ['NE'] },
];

const ZONE_GEOMETRIES: ZoneGeometry[] = [
  {
    zone: 'ULEZ',
    label: 'London ULEZ',
    polygon: [
      [51.714, -0.52],
      [51.74, -0.28],
      [51.735, -0.02],
      [51.69, 0.18],
      [51.61, 0.31],
      [51.49, 0.33],
      [51.39, 0.22],
      [51.32, 0.05],
      [51.28, -0.17],
      [51.29, -0.38],
      [51.35, -0.54],
      [51.48, -0.61],
      [51.62, -0.58],
    ],
  },
  {
    zone: 'CAZ',
    label: 'Birmingham CAZ',
    polygon: [
      [52.52, -2.04],
      [52.55, -1.96],
      [52.55, -1.86],
      [52.50, -1.79],
      [52.44, -1.80],
      [52.41, -1.89],
      [52.42, -2.00],
    ],
  },
  {
    zone: 'CAZ',
    label: 'Bath CAZ',
    polygon: [
      [51.41, -2.43],
      [51.42, -2.34],
      [51.40, -2.29],
      [51.37, -2.30],
      [51.35, -2.37],
      [51.36, -2.44],
    ],
  },
  {
    zone: 'CAZ',
    label: 'Bradford CAZ',
    polygon: [
      [53.86, -1.84],
      [53.87, -1.76],
      [53.83, -1.70],
      [53.77, -1.71],
      [53.74, -1.79],
      [53.76, -1.87],
    ],
  },
  {
    zone: 'CAZ',
    label: 'Bristol CAZ',
    polygon: [
      [51.52, -2.66],
      [51.52, -2.55],
      [51.48, -2.47],
      [51.41, -2.49],
      [51.39, -2.59],
      [51.43, -2.68],
    ],
  },
  {
    zone: 'CAZ',
    label: 'Portsmouth CAZ',
    polygon: [
      [50.85, -1.17],
      [50.86, -1.05],
      [50.81, -1.00],
      [50.77, -1.02],
      [50.75, -1.10],
      [50.78, -1.18],
    ],
  },
  {
    zone: 'CAZ',
    label: 'Sheffield CAZ',
    polygon: [
      [53.42, -1.58],
      [53.43, -1.47],
      [53.39, -1.39],
      [53.33, -1.40],
      [53.31, -1.49],
      [53.35, -1.58],
    ],
  },
  {
    zone: 'CAZ',
    label: 'Tyneside CAZ',
    polygon: [
      [54.99, -1.73],
      [55.00, -1.58],
      [54.95, -1.48],
      [54.90, -1.51],
      [54.88, -1.62],
      [54.92, -1.73],
    ],
  },
];

const normalizeText = (value: string | null | undefined) => (value ?? '').toUpperCase().replace(/\s+/g, ' ').trim();

const extractPostcode = (value: string | null | undefined) => {
  const match = normalizeText(value).match(POSTCODE_REGEX);
  return match?.[1]?.replace(/\s+/g, ' ').trim().toUpperCase() ?? null;
};

const postcodeArea = (postcode: string | null | undefined) => {
  if (!postcode) return null;
  const compact = postcode.replace(/\s+/g, '').toUpperCase();
  const match = compact.match(/^[A-Z]{1,2}/);
  return match?.[0] ?? null;
};

const pointInPolygon = (point: [number, number], polygon: Polygon) => {
  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [pointLat, pointLng] = point;
    const [currentLat, currentLng] = polygon[index];
    const [previousLat, previousLng] = polygon[previous];

    const intersects =
      currentLng > pointLng !== previousLng > pointLng &&
      pointLat < ((previousLat - currentLat) * (pointLng - currentLng)) / (previousLng - currentLng) + currentLat;

    if (intersects) inside = !inside;
  }

  return inside;
};

const detectFromCoordinates = (input: LocationInput): EnvironmentalZoneMatch | null => {
  if (typeof input.lat !== 'number' || typeof input.lng !== 'number') return null;

  for (const geometry of ZONE_GEOMETRIES) {
    if (!pointInPolygon([input.lat, input.lng], geometry.polygon)) continue;

    return {
      zone: geometry.zone,
      source: 'coords',
      confidence: 'confirmed',
      details: `${geometry.label} matched from pickup/delivery coordinates.`,
    };
  }

  return null;
};

const detectFromText = (input: LocationInput): EnvironmentalZoneMatch | null => {
  const text = normalizeText([input.address, input.postcode].filter(Boolean).join(' '));
  const postcode = extractPostcode(input.postcode || input.address);
  const area = postcodeArea(postcode);

  for (const hint of CAZ_HINTS) {
    const hasKeyword = hint.keywords.some((keyword) => text.includes(keyword));
    const hasArea = Boolean(area && hint.postcodeAreas.includes(area));

    if (!hasKeyword && !hasArea) continue;

    return {
      zone: hint.zone,
      source: hasKeyword ? 'address' : 'postcode',
      confidence: hasKeyword ? 'confirmed' : 'estimated',
      details: hasKeyword ? `${hint.label} keyword found in the address text.` : `${hint.label} postcode area matched (${area}).`,
    };
  }

  return null;
};

export const inspectLocationEnvironmentalZone = (input: LocationInput): EnvironmentalZoneMatch | null => {
  const textMatch = detectFromText(input);
  if (textMatch) return textMatch;

  return detectFromCoordinates(input);
};

export const inspectJobEnvironmentalZones = (job: JobLike | null | undefined): EnvironmentalZoneCheck => {
  const pickup = job
    ? inspectLocationEnvironmentalZone({
        address: job.pickup_location,
        postcode: job.pickup_postcode,
        lat: job.pickup_lat,
        lng: job.pickup_lng,
      })
    : null;

  const delivery = job
    ? inspectLocationEnvironmentalZone({
        address: job.delivery_location,
        postcode: job.delivery_postcode,
        lat: job.delivery_lat,
        lng: job.delivery_lng,
      })
    : null;

  const fragments = [
    pickup ? `Pickup: ${pickup.zone} (${pickup.confidence})` : 'Pickup: clear',
    delivery ? `Delivery: ${delivery.zone} (${delivery.confidence})` : 'Delivery: clear',
  ];

  return {
    pickup,
    delivery,
    hasHit: Boolean(pickup || delivery),
    summary: fragments.join(' • '),
  };
};
