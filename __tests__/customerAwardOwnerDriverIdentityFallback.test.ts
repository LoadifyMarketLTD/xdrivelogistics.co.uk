import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { enrichBidderDecisionIdentities } from '../app/api/_lib/bidderDecisionIdentity';

describe('Customer Award Owner Driver identity fallback', () => {
  it('resolves driver, document, vehicle and completed work from bidder user when bidder_driver_id is absent', async () => {
    const rows: Record<string, Record<string, unknown>[]> = {
      drivers: [{ id: 'driver-1', user_id: 'user-1', company_id: 'company-1', display_name: 'Test Driver', driver_type: 'owner_driver', availability_status: 'available', created_at: '2024-01-01' }],
      profiles: [{ user_id: 'user-1', full_name: 'Test Driver', company_id: 'company-1' }],
      companies: [{ id: 'company-1', name: 'Test Driver', xd_id: 'XD-0001', phone: null, company_type: 'owner_driver', created_at: '2024-01-01' }],
      vehicles: [{ id: 'van-1', company_id: 'company-1', assigned_driver_id: 'driver-1', type: 'luton', has_tail_lift: true, pallets_capacity: 4 }],
      driver_documents: [{ driver_id: 'driver-1', doc_type: 'driving_licence', status: 'approved', expiry_date: '2030-01-01' }],
      vehicle_documents: [],
      company_documents: [],
      jobs: [{ assigned_driver_id: 'driver-1', current_status: 'completed' }],
      reviews: [{ reviewed_user_id: 'user-1', rating: 5 }],
    };
    const admin = {
      from(table: string) {
        let selected = rows[table] ?? [];
        const query = {
          select() { return query; },
          in(field: string, ids: string[]) {
            selected = selected.filter(row => ids.includes(String(row[field])));
            return query;
          },
          limit(n: number) { selected = selected.slice(0, n); return query; },
          then(resolve: (result: { data: Record<string, unknown>[]; error: null }) => unknown) {
            return Promise.resolve(resolve({ data: selected, error: null }));
          },
        };
        return query;
      },
    } as unknown as SupabaseClient;

    const result = await enrichBidderDecisionIdentities(admin, [{
      bidId: 'bid-1', userId: 'user-1', driverId: null, companyId: 'company-1',
    }]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      bidId: 'bid-1',
      driverId: 'driver-1',
      driverType: 'owner_driver',
      personName: 'Test Driver',
      driverVehiclePallets: 4,
      completedJobs: 1,
      customerRating: 5,
      verificationUnavailable: false,
    });
    expect(result[0].documentStatuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Driver · driving_licence', status: 'Approved' }),
    ]));
  });
});
