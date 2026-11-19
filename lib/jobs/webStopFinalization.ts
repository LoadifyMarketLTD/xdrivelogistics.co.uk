export type WebStopRow = { sequence: number; stop_type: string; status: string | null; arrived_at?: string | null; completed_at?: string | null; handover?: unknown };
export type WebStopFinalization = { kind: 'direct' | 'multi_stop' | 'unverified'; ready: boolean; remainingStops: number };
const directModes = new Set(['asap_direct','timed_direct','coload_permitted','flexible']);
const terminal = new Set(['completed','skipped']);
const statusOf = (stop: WebStopRow) => String(stop.status ?? '').trim().toLowerCase();

/** The job lifecycle is authoritative for a verified, unstarted standard direct route.
 * Real per-stop execution is never bypassed, even when the booking mode is direct. */
export function evaluateWebStopFinalization(serviceMode: unknown, stops: readonly WebStopRow[]): WebStopFinalization {
  const mode = typeof serviceMode === 'string' ? serviceMode.trim().toLowerCase() : '';
  const remainingStops = stops.filter(stop => !terminal.has(statusOf(stop))).length;
  const unverified = { kind:'unverified', ready:false, remainingStops } as const;
  const recognizedDirect = directModes.has(mode);
  const ordered = [...stops].sort((a,b)=>a.sequence-b.sequence);
  if (ordered.length === 0) return recognizedDirect || !mode ? {kind:'direct',ready:true,remainingStops:0} : unverified;
  if (ordered.length < 2 || ordered.some((stop,index)=>stop.sequence!==index+1 || !['collection','delivery'].includes(stop.stop_type) || !['pending','arrived','completed','skipped'].includes(statusOf(stop))) || ordered[0].stop_type!=='collection' || ordered[ordered.length-1].stop_type!=='delivery') return unverified;
  const standard = ordered.length === 2 && ordered[0].stop_type==='collection' && ordered[1].stop_type==='delivery';
  if (mode==='multi_drop' && standard) return unverified;
  const unstarted = ordered.every(stop=>statusOf(stop)==='pending' && !stop.arrived_at && !stop.completed_at && stop.handover==null);
  if (recognizedDirect && standard && (unstarted || remainingStops===0)) return {kind:'direct',ready:true,remainingStops:0};
  return {kind:'multi_stop',ready:remainingStops===0,remainingStops};
}
