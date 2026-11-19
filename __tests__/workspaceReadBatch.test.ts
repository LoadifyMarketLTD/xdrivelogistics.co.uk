import {describe,it,expect} from 'vitest';
import {runWorkspaceReadBatch} from '../app/components/workspace/workspaceReadBatch';
describe('bounded independent workspace reads',()=>{
 it('runs concurrent reads but never exceeds three, and waits for completion',async()=>{let active=0,max=0;const done:number[]=[];let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve});const batch=runWorkspaceReadBatch(Array.from({length:5},(_,i)=>({run:async()=>{active++;max=Math.max(max,active);await gate;active--;done.push(i)},onError:()=>{throw Error('Unexpected failure')}})));expect(active).toBe(3);release();await batch;expect(max).toBe(3);expect(done.sort()).toEqual([0,1,2,3,4])});
 it('reports a rejected read without suppressing independent successful reads',async()=>{const errors:unknown[]=[];const completions:string[]=[];await runWorkspaceReadBatch([{run:async()=>{throw Error('network')},onError:e=>errors.push(e)},{run:async()=>{completions.push('vehicles')},onError:e=>errors.push(e)}]);expect(errors).toHaveLength(1);expect(completions).toEqual(['vehicles'])});
 it('handles an empty set without issuing a read',async()=>{await expect(runWorkspaceReadBatch([])).resolves.toBeUndefined()});
});
