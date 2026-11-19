/// <reference types="vite/client" />
import {describe,it,expect,vi} from 'vitest';
import {persistedStops,syncBoundaryStop} from '../driver-pwa-reserve/src/reserveStopSync';
import type {LiveStop} from '../driver-pwa-reserve/src/liveApi';
const stop={id:'real',sequence:1,type:'collection',address:'QA',status:'pending'} as LiveStop;
const ok=vi.fn(async(id:string,status:string)=>({ok:true,stop:{id,status}}));
describe('Reserve boundary stop synchronisation',()=>{
 it('never persists synthetic legacy stops',()=>{expect(persistedStops('job',[{...stop,id:'job:collection'},stop])).toEqual([stop]);});
 it('walks only missing transitions and requires confirmed server response',async()=>{ok.mockClear();await syncBoundaryStop(stop,'completed',ok,{photoPaths:['verified']});expect(ok.mock.calls.map(c=>c[1])).toEqual(['en_route','arrived','completed']);});
 it('does not repeat completed or already arrived stages',async()=>{ok.mockClear();await syncBoundaryStop({...stop,status:'arrived'},'completed',ok,{photoPaths:['verified']});expect(ok.mock.calls.map(c=>c[1])).toEqual(['completed']);await syncBoundaryStop({...stop,status:'completed'},'completed',ok);expect(ok).toHaveBeenCalledTimes(1);});
 it('fails closed for cancelled, skipped and missing proof',async()=>{ok.mockClear();for(const status of ['cancelled','skipped'] as const)await expect(syncBoundaryStop({...stop,status},'completed',ok,{})).rejects.toThrow('unresolved');await expect(syncBoundaryStop(stop,'completed',ok)).rejects.toThrow('verified evidence');expect(ok).not.toHaveBeenCalled();});
 it('stops the sequence when no transition is confirmed',async()=>{const post=vi.fn(async()=>({ok:false}));await expect(syncBoundaryStop(stop,'completed',post,{})).rejects.toThrow('not confirmed');expect(post).toHaveBeenCalledTimes(1);});
});