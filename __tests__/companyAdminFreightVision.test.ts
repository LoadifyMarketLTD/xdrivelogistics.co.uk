import {describe,it,expect} from 'vitest';
import {hasFreshFreightPosition,freightReferenceMatches,freightDeliveryTargetPassed} from '../app/components/workspace/companyAdminFreightVision';
import type {WorkspaceJob} from '../app/components/workspace/useCompanyWorkspaceData';
const now=Date.parse('2026-11-19T17:00:00Z');
const position={lat:53.7,lng:-2.5,recorded_at:'2026-11-19T16:50:00Z',updated_at:null};
const job={id:'uid-123',booking_reference:'XD-123',customer_reference:'C-456',load_reference:'L-789',status:'in_transit',delivery_datetime:'2026-11-19T16:00:00Z'} as WorkspaceJob;
describe('Company Admin freight tracking accuracy',()=>{
 it('requires real fresh coordinates, valid timestamp, and rejects future timestamps',()=>{expect(hasFreshFreightPosition(position,now)).toBe(true);expect(hasFreshFreightPosition({...position,recorded_at:'2026-11-19T16:39:59Z'},now)).toBe(false);expect(hasFreshFreightPosition({...position,recorded_at:'2026-11-19T17:01:00Z'},now)).toBe(false);expect(hasFreshFreightPosition({...position,lat:91},now)).toBe(false);expect(hasFreshFreightPosition(null,now)).toBe(false)});
 it('finds all established references without generating or replacing them',()=>{for(const q of ['xd-123',' C-456 ','L-789','uid-123',''])expect(freightReferenceMatches(job,q)).toBe(true);expect(freightReferenceMatches(job,'unknown')).toBe(false)});
 it('detects overdue delivery regardless of missing telemetry',()=>{expect(freightDeliveryTargetPassed(job,now)).toBe(true);expect(freightDeliveryTargetPassed({...job,status:'on_site_delivery'},now)).toBe(false);expect(freightDeliveryTargetPassed({...job,delivery_datetime:null},now)).toBe(false)});
});
