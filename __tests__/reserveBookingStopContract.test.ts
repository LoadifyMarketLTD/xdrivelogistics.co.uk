import { describe, expect, test } from 'vitest';



import {
  canDriverTransitionStop,
  isTerminalStopStatus,
  parseStopCancellation,
  parseStopCompletion,
  scopedStopEvidenceObject,
  stopEvidencePrefix,
} from '../lib/jobs/driverStopExecution';

const now = Date.parse('2026-11-17T14:00:00.000Z');
const validDelivery = {
  itemCount: 2,
  weightKg: 50,
  recipientName: 'Laura Thomas',
  leftAt: 'Goods Inwards',
  deliveredOn: '2026-11-17T13:00:00.000Z',
  deliveryStatus: 'Completed Delivery',
  signaturePath: 'company/job/stops/stop-a/signature/signature.png',
  photoPaths: ['company/job/stops/stop-a/photos/photo.jpg'],
  documentPaths: [],
  notes: 'Delivered intact',
};

describe('driver stop execution behaviour', () => {
  test('requires an actual delivery handover before a delivery stop can complete', () => {
    expect(parseStopCompletion(undefined, 'delivery', { nowMs: now })).toEqual(
      expect.objectContaining({ ok: false }),
    );
  });

  test.each([
    ['recipient', { ...validDelivery, recipientName: '' }, 'Received By'],
    ['Left At', { ...validDelivery, leftAt: '' }, 'Left At'],
    ['item count', { ...validDelivery, itemCount: 0 }, 'invalid'],
    ['signature', { ...validDelivery, signaturePath: '' }, 'signature'],
    ['delivery photo', { ...validDelivery, photoPaths: [] }, 'photo'],
  ])('rejects completed delivery with missing %s', (_label, input, expected) => {
    const result = parseStopCompletion(input, 'delivery', { nowMs: now });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain(String(expected).toLowerCase());
  });

  test('rejects a future Delivered On timestamp', () => {
    const result = parseStopCompletion(
      { ...validDelivery, deliveredOn: '2026-11-17T14:06:00.000Z' },
      'delivery',
      { nowMs: now },
    );
    expect(result).toEqual(expect.objectContaining({ ok: false }));
  });

  test.each([
    'Incorrect Goods',
    'Incorrect Address',
    'Job Cancelled',
    'Delivery Refused',
    'No Unloading Facilities',
    'Damaged Goods',
  ])('%s is not accepted as a successful completed delivery POD', deliveryStatus => {
    const result = parseStopCompletion(
      { ...validDelivery, deliveryStatus },
      'delivery',
      { nowMs: now },
    );
    expect(result).toEqual(expect.objectContaining({ ok: false }));
  });

  test('accepts a complete successful delivery POD', () => {
    const result = parseStopCompletion(validDelivery, 'delivery', { nowMs: now });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.deliveryStatus).toBe('Completed Delivery');
      expect(result.value.itemCount).toBe(2);
      expect(result.value.photoPaths).toHaveLength(1);
    }
  });

  test('requires collection evidence for collection stop completion', () => {
    expect(parseStopCompletion({ itemCount: 2, photoPaths: [], documentPaths: [] }, 'collection', { nowMs: now }).ok).toBe(false);
    expect(parseStopCompletion({ itemCount: 2, photoPaths: ['company/job/stops/stop-c/photos/a.jpg'], documentPaths: [] }, 'collection', { nowMs: now }).ok).toBe(true);
  });

  test('enforces explicit stop journey order', () => {
    expect(canDriverTransitionStop('pending', 'en_route')).toBe(true);
    expect(canDriverTransitionStop('pending', 'arrived')).toBe(false);
    expect(canDriverTransitionStop('en_route', 'arrived')).toBe(true);
    expect(canDriverTransitionStop('en_route', 'completed')).toBe(false);
    expect(canDriverTransitionStop('arrived', 'completed')).toBe(true);
  });

  test('legacy skipped is deliberately fail-closed, not a valid terminal resolution', () => {
    expect(isTerminalStopStatus('completed')).toBe(true);
    expect(isTerminalStopStatus('cancelled')).toBe(true);
    expect(isTerminalStopStatus('skipped')).toBe(false);
  });

  test('cancellation requires an authorised source and reason', () => {
    expect(parseStopCancellation({})).toEqual(expect.objectContaining({ ok: false }));
    expect(parseStopCancellation({
      scope: 'job',
      cancelledByRole: 'customer',
      reason: 'Customer cancelled by phone',
      instructionChannel: 'phone',
      goodsInCustody: false,
      goodsDisposition: 'return_to_collection',
    })).toEqual(expect.objectContaining({ ok: true }));
  });

  test('goods in custody cannot be cancelled without a disposition', () => {
    const result = parseStopCancellation({
      scope: 'job',
      cancelledByRole: 'customer',
      reason: 'Customer cancelled after collection',
      instructionChannel: 'phone',
      goodsInCustody: true,
      goodsDisposition: 'none',
    });
    expect(result).toEqual(expect.objectContaining({ ok: false }));
  });

  test('return / redirect destination is required when the disposition needs one', () => {
    const missing = parseStopCancellation({
      scope: 'job',
      cancelledByRole: 'posting_company',
      reason: 'Return to depot requested',
      instructionChannel: 'phone',
      goodsInCustody: true,
      goodsDisposition: 'return_to_sender_depot',
      resolutionAddress: '',
    });
    expect(missing.ok).toBe(false);

    const valid = parseStopCancellation({
      scope: 'job',
      cancelledByRole: 'posting_company',
      reason: 'Return to depot requested',
      instructionChannel: 'phone',
      goodsInCustody: true,
      goodsDisposition: 'return_to_sender_depot',
      resolutionAddress: 'XDrive Depot, Blackburn',
    });
    expect(valid.ok).toBe(true);
  });

  test('evidence path is isolated to the exact job and stop', () => {
    const prefix = stopEvidencePrefix('company-a', 'job-a', 'stop-a', 'photos');
    expect(scopedStopEvidenceObject('company-a/job-a/stops/stop-a/photos/a.jpg', prefix)).toEqual({
      folder: 'company-a/job-a/stops/stop-a/photos',
      fileName: 'a.jpg',
    });
    expect(scopedStopEvidenceObject('company-a/job-a/stops/stop-b/photos/a.jpg', prefix)).toBeNull();
    expect(scopedStopEvidenceObject('company-a/job-b/stops/stop-a/photos/a.jpg', prefix)).toBeNull();
    expect(scopedStopEvidenceObject('company-a/job-a/stops/stop-a/photos/../signature/a.png', prefix)).toBeNull();
  });

});
