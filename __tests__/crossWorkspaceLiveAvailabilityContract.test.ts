import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read=(relative:string)=>fs.readFileSync(path.join(process.cwd(),relative),'utf8');

describe('cross-workspace Live Availability contract',()=>{
  const api=read('app/api/availability/nearby/route.ts');
  const admin=read('app/admin/live-availability/page.tsx');
  const live=read('app/driver/availability/live/page.tsx');
  const nearby=read('app/driver/nearby/page.tsx');
  const data=read('app/components/workspace/useCompanyWorkspaceData.ts');

  it('supports canonical capability filters server-side while preserving fleet/exchange privacy scopes',()=>{
    for(const term of ['vehicleType','bodyType','minPayloadKg','minPallets','tailLift']) expect(api).toContain(term);
    expect(api).toContain("scope: 'fleet'");
    expect(api).toContain("scope: 'exchange'");
    expect(api).toContain('exact_lat');
    expect(api).toContain('exchange_lat');
    expect(api).toContain('body_type');
  });

  it('gives company workspaces Live/Future/Nearby plus vehicle capability filters and Book Direct',()=>{
    expect(admin).toContain("tab === 'live'");
    expect(admin).toContain("tab === 'future'");
    expect(admin).toContain("tab === 'nearby'");
    expect(admin).toContain('Body type');
    expect(admin).toContain('Min payload (kg)');
    expect(admin).toContain('Min pallets');
    expect(admin).toContain('Tail lift required');
    expect(admin).toContain('Book Direct');
    expect(admin).toContain('matchesAvailabilityFilters');
  });

  it('gives Driver/Owner Driver the same discovery filter vocabulary without leaking commercial actions to employed drivers',()=>{
    for(const source of [live,nearby]){
      expect(source).toContain('Body type');
      expect(source).toContain('Min payload (kg)');
      expect(source).toContain('Min pallets');
      expect(source).toContain('Tail lift required');
      expect(source).toContain('matchesAvailabilityFilters');
    }
    expect(nearby).toContain('user?.canCommercialBid === true');
    expect(nearby).toContain('Book Direct');
  });

  it('loads body/capacity fields in the shared company vehicle dataset',()=>{
    expect(data).toContain('pallets_capacity?: number | null');
    expect(data).toContain('body_type?: string | null');
    expect(data).toContain('pallets_capacity, body_type');
  });
});
