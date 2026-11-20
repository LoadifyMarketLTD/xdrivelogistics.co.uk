export const PACKAGING_OPTIONS=['Pallets','Boxes','Crates','Loose items','Roll cages','Other'] as const;
export function packagingOptions(value:string){return value&&!PACKAGING_OPTIONS.some(p=>p===value)?[...PACKAGING_OPTIONS,value]:[...PACKAGING_OPTIONS];}
export function localMinute(value:number|Date=Date.now()){const d=new Date(value);const p=(n:number)=>String(n).padStart(2,'0');return Number.isFinite(d.getTime())?d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes()):'';}
export function latestRecordedMinute(values:unknown[]){const valid=values.filter((v):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))).map(v=>Date.parse(v));return valid.length?localMinute(Math.max(...valid)):'';}
export function availableTimes(day:string,lower='',upper='',step=15,strictLower=false){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return [];
 return Array.from({length:Math.ceil(1440/step)},(_,i)=>{const n=i*step;return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}).filter(t=>{const dt=day+'T'+t;return (!lower||(strictLower?dt>lower:dt>=lower))&&(!upper||dt<=upper)&&localMinute(new Date(dt))===dt;});
}
export function validActualTime(date:string,time:string,lower:string,now=localMinute()){const dt=date+'T'+time;return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dt)&&localMinute(new Date(dt))===dt&&(!lower||dt>=lower)&&dt<=now;}