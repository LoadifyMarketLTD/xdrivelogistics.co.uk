import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Broker and Customer authorized Exchange availability screens', () => {
  const shared = read('app/components/workspace/ExchangeAvailabilityWorkspace.tsx');
  const broker = read('app/broker/live-availability/page.tsx');
  const customer = read('app/customer/live-availability/page.tsx');

  it('routes both workspaces through a shared UI with path-based authorization', () => {
    expect(shared).toContain('<ProtectedRoute>');
    expect(broker).toContain('audience="broker"');
    expect(customer).toContain('audience="customer"');
    expect(shared).toContain('/api/availability/nearby?');
    expect(shared).toContain("scope: 'exchange'");
  });

  it('never presents exact own-fleet or private coordinates as Exchange availability', () => {
    expect(shared).toContain("point.scope === 'exchange'");
    expect(shared).toContain("locationScope: 'exchange'");
    expect(shared).toContain('Approximate published area');
    expect(shared).not.toContain('exact_lat');
    expect(shared).not.toContain('exact_lng');
  });

  it('links booking to existing role-scoped posting flows without automatically creating a job', () => {
    expect(shared).toContain('directCarrier=');
    expect(shared).toContain('encodeURIComponent(p.company_id)');
    expect(shared).toContain('Booking requires separate commercial confirmation.');
    expect(shared).not.toContain("method: 'POST'");
  });

  it('shows real freshness and vehicle capability with no fabricated availability', () => {
    for (const field of ['recorded_at', 'vehicle_type', 'body_type', 'payload_kg', 'pallets_capacity', 'has_tail_lift']) {
      expect(shared).toContain(field);
    }
    expect(shared).toContain('No published vehicles match this search');
  });
});
