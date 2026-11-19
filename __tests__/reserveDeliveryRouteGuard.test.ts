import {describe,it,expect} from 'vitest';
import {deliveryRouteBlocker} from '../lib/jobs/deliveryRouteGuard';
const collection={sequence:1,stop_type:'collection',status:'completed',handover:{version:3}};
const delivery={sequence:2,stop_type:'delivery',status:'completed',handover:{version:3}};
describe('Normal delivery cannot consume return or unresolved custody proof',()=>{
 it('accepts verified standard multi-stop route in any order',()=>expect(deliveryRouteBlocker([delivery,collection],true)).toBeNull());
 it('blocks return and redirected stops even when completed',()=>{for(const stopKind of ['return','redirect']) expect(deliveryRouteBlocker([collection,{...delivery,handover:{stopKind}}])).toMatch(/separate authorised resolution/);});
 it('blocks unresolved custody or exceptions',()=>{expect(deliveryRouteBlocker([collection,{...delivery,handover:{returnInstruction:{resolutionRequired:true}}}])).toMatch(/custody/);expect(deliveryRouteBlocker([collection,{...delivery,handover:{version:3,exception:{outcome:'Delivery Refused'}}}])).toMatch(/resolve/);});
 it('blocks final collection, skipped or cancelled stops in modern routes',()=>{expect(deliveryRouteBlocker([collection,{...delivery,stop_type:'collection'}])).toMatch(/not a delivery/);for(const status of ['skipped','cancelled','pending'])expect(deliveryRouteBlocker([collection,{...delivery,status}])).toMatch(/resolve/);});
 it('rejects empty test route and duplicate sequence, preserves legacy compatibility',()=>{expect(deliveryRouteBlocker([],true)).toMatch(/verified/);expect(deliveryRouteBlocker([collection,{...delivery,sequence:1}])).toMatch(/sequence/);expect(deliveryRouteBlocker([{status:'skipped'}])).toBeNull();});
});