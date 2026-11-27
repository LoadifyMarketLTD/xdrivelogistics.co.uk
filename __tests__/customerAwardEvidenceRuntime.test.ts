import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { enrichBidderDecisionIdentities } from '../app/api/_lib/bidderDecisionIdentity';

type Row = Record<string, unknown>;
function mockAdmin(data: Record<string, Row[]>) {
  return {
    from(table: string) {
      let rows = [...(data[table] ?? [])];
      const query = {
        select(_columns: string) { return query; },
        in(column: string, values: unknown[]) { rows = rows.filter((row) => values.includes(row[column])); return query; },
        limit(max: number) { rows = rows.slice(0, max); return query; },
        then(onOk: (result: { data: Row[]; error: null }) => unknown, onError?: (error: unknown) => unknown) {
          return Promise.resolve({ data: rows, error: null }).then(onOk, onError);
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
}

describe('real carrier enrichment feeding the Customer Award page', () => {
  it('preserves owner-driver identity even with a company-linked bid and supplies audited compliance', async () => {
    const admin = mockAdmin({
      drivers: [{ id:'driver1', company_id:'company1', display_name:'Test Owner Driver', driver_type:'owner_driver', availability_status:'available', created_at:'2025-01-01T00:00:00Z', user_id:'user1' }],
      profiles: [{ user_id:'user1', company_id:'company1', full_name:'Test Owner Driver' }],
      companies: [{ id:'company1', name:'Example Transport Ltd', company_type:'carrier', xd_id:'XD-EXAMPLE', phone:null, created_at:'2024-01-01T00:00:00Z' }],
      vehicles: [{ id:'vehicle1', company_id:'company1', assigned_driver_id:'driver1', type:'luton_tail_lift', has_tail_lift:true, pallets_capacity:6 }],
      driver_documents: [
        {driver_id:'driver1', doc_type:'Driving Licence', status:'approved', expiry_date:'2029-11-29'},
        {driver_id:'driver1', doc_type:'Insurance', status:'approved', expiry_date:'2027-09-12'},
      ],
      vehicle_documents: [{vehicle_id:'vehicle1', doc_type:'mot', status:'approved', expiry_date:'2027-04-15'}],
      company_documents: [{company_id:'company1', doc_type:'public_liability', status:'approved', expiry_date:'2027-08-01'}],
      jobs: [{assigned_driver_id:'driver1', current_status:'completed'}, {assigned_driver_id:'driver1', current_status:'posted'}],
      reviews: [{ reviewed_user_id:'user1', rating:5 }, {reviewed_user_id:'user1', rating:4}],
    });
    const result = await enrichBidderDecisionIdentities(admin,[{bidId:'bid1',companyId:'company1',driverId:'driver1',userId:'user1'}]);
    expect(result).toHaveLength(1);
    const candidate = result[0];
    expect(candidate.driverType).toBe('owner_driver');
    expect(candidate.companyId).toBe('company1');
    expect(candidate.memberSince).toBe('2025-01-01T00:00:00Z');
    expect(candidate.completedJobs).toBe(1);
    expect(candidate.customerRating).toBe(4.5);
    expect(candidate.driverVehiclePallets).toBe(6);
    expect(candidate.documentStatuses).toContainEqual({name:'Driver · Driving Licence',status:'Approved',expiryDate:'2029-11-29'});
    expect(candidate.documentStatuses).toContainEqual({name:'Vehicle · mot',status:'Approved',expiryDate:'2027-04-15'});
    expect(candidate.documentStatuses).toContainEqual({name:'Company · public_liability',status:'Approved',expiryDate:'2027-08-01'});
  });
});