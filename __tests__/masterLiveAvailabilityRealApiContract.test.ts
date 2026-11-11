import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const master = read('app/try-xdrive-demo/components/OperationsDemo.tsx');
const page = read('app/components/workspace/MemberLiveAvailabilityPage.tsx');
const api = read('app/api/availability/nearby/route.ts');

describe('Master live availability uses verified Exchange presence', () => {
  it('opens live role-appropriate pages, not DemoLiveAvailability', () => {
    expect(master).toContain('if(authenticated && i===11)');
    expect(master).toContain("'/driver/availability/live'");
    expect(master).toContain("role==='Customer'?'/customer/live-availability':role==='Broker'?'/broker/live-availability':'/admin/live-availability'");
    expect(read('app/customer/live-availability/page.tsx')).toContain('MemberLiveAvailabilityPage');
    expect(read('app/broker/live-availability/page.tsx')).toContain('MemberLiveAvailabilityPage');
    expect(read('app/broker/live-availability/page.tsx')).toContain("allowedRoles={['broker']}");
    expect(read('app/customer/CustomerMasterLayoutGate.tsx')).toContain('customerMasterTab(pathname)');
    expect(read('lib/masterWorkspaceRouteTab.ts')).toContain("'live-availability':11");
  });
  it('loads the authoritative published availability endpoint with a verified session', () => {
    expect(page).toContain('supabase.auth.getSession()');
    expect(page).toContain("scope:'exchange'");
    expect(page).toContain('/api/availability/nearby?');
    expect(page).toContain('Authorization: `Bearer ${token}`');
    expect(page).toContain("cache:'no-store'");
    expect(page).toContain("position.scope === 'exchange'");
    expect(page).not.toContain('sample =');
  });
  it('the API applies active membership, privacy, and freshness constraints', () => {
    expect(api).toContain(".eq('status', 'active')");
    expect(api).toContain("if (ownCompanies.size === 0)");
    expect(api).toContain(".from('driver_availability_presence')");
    expect(api).toContain('AVAILABILITY_LOCATION_MAX_AGE_MS');
    expect(api).toContain("position.scope !== requestedScope");
    expect(api).toContain('exchange_lat');
    expect(api).toContain("never the driver's identity or exact position");
  });
  it('never presents zero as verified on an API failure', () => {
    expect(page).toContain("error ? 'Unavailable' : loading ? 'Loading...' : positions.length");
    expect(page).toContain('setPositions([])');
    expect(page).toContain("title={loading ? 'Checking live availability' : error ? 'Availability unavailable' : 'No published vehicles available'}");
  });
});
