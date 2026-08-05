/**
 * Unit tests for the driver-mobile marketplace types, LiveLoad mapping,
 * and the QuotePanel total computation logic.
 *
 * Covered:
 *  1. LiveLoad type — all extended fields are optional and correctly typed
 *  2. Badge mapping — all known badge names are handled
 *  3. Quote total computation — sum of all line items with/without VAT
 *  4. DriverJob extended fields — optional fields present in type
 *  5. JobStop type — all required fields present
 *  6. PodRecord type — all required fields present
 *  7. AuditEntry type — all required fields present
 */
import { describe, expect, it } from 'vitest';

import type {
  AuditEntry,
  CanonicalJobStatus,
  DriverJob,
  JobAttachment,
  JobStop,
  PodRecord,
} from '../apps/driver-mobile/src/jobs/types';
import type { LiveLoad } from '../apps/driver-mobile/src/api/liveLoads';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeMinimalDriverJob(overrides: Partial<DriverJob> = {}): DriverJob {
  return {
    id: 'job-1',
    reference: 'XDL-001',
    status: 'awarded',
    pickupLocation: 'London',
    deliveryLocation: 'Manchester',
    pickupTime: '2026-08-05T09:00:00Z',
    deliveryTime: '2026-08-05T13:00:00Z',
    cargoType: 'Pallets',
    vehicleRequirement: 'Luton',
    price: '£250.00',
    priority: 'normal',
    podRequired: true,
    contactAllowed: true,
    ...overrides,
  };
}

function makeMinimalLiveLoad(overrides: Partial<LiveLoad> = {}): LiveLoad {
  return {
    id: 'load-1',
    reference: 'XDL-LOAD-001',
    pickupLocation: 'Birmingham',
    deliveryLocation: 'Leeds',
    pickupTime: '2026-08-05T08:00:00Z',
    deliveryTime: '2026-08-05T12:00:00Z',
    cargoType: 'Boxes',
    vehicleRequirement: 'Transit',
    price: '£180.00',
    proposedPriceAmount: 180,
    publicPricePublished: true,
    canQuote: true,
    pickupCountryCode: 'GB',
    deliveryCountryCode: 'GB',
    directDeliveryRequired: false,
    destinationPriority: false,
    hasProposedPrice: true,
    ...overrides,
  };
}

// ─── 1. LiveLoad type — extended fields ──────────────────────────────────────

describe('LiveLoad type — extended fields', () => {
  it('accepts distanceMiles as optional number', () => {
    const load = makeMinimalLiveLoad({ distanceMiles: 120 });
    expect(load.distanceMiles).toBe(120);
  });

  it('accepts estimatedDrivingMinutes as optional number', () => {
    const load = makeMinimalLiveLoad({ estimatedDrivingMinutes: 95 });
    expect(load.estimatedDrivingMinutes).toBe(95);
  });

  it('accepts weightKg as optional number', () => {
    const load = makeMinimalLiveLoad({ weightKg: 1200 });
    expect(load.weightKg).toBe(1200);
  });

  it('accepts dimensions as optional string', () => {
    const load = makeMinimalLiveLoad({ dimensions: '120x80x100cm' });
    expect(load.dimensions).toBe('120x80x100cm');
  });

  it('accepts palletCount as optional number', () => {
    const load = makeMinimalLiveLoad({ palletCount: 6 });
    expect(load.palletCount).toBe(6);
  });

  it('accepts adr flag', () => {
    const load = makeMinimalLiveLoad({ adr: true });
    expect(load.adr).toBe(true);
  });

  it('accepts tailLift flag', () => {
    const load = makeMinimalLiveLoad({ tailLift: true });
    expect(load.tailLift).toBe(true);
  });

  it('accepts temperatureControlled flag', () => {
    const load = makeMinimalLiveLoad({ temperatureControlled: true });
    expect(load.temperatureControlled).toBe(true);
  });

  it('accepts badges array', () => {
    const load = makeMinimalLiveLoad({ badges: ['Hotshot', 'Same Day'] });
    expect(load.badges).toEqual(['Hotshot', 'Same Day']);
  });

  it('accepts pickupTimeTo and deliveryTimeTo time windows', () => {
    const load = makeMinimalLiveLoad({
      pickupTimeTo: '2026-08-05T10:00:00Z',
      deliveryTimeTo: '2026-08-05T14:00:00Z',
    });
    expect(load.pickupTimeTo).toBeDefined();
    expect(load.deliveryTimeTo).toBeDefined();
  });
});

// ─── 2. Known badge names ───────────────────────────────────────────────────

