/** Presentation-only grouping. No notification records are deleted or marked read. */
export type NotificationSummaryRow={
 id:string;title:string;body:string|null;type:string|null;read_at:string|null;created_at:string;
};
const repeatable=new Set(['load_alert','marketplace_load_alert','nearby_load_alert']);
export function similarLoadAlertKey(row:NotificationSummaryRow):string|null{
 const type=(row.type??'').trim().toLowerCase();
 if(!repeatable.has(type))return null;
 const title=row.title.trim().toLowerCase();
 const message=(row.body??'').trim().toLowerCase();
 // Only literal repeats on the same date are grouped; distinct job messages remain separate.
 return JSON.stringify([type,title,message,row.created_at.slice(0,10)]);
}
export type GroupedNotification<T extends NotificationSummaryRow>={
 notification:T;key:string|null;count:number;unread:number;representative:boolean;
};
export function groupSimilarLoadAlerts<T extends NotificationSummaryRow>(rows:readonly T[],expanded:ReadonlySet<string>):GroupedNotification<T>[]{
 const counts=new Map<string,{count:number;unread:number}>();
 for(const row of rows){
  const key=similarLoadAlertKey(row);
  if(!key)continue;
  const group=counts.get(key)??{count:0,unread:0};
  group.count+=1;if(!row.read_at)group.unread+=1;counts.set(key,group);
 }
 const seen=new Set<string>();
 const output:GroupedNotification<T>[]=[];
 for(const row of rows){
  const key=similarLoadAlertKey(row);
  const group=key?counts.get(key):null;
  const first=key?!seen.has(key):true;
  if(key)seen.add(key);
  if(key&&!first&&!expanded.has(key))continue;
  output.push({notification:row,key,count:group?.count??1,unread:group?.unread??(!row.read_at?1:0),representative:first});
 }
 return output;
}
