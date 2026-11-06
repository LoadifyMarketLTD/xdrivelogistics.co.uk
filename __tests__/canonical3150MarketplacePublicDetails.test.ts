import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const source=readFileSync(join(process.cwd(),'app/components/workspace/CompanyMarketplaceExchange.tsx'),'utf8');
describe('approved 3150 View Details uses real public marketplace load',()=>{
 it('opens the canonical 3150 detail dialog instead of expanding the old card',()=>{
   expect(source).toContain('onClick={() => setDetailsTarget(load)}>View Details</button>');
   expect(source).toContain('<Canonical3150TransportSummary');
   expect(source).toContain('role="dialog" aria-modal="true"');
   expect(source).toContain('onClick={() => setDetailsTarget(null)}');
 });
 it('shows data fields from actual marketplace payload without example records',()=>{
   for(const field of ['detailsTarget.posterName','detailsTarget.pickup_datetime','detailsTarget.delivery_datetime','detailsTarget.pallets','detailsTarget.weight_kg','detailsTarget.payment_terms'])
     expect(source).toContain(field);
   expect(source).not.toContain('detailsTarget.budget_amount');
   expect(source).not.toContain('reference={detailsTarget.booking_reference');
 });
 it('never reveals full pickup/delivery postcodes or contacts before award',()=>{
   expect(source).toContain('formatPublicOutcode(detailsTarget.pickup_postcode)');
   expect(source).toContain('formatPublicOutcode(detailsTarget.delivery_postcode)');
   expect(source).toContain('Available only to authorised parties after award');
 });
});