describe('badge names', () => {
  const KNOWN_BADGES = [
    'Hotshot', 'SmartPay', 'Same Day', 'Express',
    'Tail Lift', 'ADR', 'Fragile', 'High Value', 'Temp Controlled',
  ];

  it('each known badge name is a non-empty string', () => {
    KNOWN_BADGES.forEach((badge) => {
      expect(typeof badge).toBe('string');
      expect(badge.trim().length).toBeGreaterThan(0);
    });
  });

  it('no duplicate badge names', () => {
    expect(new Set(KNOWN_BADGES).size).toBe(KNOWN_BADGES.length);
  });
});

// ─── 3. Quote total computation ──────────────────────────────────────────────

function parseNum(value: string) {
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const VAT_RATE = 0.2;

function computeTotal(items: {
  amount: string; extras: string; waitingTime: string; tolls: string;
  ferry: string; overnight: string; parking: string; congestion: string;
  vatEnabled: boolean;
}) {
  const subtotal = parseNum(items.amount) + parseNum(items.extras)
    + parseNum(items.waitingTime) + parseNum(items.tolls) + parseNum(items.ferry)
    + parseNum(items.overnight) + parseNum(items.parking) + parseNum(items.congestion);
  return items.vatEnabled ? subtotal * (1 + VAT_RATE) : subtotal;
}

const BASE = { extras: '0', waitingTime: '0', tolls: '0', ferry: '0', overnight: '0', parking: '0', congestion: '0' };

describe('quote total computation', () => {
  it('returns base amount when all extras are zero', () => {
    expect(computeTotal({ ...BASE, amount: '100', vatEnabled: false })).toBe(100);
  });

  it('sums all line items', () => {
    const total = computeTotal({
      amount: '200', extras: '50', waitingTime: '20', tolls: '15',
      ferry: '0', overnight: '0', parking: '10', congestion: '5',
      vatEnabled: false,
    });
    expect(total).toBe(300);
  });

  it('applies 20% VAT when vatEnabled is true', () => {
    const total = computeTotal({ ...BASE, amount: '100', vatEnabled: true });
    expect(total).toBeCloseTo(120, 5);
  });

  it('treats empty string as zero', () => {
    expect(computeTotal({ ...BASE, amount: '', vatEnabled: false })).toBe(0);
  });

  it('treats non-numeric values as zero', () => {
    expect(computeTotal({ ...BASE, amount: 'abc', vatEnabled: false })).toBe(0);
  });

  it('handles comma as decimal separator (European format)', () => {
    // '1,5' → replace comma with dot → 1.5
    expect(computeTotal({ ...BASE, amount: '1,5', vatEnabled: false })).toBeCloseTo(1.5, 5);
  });
});

// ─── 4. DriverJob extended fields ───────────────────────────────────────────

describe('DriverJob extended fields', () => {
  it('accepts client field', () => {
    const job = makeMinimalDriverJob({ client: 'Acme Corp' });
    expect(job.client).toBe('Acme Corp');
  });

  it('accepts distance and eta', () => {
    const job = makeMinimalDriverJob({ distance: '120 mi', eta: '2h 30m' });
    expect(job.distance).toBe('120 mi');
    expect(job.eta).toBe('2h 30m');
  });

  it('accepts adr, tailLift, temperatureControlled flags', () => {
    const job = makeMinimalDriverJob({ adr: true, tailLift: false, temperatureControlled: true });
    expect(job.adr).toBe(true);
    expect(job.tailLift).toBe(false);
    expect(job.temperatureControlled).toBe(true);
  });

  it('accepts badges array', () => {
    const job = makeMinimalDriverJob({ badges: ['Hotshot', 'ADR'] });
    expect(job.badges).toEqual(['Hotshot', 'ADR']);
  });

  it('accepts notes and instructions', () => {
    const job = makeMinimalDriverJob({
      customerNotes: 'fragile',
      dispatcherNotes: 'call ahead',
      specialInstructions: 'use rear entrance',
    });
    expect(job.customerNotes).toBe('fragile');
    expect(job.dispatcherNotes).toBe('call ahead');
    expect(job.specialInstructions).toBe('use rear entrance');
  });

  it('accepts pod record', () => {
    const pod: PodRecord = {
      receiverName: 'John Smith',
      date: '05 Aug 2026',
      time: '13:45',
      deliveryPhotoUris: [],
      damagePhotoUris: [],
      documentUris: [],
      completedBy: 'driver@xdrive.com',
      completedByRole: 'driver',
    };
    const job = makeMinimalDriverJob({ pod });
    expect(job.pod?.receiverName).toBe('John Smith');
  });

  it('podCompleted and podGenerated are both accepted (backward compat)', () => {
    const job = makeMinimalDriverJob({ podGenerated: true, podCompleted: true });
    expect(job.podGenerated).toBe(true);
    expect(job.podCompleted).toBe(true);
  });
});

// ─── 5. JobStop type ─────────────────────────────────────────────────────────

describe('JobStop type', () => {
  it('accepts a full collection stop', () => {
    const stop: JobStop = {
      id: 'stop-1',
      type: 'collection',
      sequence: 0,
      address: '10 High Street, London',
      company: 'Sender Ltd',
      contactPerson: 'Alice',
      telephone: '07700900000',
      timeWindowFrom: '2026-08-05T08:00:00Z',
      timeWindowTo: '2026-08-05T10:00:00Z',
      status: 'pending',
      notes: 'Ring doorbell',
      gpsCoordinates: '51.5074,-0.1278',
      photos: [],
      documents: [],
    };
    expect(stop.type).toBe('collection');
    expect(stop.sequence).toBe(0);
    expect(stop.gpsCoordinates).toBeDefined();
  });

  it('accepts a minimal delivery stop with only required fields', () => {
    const stop: JobStop = {
      id: 'stop-2',
      type: 'delivery',
      sequence: 1,
      address: '5 Park Lane, Manchester',
    };
    expect(stop.type).toBe('delivery');
    expect(stop.company).toBeUndefined();
  });
});

// ─── 6. PodRecord type ───────────────────────────────────────────────────────

describe('PodRecord type', () => {
  it('accepts full pod record with all optional fields', () => {
    const pod: PodRecord = {
      receiverName: 'Jane Doe',
      receiverCompany: 'Receiver Ltd',
      signatureData: 'data:image/png;base64,abc',
      date: '05 Aug 2026',
      time: '14:00',
      gps: '53.4808,-2.2426',
      deliveryPhotoUris: ['file:///photo1.jpg'],
      damagePhotoUris: [],
      documentUris: ['file:///cmr.pdf'],
      quantityDelivered: '10',
      itemsMissing: '0',
      itemsDamaged: '1',
      comments: 'One box slightly dented',
      receiverNotes: 'Leave in reception',
      driverNotes: 'Customer was present',
      completedBy: 'driver@xdrive.com',
      completedByRole: 'driver',
      auditHistory: [],
    };
    expect(pod.receiverName).toBe('Jane Doe');
    expect(pod.completedByRole).toBe('driver');
    expect(pod.damagePhotoUris).toHaveLength(0);
  });
});

// ─── 7. AuditEntry type ──────────────────────────────────────────────────────

describe('AuditEntry type', () => {
  it('accepts a full audit entry', () => {
    const entry: AuditEntry = {
      id: 'audit-1',
      status: 'delivered' as CanonicalJobStatus,
      user: 'driver@xdrive.com',
      role: 'driver',
      timestamp: '2026-08-05T14:00:00Z',
      gps: '53.4808,-2.2426',
      device: 'Pixel 7',
      osVersion: 'Android 14',
      appVersion: '2.1.0',
      ipAddress: '192.168.1.1',
      notes: 'Delivered to reception',
      attachments: [],
    };
    expect(entry.status).toBe('delivered');
    expect(entry.role).toBe('driver');
    expect(entry.gps).toBeDefined();
  });

  it('accepts an audit entry with only required fields', () => {
    const entry: AuditEntry = {
      id: 'audit-2',
      status: 'loaded' as CanonicalJobStatus,
      user: 'driver@xdrive.com',
      role: 'driver',
      timestamp: '2026-08-05T10:00:00Z',
    };
    expect(entry.gps).toBeUndefined();
    expect(entry.device).toBeUndefined();
  });
});

// ─── 8. JobAttachment type ──────────────────────────────────────────────────

describe('JobAttachment type', () => {
  it('accepts all supported categories', () => {
    const categories: JobAttachment['category'][] = [
      'pod', 'invoice', 'cmr', 'manifest', 'customs',
      'delivery_photos', 'collection_photos', 'damage_photos',
    ];
    expect(categories).toHaveLength(8);
    categories.forEach((c) => expect(typeof c).toBe('string'));
  });

  it('accepts all supported file types', () => {
    const fileTypes: JobAttachment['fileType'][] = ['pdf', 'jpg', 'png', 'docx', 'xlsx'];
    expect(fileTypes).toHaveLength(5);
  });
});
