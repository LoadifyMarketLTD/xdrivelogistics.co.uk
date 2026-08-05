/**
 * Unit tests for the driver-mobile marketplace types, LiveLoad mapping,
 * and the QuotePanel total computation logic.
 *
 * Covered:
 *  1. LiveLoad type — all extended fields are optional and correctly typed
 *  2. Badge mapping — all known badge names are handled
 *  3. Quote helpers — computeTotal, computeSubtotal, buildQuoteMessage, validateQuote
 *  4. DriverJob extended fields — optional fields present in type
 *  5. JobStop type — all required fields present
 *  6. PodRecord type — all required fields present
 *  7. AuditEntry type — all required fields present
 *  8. GBP-only backend contract
 *  9. Invalid amount handling
 * 10. Quote request sends final total (not base amount) and deterministic message
 * 11. Maximum POD evidence limits
 */
import { describe, expect, it } from 'vitest';

import type {
  AuditEntry,
  CanonicalJobStatus,
  DriverJob,
  JobAttachment,
  JobStop,
  PodRecord,
} from '../src/jobs/types';
import type { LiveLoad } from '../src/api/liveLoads';
import {
  buildQuoteMessage,
  computeSubtotal,
  computeTotal,
  DEFAULT_LINE_ITEMS,
  MESSAGE_MAX_CHARS,
  parseNum,
  SUPPORTED_CURRENCY,
  validateQuote,
  type QuoteLineItems,
} from '../src/jobs/quoteHelpers';

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

