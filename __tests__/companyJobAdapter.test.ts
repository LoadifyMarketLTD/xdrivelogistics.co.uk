import { describe, expect, it } from 'vitest';
import { adaptJobRow, adaptJobRows } from '../lib/companyJobAdapter';

// ── Minimal raw row that satisfies the adapter ────────────────────────────────

const minimalRow = {
  id: 'abc00001-0000-0000-0000-000000000000',
  status: 'received',
  created_at: '2025-01-15T10:00:00Z',
  updated_at: '2025-01-15T10:00:00Z',
};

// ── Full raw row with all optional fields ──────────────────────────────────────

const fullRow = {
  id: 'abc00002-0000-0000-0000-000000000001',
  job_ref: 'JOB-0042',
  status: 'posted',
  created_at: '2025-06-01T09:00:00Z',
  updated_at: '2025-06-01T09:30:00Z',
  // Use pickup_location/delivery_location (the RawJobRow fields)
  pickup_location: 'Piccadilly Gardens, Manchester',
  pickup_postcode: 'M1 1AA',
  delivery_location: 'Commercial Street, London',
  delivery_postcode: 'E1 6AN',
  pickup_datetime: '2025-06-05T08:00:00Z',
  delivery_datetime: '2025-06-05T14:00:00Z',
  distance_miles: 200,
  vehicle_type: 'lwb_van',
  requested_vehicle_label: null, // let it fall back to formatVehicleLabel
  total_weight_kg: 500,
  weight_kg: 500,
  pallets: 10,
  length_cm: 120,
  width_cm: 80,
  height_cm: 100,
  budget_amount: 350,
  is_fixed_price: false,
  exchange_visibility: 'public',
  customer_reference: 'CUST-REF-001',
  purchase_order_number: 'PO-999',
  booking_reference: 'BK-001',
  client_name: 'ACME Logistics',
  client_email: 'ops@acme.com',
  client_phone: '+44 7000 000000',
  company_id: 'co-abc',
  // companies join (single object form as returned by Supabase select)
  companies: { name: 'ACME Ltd' },
};

// ── adaptJobRow — minimal row ─────────────────────────────────────────────────

describe('adaptJobRow — minimal row', () => {
  it('does not throw on minimal input', () => {
    expect(() => adaptJobRow(minimalRow)).not.toThrow();
  });

  it('preserves id', () => {
    const item = adaptJobRow(minimalRow);
    expect(item.id).toBe(minimalRow.id);
  });

  it('generates a JOB-prefixed jobRef from id when no job_ref field', () => {
    const item = adaptJobRow(minimalRow);
    expect(item.jobRef).toMatch(/^JOB-/);
  });

  it('stores the raw status string', () => {
    const item = adaptJobRow(minimalRow);
    // 'received' is an alias for 'draft'; adapter stores the raw value
    expect(item.status).toBe('received');
  });

  it('sets permittedActions array with at least "view"', () => {
    const item = adaptJobRow(minimalRow);
    expect(Array.isArray(item.permittedActions)).toBe(true);
    expect(item.permittedActions).toContain('view');
  });

  it('has string routeDisplay', () => {
    const item = adaptJobRow(minimalRow);
    expect(typeof item.routeDisplay).toBe('string');
  });

  it('has string pickupSummary and deliverySummary', () => {
    const item = adaptJobRow(minimalRow);
    expect(typeof item.pickupSummary).toBe('string');
    expect(typeof item.deliverySummary).toBe('string');
  });

  it('has no raw JSON or "[object Object]" in display fields', () => {
    const item = adaptJobRow(minimalRow);
    const displayFields = [item.jobRef, item.routeDisplay, item.pickupSummary, item.deliverySummary, item.vehicleLabel];
    for (const field of displayFields) {
      expect(typeof field).toBe('string');
      expect(field).not.toContain('[object Object]');
    }
  });

  it('sets bidCount to 0 when no options provided', () => {
    const item = adaptJobRow(minimalRow);
    expect(item.bidCount).toBe(0);
  });

  it('sets ownBidAmountGbp to null when no ownBid option', () => {
    const item = adaptJobRow(minimalRow);
    expect(item.ownBidAmountGbp).toBeNull();
  });
});

// ── adaptJobRow — full row ────────────────────────────────────────────────────

