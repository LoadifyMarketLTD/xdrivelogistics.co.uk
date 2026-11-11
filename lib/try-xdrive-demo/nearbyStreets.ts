// Demo-only approximate street suggestions from OpenStreetMap; not a postal address directory.
const cache = new Map<string,{until:number;items:string[]}>();
export async function nearbyStreets(postcode:string):Promise<string[]>{
 const key=postcode.toUpperCase().trim();
 const hit=cache.get(key);if(hit&&hit.until>Date.now())return hit.items;
 try{
  const p=await fetch('https://api.postcodes.io/postcodes/'+encodeURIComponent(key),{signal:AbortSignal.timeout(5000),cache:'no-store'});
  if(!p.ok)return [];
  const result=await p.json() as {result?:{latitude?:number;longitude?:number}};
  const lat=result.result?.latitude,lon=result.result?.longitude;
  if(typeof lat!=='number'||typeof lon!=='number')return [];
  const query='[out:json][timeout:8];way(around:450,'+lat+','+lon+')[highway][name];out tags;';
  const r=await fetch('https://overpass.osm.ch/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'XDriveLogistics-Demo/1.0 (support@xdrivelogistics.co.uk)'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(11000),cache:'no-store'});
  if(!r.ok)return [];
  const data=await r.json() as {elements?:{tags?:{name?:string;highway?:string}}[]};
  const excluded=new Set(['motorway','motorway_link','trunk','trunk_link','path','footway','cycleway','steps']);
  const items=[...new Set((data.elements||[]).filter(e=>!excluded.has(e.tags?.highway||'')).map(e=>e.tags?.name?.trim()||'').filter(n=>n.length>=3&&n.length<=100))].sort().slice(0,35);
  if(cache.size>300)cache.clear();
  cache.set(key,{until:Date.now()+3600000,items});
  return items;
 }catch{return [];}
}
