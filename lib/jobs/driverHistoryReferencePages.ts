export type RefRow = {id:string;your_ref?:string|null;customer_reference?:string|null;booking_reference?:string|null};
export const referenceMatches = (row:RefRow, needle:string) => [row.id,row.your_ref,row.customer_reference,row.booking_reference].some(value=>typeof value==='string' && value.toLowerCase().includes(needle.toLowerCase()));
export async function findDriverHistoryReferences<T extends RefRow>(
  driverId:string, needle:string,
  page:(driverId:string,offset:number,count:number)=>Promise<{data:T[]|null;error:unknown}>,
  pageSize=200,
):Promise<T[]> {
  if(!driverId || !needle.trim()) return [];
  const matches=new Map<string,T>();
  let offset=0;
  while(true){
    const {data,error}=await page(driverId,offset,pageSize);
    if(error) throw error;
    const rows=data??[];
    for(const row of rows) if(referenceMatches(row,needle.trim())) matches.set(row.id,row);
    if(rows.length<pageSize) break;
    offset+=pageSize;
  }
  return [...matches.values()];
}
