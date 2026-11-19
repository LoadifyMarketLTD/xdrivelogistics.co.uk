type RouteStop={sequence?:number|null;stop_type?:string|null;status?:string|null;handover?:unknown};
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
// This is a document/lifecycle boundary, not permission to mutate a route.
export function deliveryRouteBlocker(stops:RouteStop[],strict=false):string|null{
 const route=[...stops].sort((a,b)=>Number(a.sequence)-Number(b.sequence));
 if(route.some(s=>{
  const h=object(s.handover);
  return h.stopKind==='return'||h.stopKind==='redirect'||object(h.returnInstruction).resolutionRequired===true;
 }))return 'Goods return, redirection or unresolved custody requires a separate authorised resolution; normal delivery POD is not available.';
 const modern=strict||route.some(s=>object(s.handover).version===3);
 if(!modern)return route.some(s=>!['completed','skipped'].includes(String(s.status??'pending').toLowerCase()))?'Complete all multi-drop stops before capturing POD or marking the job delivered.':null;
 if(!route.length)return 'The test booking route could not be verified.';
 if(route.some(s=>!Number.isInteger(s.sequence)||Number(s.sequence)<1)||new Set(route.map(s=>s.sequence)).size!==route.length)return 'Route stop sequence is invalid.';
 if(route.at(-1)?.stop_type!=='delivery')return 'The final operation is not a delivery; normal delivery POD is not available.';
 if(route.some(s=>s.status!=='completed'||Boolean(object(s.handover).exception)))return 'Complete and resolve all route stops before capturing delivery POD.';
 return null;
}