import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
const source=readFileSync('app/driver-pwa-fresh/jobs/LoadsClient.tsx','utf8');
describe('approved driver PWA 30-mile default',()=>{
 it('starts at 30 miles',()=>expect(source).toContain("const [pickupRadius, setPickupRadius] = useState('30')"));
 it('CLEAR restores 30 miles',()=>expect(source).toContain("setPickupRadius('30')"));
 it('30 miles does not count as a modified filter',()=>expect(source).toContain("pickupRadius!=='30'?pickupRadius:''"));
 it('preserves user-saved filter preferences',()=>expect(source).toContain("restore('pickupRadius',setPickupRadius)"));
 it('does not reintroduce the old 10-mile default',()=>{expect(source).not.toContain("useState('10')");expect(source).not.toContain("setPickupRadius('10')");});
});
