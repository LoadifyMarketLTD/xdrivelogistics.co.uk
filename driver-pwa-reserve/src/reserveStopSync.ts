import type {LiveStop} from './liveApi';
type StopAction = 'en_route'|'arrived'|'completed';
type StopProof = Record<string,unknown>;
type StopOperation = (id:string,action:StopAction,proof?:StopProof)=>Promise<unknown>;
export function persistedStops(jobId:string,stops:LiveStop[]=[]){
 return stops.filter(s=>s.id!==jobId+':'+s.type).sort((a,b)=>a.sequence-b.sequence);
}

/** Include the final persisted delivery of a modern multistop route.
 * Legacy synthetic boundary stops retain their existing handling. */
export function operationalExecutionStops(jobId:string,stops:LiveStop[]=[],isTest=false):LiveStop[]{
 const final=stops.at(-1);
 const dynamic=final?.handover?.stopKind==='return'||final?.handover?.stopKind==='redirect';
 if(stops.length<=2)return dynamic?stops.slice(1):[];
 const modern=stops.some(stop=>stop.handover?.version===3);
 const realFinal=Boolean(final&&persistedStops(jobId,[final]).length===1);
 return stops.slice(1,dynamic||(realFinal&&(isTest||modern))?undefined:-1);
}
export async function syncBoundaryStop(stop:LiveStop,target:StopAction,post:StopOperation,proof?:StopProof){
 const stages=['pending','en_route','arrived','completed'] as const;
 let at=stages.findIndex(x=>x===stop.status);
 const end=stages.indexOf(target);
 if(at<0||end<0)throw new Error('Stop has an unresolved cancellation or legacy status.');
 if(end===3&&!proof&&at<end)throw new Error('Stop completion requires verified evidence.');
 while(at<end){const action=stages[at+1] as StopAction;
  const result=await post(stop.id,action,action==='completed'?proof:undefined);
  const row=result&&typeof result==='object'?(result as {ok?:boolean;stop?:{id?:string;status?:string}}):{};
  if(row.ok!==true||row.stop?.id!==stop.id||row.stop.status!==action)throw new Error('Stop transition was not confirmed by the server.');
  at++;
 }
}