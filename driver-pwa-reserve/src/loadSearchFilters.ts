// Pure search contract recovered from Fresh Loads; no booking or quote mutations.
export const VEHICLE_SIZES = ['Motorcycle','Car','Small Van','Midi Van','SWB up to 2.4m','MWB up to 3m','LWB up to 4m','XLWB 4m+','Luton','7.5T','12T','18T','26T','13.6M (Artic)','Skellie 1x20ft','Skellie 2x20ft','Skellie 1x40ft','Skellie 1x44ft','4 Axle Tractor','6 Axle Tractor'] as const;
export const SEARCH_RADII = [10,30,50,100,200,300] as const;
export const BODY_TYPES = ['Box','Curtain Side','Flatbed','Refrigerated','Luton'] as const;
export const FREIGHT_TYPES = ['Direct','Timed','Return','Documents','Parcels','Pallets','Machinery','Furniture','Retail Goods','Mixed Freight','ADR Goods','Temperature Controlled Freight','Equipment','Other'] as const;
export type SearchFilters = {mode:'current'|'select'|'vehicle'; location:string; radius:string; from:string; to:string; body:string; date:'any'|'ten'|'today'|'tomorrow'|'custom'; start:string; end:string; freight:string; member:string; destination:string; destinationRadius:string; collectWithin:string};
export const defaults = ():SearchFilters => ({mode:'current',location:'',radius:'30',from:VEHICLE_SIZES[0],to:VEHICLE_SIZES[19],body:'',date:'any',start:'',end:'',freight:'',member:'',destination:'',destinationRadius:'',collectWithin:''});
const norm=(v:unknown)=>String(v??'').trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
export function vehicleRank(value:unknown):number {
 const v=norm(value);
 const known=VEHICLE_SIZES.findIndex(s=>norm(s)===v);if(known>=0)return known;
 if(/\b(skellie|skeletal)\b/.test(v)){const size=v.replace(/\s/g,'');const index=['1x20','2x20','1x40','1x44'].findIndex(x=>size.includes(x));return index<0?-1:index+14;}
 const pairs:[RegExp,number][]=[[/\b6 axle\b/,19],[/\b4 axle\b/,18],[/\b(artic|13\.6m)\b/,13],[/\b26\s*t\b/,12],[/\b18\s*t\b/,11],[/\b12\s*t\b/,10],[/\b7[. ]5\s*t\b/,9],[/\bluton\b/,8],[/\bxlwb\b/,7],[/\blwb\b/,6],[/\bmwb\b/,5],[/\bswb\b/,4],[/\b(midi van|van midi)\b/,3],[/\b(small van|van small)\b/,2],[/^car$/,1],[/\b(motorcycle|motorbike)\b/,0]];
 return pairs.find(([r])=>r.test(v))?.[1]??-1;
}
export type SearchLoad={id:string;from:string;to:string;fromOutcode?:string;toOutcode?:string;vehicle:string;company?:string;companyPublicId?:string;service?:string;marketSearch?:{pickupAt?:string;vehicleType?:string;vehicleLabel?:string;cargo?:string;cargoLabel?:string;body?:string;loadType?:string}};
export type Point={lat:number;lng:number};
export const londonDay=(v:Date)=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(v).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;};
const shift=(day:string,n:number)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export function validation(f:SearchFilters):string {
 const a=VEHICLE_SIZES.indexOf(f.from as typeof VEHICLE_SIZES[number]),b=VEHICLE_SIZES.indexOf(f.to as typeof VEHICLE_SIZES[number]);
 if(a<0||b<0||a>b)return 'Choose a valid vehicle size range.';
 if(!SEARCH_RADII.includes(Number(f.radius) as typeof SEARCH_RADII[number]))return 'Choose a valid search radius.';
 if(f.mode==='select'&&!f.location.trim())return 'Enter a UK postcode or outcode.';
 if(f.date==='custom'&&(!f.start||!f.end||f.start>f.end))return 'Choose a valid date range.';
 if(f.destinationRadius&&!f.destination.trim())return 'Enter a destination postcode or outcode.';
 return '';
}
export function matchesLoad(j:SearchLoad,f:SearchFilters,now=new Date()):boolean {
 const m=j.marketSearch;const a=VEHICLE_SIZES.indexOf(f.from as typeof VEHICLE_SIZES[number]),b=VEHICLE_SIZES.indexOf(f.to as typeof VEHICLE_SIZES[number]);
 const rank=[m?.vehicleLabel,m?.vehicleType,j.vehicle].map(vehicleRank).find(x=>x>=0)??-1;
 if((a>0||b<19)&&(rank<0||rank<a||rank>b))return false;
 if(f.member&&!norm([j.company,j.companyPublicId].join(' ')).includes(norm(f.member)))return false;
 if(f.body){const v=norm([m?.body,m?.vehicleType,m?.vehicleLabel,j.vehicle].join(' '));const aliases:Record<string,RegExp>={'Box':/\bbox\b/,'Curtain Side':/curtain\s*side|curtainsider/,'Flatbed':/flatbed/,'Refrigerated':/refrigerated|temperature controlled/,'Luton':/luton/};if(!aliases[f.body]?.test(v))return false;}
 if(f.freight){const v=norm(f.freight);const values=[j.service,m?.loadType,m?.cargo,m?.cargoLabel].map(norm);const service=norm(j.service);const direct=v==='direct'&&['asap direct','timed direct','direct'].includes(service);const timed=v==='timed'&&service==='timed direct';if(!values.includes(v)&&!direct&&!timed&&!(v==='parcels'&&values.includes('packages')))return false;}
 const pickup=new Date(m?.pickupAt||'');const valid=Number.isFinite(pickup.getTime());
 if(valid&&pickup<now)return false;
 if(f.date!=='any'||f.collectWithin){if(!valid)return false;const p=londonDay(pickup),t=londonDay(now);if(f.date==='today'&&p!==t)return false;if(f.date==='tomorrow'&&p!==shift(t,1))return false;if(f.date==='ten'&&(p<t||p>shift(t,10)))return false;if(f.date==='custom'&&(p<f.start||p>f.end))return false;if(f.collectWithin&&pickup.getTime()>now.getTime()+Number(f.collectWithin)*60000)return false;}
 if(f.destination&&!f.destinationRadius&&!norm([j.to,j.toOutcode].join(' ')).includes(norm(f.destination)))return false;
 return true;
}
export function restoredFilters(raw:string|null):SearchFilters {const base=defaults();try{const v=JSON.parse(raw||'null');if(!v||typeof v!=='object')return base;for(const k of Object.keys(base) as (keyof SearchFilters)[]){if(typeof v[k]==='string')Object.assign(base,{[k]:v[k]});}if(!['current','select','vehicle'].includes(base.mode)||!['any','ten','today','tomorrow','custom'].includes(base.date)||validation({...base,location:base.location||'BB1',destination:base.destination||'BB1'}))return defaults();return base;}catch{return base;}}
