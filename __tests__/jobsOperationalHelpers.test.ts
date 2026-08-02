/**
 * Unit tests for the pure helper functions exported from JobsOperationalTable.
 *
 * Tests cover:
 *   1. isDirectInviteEligible — all exchange_visibility / awarded combinations
 *   2. allowedStatusTransitions — every defined status
 *   3. jobToRow adapter — field-by-field mapping contract
 */
import { describe, expect, it } from 'vitest';
import {
  isDirectInviteEligible,
  allowedStatusTransitions,
  jobToRow,
  type AdminJobFields,
} from '../app/components/workspace/JobsOperationalTable';

// ---------------------------------------------------------------------------
// 1. isDirectInviteEligible
// ---------------------------------------------------------------------------

describe('isDirectInviteEligible', () => {
  it('returns true when visibility is null and job is not awarded', () => {
    expect(isDirectInviteEligible({ exchange_visibility: null, awarded_carrier_company_id: null })).toBe(true);
  });

  it('returns true when visibility is undefined and job is not awarded', () => {
    expect(isDirectInviteEligible({ exchange_visibility: undefined, awarded_carrier_company_id: null })).toBe(true);
  });

  it('returns true when visibility is "private" and job is not awarded', () => {
    expect(isDirectInviteEligible({ exchange_visibility: 'private', awarded_carrier_company_id: null })).toBe(true);
  });

  it('returns false when visibility is "exchange" even if not awarded', () => {
    expect(isDirectInviteEligible({ exchange_visibility: 'exchange', awarded_carrier_company_id: null })).toBe(false);
  });

  it('returns false when visibility is "direct" even if not awarded', () => {
    expect(isDirectInviteEligible({ exchange_visibility: 'direct', awarded_carrier_company_id: null })).toBe(false);
  });

  it('returns false when awarded_carrier_company_id is set, even with private visibility', () => {
    expect(isDirectInviteEligible({ exchange_visibility: 'private', awarded_carrier_company_id: 'company-abc' })).toBe(false);
  });

  it('returns false when both visibility is "exchange" and job is awarded', () => {
    expect(isDirectInviteEligible({ exchange_visibility: 'exchange', awarded_carrier_company_id: 'company-abc' })).toBe(false);
  });

  it('returns false when visibility is null but job is awarded', () => {
    expect(isDirectInviteEligible({ exchange_visibility: null, awarded_carrier_company_id: 'carrier-xyz' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. allowedStatusTransitions
// ---------------------------------------------------------------------------

describe('allowedStatusTransitions', () => {
  it('returns ["posted", "cancelled"] for draft status', () => {
    const transitions = allowedStatusTransitions('draft');
    expect(transitions).toContain('posted');
    expect(transitions).toContain('cancelled');
    expect(transitions).toHaveLength(2);
  });

  it('returns ["cancelled"] for posted status', () => {
    const transitions = allowedStatusTransitions('posted');
    expect(transitions).toEqual(['cancelled']);
  });

  it('returns ["cancelled"] for allocated status', () => {
    const transitions = allowedStatusTransitions('allocated');
    expect(transitions).toEqual(['cancelled']);
  });

  it('returns empty array for delivered status (terminal from admin perspective)', () => {
    expect(allowedStatusTransitions('delivered')).toHaveLength(0);
  });

  it('returns empty array for cancelled status (terminal)', () => {
    expect(allowedStatusTransitions('cancelled')).toHaveLength(0);
  });

  it('returns empty array for in_transit status (driver-managed)', () => {
    expect(allowedStatusTransitions('in_transit')).toHaveLength(0);
  });

  it('is case-insensitive', () => {
    expect(allowedStatusTransitions('DRAFT')).toContain('posted');
    expect(allowedStatusTransitions('Posted')).toContain('cancelled');
  });

  it('returns empty array for an unknown status', () => {
    expect(allowedStatusTransitions('nonexistent')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. jobToRow adapter
// ---------------------------------------------------------------------------

const FULL_JOB: AdminJobFields = {
  id: 'job-uuid-001',
  jobRef: 'JOB-UUID-001',
  status: 'draft',
  client: { name: 'Acme Logistics', email: 'ops@acme.com', phone: '07700900000' },
  pickup: { location: 'Manchester, M1 1AE', date: '2026-09-01', time: '09:00', postcode: 'M1 1AE' },
  delivery: { location: 'London, EC2A 1NT', date: '2026-09-01', time: '14:00', postcode: 'EC2A 1NT' },
  vehicleType: 'LWB Van',
  distanceMiles: '197.2 mi',
  createdAt: '2026-08-30T10:00:00Z',
  updatedAt: '2026-08-30T10:05:00Z',
  exchange_visibility: 'private',
  awarded_carrier_company_id: null,
  direct_invite_company_id: null,
  paymentTerms: '30 days net',
  cargo: { type: 'pallets', quantity: 4, notes: 'Fragile' },
  loadDetailSummary: [{ label: 'Vehicle', value: 'LWB Van' }],
};

describe('jobToRow adapter', () => {
  it('maps id, jobRef and status directly', () => {
    const row = jobToRow(FULL_JOB);
    expect(row.id).toBe('job-uuid-001');
    expect(row.jobRef).toBe('JOB-UUID-001');
    expect(row.status).toBe('draft');
  });

  it('maps client.name and omits email/phone from the row', () => {
    const row = jobToRow(FULL_JOB);
    expect(row.client.name).toBe('Acme Logistics');
    // email and phone are not part of JobRow — check they do not appear
    expect('email' in row.client).toBe(false);
    expect('phone' in row.client).toBe(false);
  });

  it('maps pickup with postcode', () => {
    const row = jobToRow(FULL_JOB);
    expect(row.pickup.location).toBe('Manchester, M1 1AE');
    expect(row.pickup.date).toBe('2026-09-01');
    expect(row.pickup.time).toBe('09:00');
    expect(row.pickup.postcode).toBe('M1 1AE');
  });

  it('maps delivery with postcode', () => {
    const row = jobToRow(FULL_JOB);
    expect(row.delivery.location).toBe('London, EC2A 1NT');
    expect(row.delivery.postcode).toBe('EC2A 1NT');
  });

  it('preserves distanceMiles string exactly (no double mi appended)', () => {
    const row = jobToRow(FULL_JOB);
    expect(row.distanceMiles).toBe('197.2 mi');
  });

  it('maps createdAt and updatedAt', () => {
    const row = jobToRow(FULL_JOB);
    expect(row.createdAt).toBe('2026-08-30T10:00:00Z');
    expect(row.updatedAt).toBe('2026-08-30T10:05:00Z');
  });

  it('maps exchange_visibility and awarded_carrier_company_id', () => {
    const row = jobToRow(FULL_JOB);
    expect(row.exchange_visibility).toBe('private');
    expect(row.awarded_carrier_company_id).toBeNull();
  });

  it('maps direct_invite_company_id', () => {
    const row = jobToRow(FULL_JOB);
    expect(row.direct_invite_company_id).toBeNull();
  });

  it('maps paymentTerms', () => {
    const row = jobToRow(FULL_JOB);
    expect(row.paymentTerms).toBe('30 days net');
  });

  it('maps cargo details', () => {
    const row = jobToRow(FULL_JOB);
    expect(row.cargo?.type).toBe('pallets');
    expect(row.cargo?.quantity).toBe(4);
    expect(row.cargo?.notes).toBe('Fragile');
  });

  it('maps loadDetailSummary', () => {
    const row = jobToRow(FULL_JOB);
    expect(row.loadDetailSummary).toHaveLength(1);
    expect(row.loadDetailSummary?.[0].label).toBe('Vehicle');
    expect(row.loadDetailSummary?.[0].value).toBe('LWB Van');
  });

  it('handles missing optional postcode gracefully', () => {
    const jobWithoutPostcode: AdminJobFields = {
      ...FULL_JOB,
      pickup: { location: 'Leeds, LS1', date: '2026-09-02', time: '08:00' },
      delivery: { location: 'Sheffield, S1', date: '2026-09-02', time: '11:00' },
    };
    const row = jobToRow(jobWithoutPostcode);
    expect(row.pickup.postcode).toBeUndefined();
    expect(row.delivery.postcode).toBeUndefined();
  });

  it('handles missing optional operational fields gracefully', () => {
    const minimalJob: AdminJobFields = {
      id: 'min-001',
      jobRef: 'MIN-001',
      status: 'posted',
      client: { name: 'Test Co', email: '', phone: '' },
      pickup: { location: 'A', date: '', time: '' },
      delivery: { location: 'B', date: '', time: '' },
      vehicleType: 'van',
      distanceMiles: '',
      createdAt: '',
      updatedAt: '',
    };
    const row = jobToRow(minimalJob);
    expect(row.paymentTerms).toBeUndefined();
    expect(row.cargo).toBeUndefined();
    expect(row.loadDetailSummary).toBeUndefined();
    expect(row.exchange_visibility).toBeUndefined();
    expect(row.awarded_carrier_company_id).toBeUndefined();
  });
});