describe('adaptJobRow — full row', () => {
  it('uses job_ref from row', () => {
    const item = adaptJobRow(fullRow);
    expect(item.jobRef).toBe('JOB-0042');
  });

  it('formats vehicle label from vehicle_type when requested_vehicle_label is null', () => {
    const item = adaptJobRow(fullRow);
    expect(item.vehicleLabel).toBe('LWB Van');
  });

  it('extracts company name from companies join', () => {
    const item = adaptJobRow(fullRow);
    expect(item.companyName).toBe('ACME Ltd');
  });

  it('uses bidCount from options', () => {
    const item = adaptJobRow(fullRow, { bidCount: 3 });
    expect(item.bidCount).toBe(3);
  });

  it('includes route display with arrow', () => {
    const item = adaptJobRow(fullRow);
    expect(item.routeDisplay).toContain('→');
  });

  it('stores pickup and delivery postcode summaries', () => {
    const item = adaptJobRow(fullRow);
    expect(item.pickupPostcode).toBe('M1 1AA');
    expect(item.deliveryPostcode).toBe('E1 6AN');
  });

  it('stores raw status "posted"', () => {
    const item = adaptJobRow(fullRow);
    expect(item.status).toBe('posted');
  });

  it('stores distance in miles as a number', () => {
    const item = adaptJobRow(fullRow);
    expect(item.distanceMiles).toBe(200);
  });

  it('sets ownBidAmountGbp from ownBid option', () => {
    const item = adaptJobRow(fullRow, {
      ownBid: { id: 'bid-1', amountGbp: 300, status: 'pending' },
    });
    expect(item.ownBidAmountGbp).toBe(300);
  });

  it('sets ownBidAmountGbp to null when no ownBid', () => {
    const item = adaptJobRow(fullRow);
    expect(item.ownBidAmountGbp).toBeNull();
  });

  it('includes pallets and weightKg', () => {
    const item = adaptJobRow(fullRow);
    expect(item.pallets).toBe(10);
    expect(item.weightKg).toBe(500);
  });
});

// ── adaptJobRow — edge cases ──────────────────────────────────────────────────

describe('adaptJobRow — edge cases', () => {
  it('handles null status and uses "draft" fallback', () => {
    const item = adaptJobRow({ ...minimalRow, status: null });
    expect(item.status).toBe('draft');
  });

  it('handles missing distance_miles (sets distanceMiles to null)', () => {
    const item = adaptJobRow({ ...minimalRow, distance_miles: null } as unknown as typeof minimalRow);
    expect(item.distanceMiles).toBeNull();
  });

  it('handles missing vehicle_type (vehicle label falls back gracefully)', () => {
    const item = adaptJobRow({ ...minimalRow, vehicle_type: null });
    expect(typeof item.vehicleLabel).toBe('string');
    expect(item.vehicleLabel).not.toContain('[object');
  });

  it('handles "received" alias — permittedActions include post_to_exchange', () => {
    const item = adaptJobRow({ ...minimalRow, status: 'received' });
    // 'received' is alias for 'draft' which permits post_to_exchange
    expect(item.permittedActions).toContain('post_to_exchange');
  });

  it('handles malformed special_requirements JSON without throwing', () => {
    expect(() => adaptJobRow({ ...minimalRow, special_requirements: '{bad json' })).not.toThrow();
  });

  it('handles companies as null (no join)', () => {
    const item = adaptJobRow({ ...fullRow, companies: null });
    expect(typeof item.companyName).toBe('string');
    expect(item.companyName).toBe('Unknown Company');
  });

  it('normalizes companies array join (Supabase single-select join)', () => {
    const item = adaptJobRow({
      ...fullRow,
      companies: [{ name: 'Array Join Co' }] as { name: string }[],
    });
    expect(item.companyName).toBe('Array Join Co');
  });

  it('handles empty string status and uses "draft" fallback', () => {
    const item = adaptJobRow({ ...minimalRow, status: '' });
    expect(item.status).toBe('draft');
  });
});

// ── adaptJobRows ──────────────────────────────────────────────────────────────

describe('adaptJobRows', () => {
  it('returns empty array for empty input', () => {
    expect(adaptJobRows([])).toEqual([]);
  });

  it('processes multiple rows', () => {
    const rows = [
      minimalRow,
      { ...minimalRow, id: 'abc00003-0000-0000-0000-000000000000' },
    ];
    const items = adaptJobRows(rows);
    expect(items).toHaveLength(2);
  });

  it('does not throw on rows with minimal fields', () => {
    const rows = [
      minimalRow,
      { id: 'id-x', status: null, created_at: null, updated_at: null },
    ];
    expect(() => adaptJobRows(rows)).not.toThrow();
  });

  it('passes viewerCompanyId option to each row', () => {
    const rows = [minimalRow];
    const items = adaptJobRows(rows, { viewerCompanyId: 'my-company' });
    // minimalRow has no company_id, so adapter uses viewerCompanyId as fallback
    expect(items[0].companyId).toBe('my-company');
  });

  it('passes bidCount and ownBid to each row', () => {
    const rows = [fullRow];
    const items = adaptJobRows(rows, {
      bidCount: 5,
      ownBid: { id: 'bid-x', amountGbp: 250, status: 'pending' },
    });
    expect(items[0].bidCount).toBe(5);
    expect(items[0].ownBidAmountGbp).toBe(250);
  });
});
