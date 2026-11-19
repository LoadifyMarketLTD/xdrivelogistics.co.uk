type Snapshot={tracking_active?:boolean;fresh?:boolean;location?:{lat?:number|null;lng?:number|null;recorded_at?:string|null}|null};
export function verifiedLiveTracking(snapshot:Snapshot|undefined):boolean{
 const p=snapshot?.location;
 return snapshot?.tracking_active===true&&snapshot.fresh===true&&typeof p?.lat==='number'&&Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&typeof p.lng==='number'&&Number.isFinite(p.lng)&&Math.abs(p.lng)<=180&&typeof p.recorded_at==='string'&&Number.isFinite(Date.parse(p.recorded_at));
}
