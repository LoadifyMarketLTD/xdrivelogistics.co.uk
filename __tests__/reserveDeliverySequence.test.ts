import {describe,it,expect,vi} from 'vitest';
import {finishReserveDelivery} from '../driver-pwa-reserve/src/reserveDeliverySequence';
import type {LiveJob} from '../driver-pwa-reserve/src/liveApi';
const job={id:'job',backendStatus:'on_site_delivery',routeStops:[{id:'job:collection',type:'collection',status:'pending'},{id:'job:delivery',type:'delivery',status:'pending'}]} as LiveJob;
function make(overrides:Partial<LiveJob>={},partial=false){
 const calls:string[]=[];
 return {calls,ops:{read:vi.fn(async()=>{calls.push('read');return {job:{...job,...overrides},partial};}),upload:vi.fn(async()=>{calls.push('upload');return {photos:['test-evidence'],documents:[]};}),delivered:vi.fn(async()=>{calls.push('delivered');}),onDelivered:vi.fn(()=>{calls.push('ui-delivered');}),archive:vi.fn(async()=>{calls.push('pod');return {ok:true};}),verify:vi.fn(async()=>{calls.push('verify');return true;})}};
}
describe('Reserve canonical final delivery',()=>{
 it('reads real stage, saves evidence, transitions, archives and verifies in order',async()=>{const t=make();await finishReserveDelivery('job',t.ops);expect(t.calls).toEqual(['read','upload','delivered','ui-delivered','pod','verify']);});
 it('never uploads evidence when server status is already delivered',async()=>{const t=make({backendStatus:'delivered'});await expect(finishReserveDelivery('job',t.ops)).rejects.toThrow('Server must confirm');expect(t.calls).toEqual(['read']);});
 it('does not transition incomplete persisted routes or partial route data',async()=>{const t=make({routeStops:[{id:'persisted',type:'collection',sequence:1,address:'QA',status:'pending'}]});await expect(finishReserveDelivery('job',t.ops)).rejects.toThrow('Complete all persisted');expect(t.calls).toEqual(['read']);const p=make({},true);await expect(finishReserveDelivery('job',p.ops)).rejects.toThrow('Route stops');expect(p.calls).toEqual(['read']);});
 it('does not transition without verified delivery evidence',async()=>{const t=make();t.ops.upload.mockResolvedValue({photos:[],documents:[]});await expect(finishReserveDelivery('job',t.ops)).rejects.toThrow('verified delivery photo');expect(t.ops.delivered).not.toHaveBeenCalled();});
 it('does not archive when canonical delivered transition fails',async()=>{const t=make();t.ops.delivered.mockRejectedValue(new Error('rejected'));await expect(finishReserveDelivery('job',t.ops)).rejects.toThrow('rejected');expect(t.ops.archive).not.toHaveBeenCalled();});
 it('does not report success until the server confirms archived POD',async()=>{const t=make();t.ops.verify.mockResolvedValue(false);await expect(finishReserveDelivery('job',t.ops)).rejects.toThrow('POD has not yet');expect(t.ops.onDelivered).toHaveBeenCalled();});
});