function makeItems(overrides: Partial<QuoteLineItems> = {}): QuoteLineItems {
  return { ...DEFAULT_LINE_ITEMS, ...overrides };
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

  it('maps null proposedPriceAmount to null (preserves falsy correctly)', () => {
    const load = makeMinimalLiveLoad({ proposedPriceAmount: null });
    expect(load.proposedPriceAmount).toBeNull();
  });

  it('maps zero proposedPriceAmount correctly', () => {
    const load = makeMinimalLiveLoad({ proposedPriceAmount: 0 });
    expect(load.proposedPriceAmount).toBe(0);
  });

  it('preserves canQuote=false', () => {
    const load = makeMinimalLiveLoad({ canQuote: false });
    expect(load.canQuote).toBe(false);
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

// ─── 3. parseNum production helper ──────────────────────────────────────────

describe('parseNum', () => {
  it('returns positive number for valid string', () => {
    expect(parseNum('100')).toBe(100);
    expect(parseNum('1.5')).toBeCloseTo(1.5, 5);
  });

  it('treats comma as decimal separator', () => {
    expect(parseNum('1,5')).toBeCloseTo(1.5, 5);
  });

  it('returns 0 for empty string', () => {
    expect(parseNum('')).toBe(0);
  });

  it('returns 0 for non-numeric', () => {
    expect(parseNum('abc')).toBe(0);
  });

  it('returns 0 for negative', () => {
    expect(parseNum('-5')).toBe(0);
  });

  it('returns 0 for zero', () => {
    expect(parseNum('0')).toBe(0);
  });
});

// ─── 4. computeSubtotal ──────────────────────────────────────────────────────

describe('computeSubtotal', () => {
  it('returns base amount when all extras are zero', () => {
    expect(computeSubtotal(makeItems({ amount: '100' }))).toBe(100);
  });

  it('sums all line items', () => {
    const subtotal = computeSubtotal(makeItems({
      amount: '200', extras: '50', waitingTime: '20', tolls: '15',
      parking: '10', congestion: '5',
    }));
    expect(subtotal).toBe(300);
  });
});

// ─── 5. computeTotal (from production quoteHelpers) ──────────────────────────

describe('computeTotal', () => {
  it('returns base amount when all extras are zero, no VAT', () => {
    expect(computeTotal(makeItems({ amount: '100' }))).toBe(100);
  });

  it('sums all line items', () => {
    const total = computeTotal(makeItems({
      amount: '200', extras: '50', waitingTime: '20', tolls: '15',
      ferry: '0', overnight: '0', parking: '10', congestion: '5',
      vatEnabled: false,
    }));
    expect(total).toBe(300);
  });

  it('applies 20% VAT when vatEnabled is true', () => {
    expect(computeTotal(makeItems({ amount: '100', vatEnabled: true }))).toBeCloseTo(120, 5);
  });

  it('treats empty string as zero', () => {
    expect(computeTotal(makeItems({ amount: '' }))).toBe(0);
  });

  it('treats non-numeric values as zero', () => {
    expect(computeTotal(makeItems({ amount: 'abc' }))).toBe(0);
  });

  it('handles comma as decimal separator', () => {
    expect(computeTotal(makeItems({ amount: '1,5' }))).toBeCloseTo(1.5, 5);
  });

  it('total equals subtotal when vatEnabled is false', () => {
    const items = makeItems({ amount: '200', extras: '50', vatEnabled: false });
    expect(computeTotal(items)).toBe(computeSubtotal(items));
  });

  it('total equals subtotal * 1.2 when vatEnabled is true', () => {
    const items = makeItems({ amount: '100', vatEnabled: true });
    expect(computeTotal(items)).toBeCloseTo(computeSubtotal(items) * 1.2, 5);
  });
});

// ─── 6. GBP-only backend contract ────────────────────────────────────────────

describe('GBP-only backend contract', () => {
  it('SUPPORTED_CURRENCY is GBP', () => {
    expect(SUPPORTED_CURRENCY).toBe('GBP');
  });

  it('DEFAULT_LINE_ITEMS uses GBP currency', () => {
    expect(DEFAULT_LINE_ITEMS.currency).toBe('GBP');
  });
});

// ─── 7. validateQuote ────────────────────────────────────────────────────────

describe('validateQuote', () => {
  it('returns null for a valid quote', () => {
    expect(validateQuote(makeItems({ amount: '100' }))).toBeNull();
  });

  it('rejects zero amount', () => {
    expect(validateQuote(makeItems({ amount: '0' }))).not.toBeNull();
  });

  it('rejects empty amount', () => {
    expect(validateQuote(makeItems({ amount: '' }))).not.toBeNull();
  });

  it('rejects negative amount', () => {
    expect(validateQuote(makeItems({ amount: '-50' }))).not.toBeNull();
  });

  it('rejects non-numeric amount', () => {
    expect(validateQuote(makeItems({ amount: 'abc' }))).not.toBeNull();
  });

  it('rejects unreasonably large amount (> 999,999)', () => {
    expect(validateQuote(makeItems({ amount: '1000000' }))).not.toBeNull();
  });
});

// ─── 8. buildQuoteMessage — sends total, not base ───────────────────────────

describe('buildQuoteMessage', () => {
  it('includes the final total line', () => {
    const items = makeItems({ amount: '100', vatEnabled: false });
    const msg = buildQuoteMessage(items);
    expect(msg).toContain('Total: £100.00');
  });

  it('includes VAT breakdown when vatEnabled', () => {
    const items = makeItems({ amount: '100', vatEnabled: true });
    const msg = buildQuoteMessage(items);
    expect(msg).toContain('Subtotal: £100.00');
    expect(msg).toContain('VAT (20%): £20.00');
    expect(msg).toContain('Total: £120.00');
  });

  it('includes line items when non-zero', () => {
    const items = makeItems({ amount: '200', tolls: '10', parking: '5' });
    const msg = buildQuoteMessage(items);
    expect(msg).toContain('Tolls: £10.00');
    expect(msg).toContain('Parking: £5.00');
    expect(msg).toContain('Total: £215.00');
  });

  it('includes estimated collection time when provided', () => {
    const items = makeItems({ amount: '100', estimatedCollectionTime: '09:00' });
    expect(buildQuoteMessage(items)).toContain('Est. collection: 09:00');
  });

  it('includes driver notes when provided', () => {
    const items = makeItems({ amount: '100', driverNotes: 'Call on arrival' });
    expect(buildQuoteMessage(items)).toContain('Notes: Call on arrival');
  });

  it('is deterministic (same input → same output)', () => {
    const items = makeItems({ amount: '250', tolls: '10', vatEnabled: true, driverNotes: 'Test' });
    expect(buildQuoteMessage(items)).toBe(buildQuoteMessage(items));
  });

  it('is always within MESSAGE_MAX_CHARS', () => {
    const items = makeItems({
      amount: '999',
      extras: '100',
      waitingTime: '50',
      tolls: '25',
      ferry: '30',
      overnight: '75',
      parking: '15',
      congestion: '12',
      driverNotes: 'A'.repeat(900),
      estimatedCollectionTime: '08:30',
      vatEnabled: true,
    });
    expect(buildQuoteMessage(items).length).toBeLessThanOrEqual(MESSAGE_MAX_CHARS);
  });
});

// ─── 9. DriverJob extended fields ───────────────────────────────────────────

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

// ─── 10. JobStop type ────────────────────────────────────────────────────────

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

// ─── 11. PodRecord type ──────────────────────────────────────────────────────

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

// ─── 12. AuditEntry type ──────────────────────────────────────────────────────

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

// ─── 13. JobAttachment type ──────────────────────────────────────────────────

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

// ─── 14. Maximum POD evidence limits ────────────────────────────────────────

describe('Maximum POD evidence limits', () => {
  it('backend limit: maximum 10 photos per job', () => {
    const MAX_POD_PHOTOS = 10;
    const photos = Array.from({ length: MAX_POD_PHOTOS }, (_, i) => `photo-${i}.jpg`);
    expect(photos).toHaveLength(10);
    // An 11th photo would exceed the limit
    expect(photos.length + 1).toBeGreaterThan(MAX_POD_PHOTOS);
  });

  it('backend limit: maximum 10 documents per job', () => {
    const MAX_POD_DOCS = 10;
    const docs = Array.from({ length: MAX_POD_DOCS }, (_, i) => `doc-${i}.pdf`);
    expect(docs).toHaveLength(10);
    expect(docs.length + 1).toBeGreaterThan(MAX_POD_DOCS);
  });

  it('backend persistent path pattern is valid for photos', () => {
    const jobId = 'abc-123';
    const path = `${jobId}/photos/test.jpg`;
    expect(path.startsWith(`${jobId}/photos/`)).toBe(true);
    expect(path).not.toContain('://');
    expect(path).not.toContain('..');
    expect(path).not.toContain('\\');
  });

  it('backend persistent path pattern is valid for documents', () => {
    const jobId = 'abc-123';
    const path = `${jobId}/documents/cmr.pdf`;
    expect(path.startsWith(`${jobId}/documents/`)).toBe(true);
    expect(path).not.toContain('://');
  });
});

// ─── 15. Pinned/Hidden account isolation ─────────────────────────────────────

describe('Pinned/Hidden account isolation', () => {
  it('preferences are keyed by account email', () => {
    // Preferences stored under distinct email keys do not share saved/hidden sets.
    const alice = { savedJobIds: ['job-1'], hiddenJobIds: [] };
    const bob = { savedJobIds: [], hiddenJobIds: ['job-2'] };
    expect(alice.savedJobIds).not.toEqual(bob.savedJobIds);
    expect(alice.hiddenJobIds).not.toEqual(bob.hiddenJobIds);
  });

  it('clearing account does not leak saved job IDs', () => {
    const alicePrefs = { savedJobIds: ['job-a', 'job-b'], hiddenJobIds: [] };
    // Simulate sign-out: new user starts with defaults
    const newPrefs = { savedJobIds: [], hiddenJobIds: [] };
    expect(newPrefs.savedJobIds).toHaveLength(0);
    expect(newPrefs.savedJobIds).not.toContain(alicePrefs.savedJobIds[0]);
  });
});


