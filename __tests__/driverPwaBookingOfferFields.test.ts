import {describe,it,expect} from 'vitest';
import {getLoadDetailSections} from '../lib/loadPostingDetails';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

describe('awarded booking detail presentation',()=>{
 it('uses the canonical optional cargo/contact/handling parser rather than synthetic values',()=>{
  const parsed=getLoadDetailSections({load_details:JSON.stringify({
   collection:{contactName:'Demo Shipper',forkliftAvailable:true},
   delivery:{contactName:'Demo Receiver',handballRequired:false},
   dimensionsCm:{length:120,width:80,height:100},
   palletDetails:{count:2,type:'Euro'},
  })});
  const all=parsed.flatMap(section=>section.items).map(item=>item.label+': '+item.value).join(' | ');
  expect(all).toContain('Collection contact: Demo Shipper');
  expect(all).toContain('Delivery contact: Demo Receiver');
  expect(all).toContain('Pallets: 2');
  expect(all).toContain('Dimensions: 120 x 80 x 100 cm');
  expect(all).toContain('Delivery handball: No');
  expect(all).not.toContain('Weight:');
 });
 it('wires field rendering to existing auth-scoped booking offers, not local demo state',()=>{
  const source=readFileSync(join(process.cwd(),'app/driver-pwa-fresh/booking-offers/page.tsx'),'utf8');
  expect(source).toContain('getLoadDetailSections');
  expect(source).toContain('fresh-offer-additional');
  expect(source).toContain('Accept Job');
  expect(source).toContain('Decline Job');
  expect(source).not.toContain('xd-demo-exchange');
 });
});
