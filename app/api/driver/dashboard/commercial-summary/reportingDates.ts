const formatter = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function londonDate(d: Date): string {
  const p = Object.fromEntries(formatter.formatToParts(d).map(x=>[x.type,x.value]));
  return [p.year,p.month,p.day].join('-');
}
export function shiftDate(value: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const d = new Date(value+'T00:00:00.000Z');
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10)!==value) return '';
  d.setUTCDate(d.getUTCDate()+days);
  return d.toISOString().slice(0,10);
}
export function londonMidnight(value: string): Date | null {
  if (!shiftDate(value,0)) return null;
  const utc = new Date(value+'T00:00:00.000Z');
  let t=utc.getTime();
  for(let i=0;i<3;i++){
    const p=Object.fromEntries(formatter.formatToParts(new Date(t)).map(x=>[x.type,x.value]));
    const displayed=Date.parse(p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':'+p.second+'.000Z');
    const delta=utc.getTime()-displayed;
    if(delta===0)return new Date(t);
    t+=delta;
  }
  return null;
}
export function reportingStart(period: string, now: Date): string | null {
  const days=period==='today'?0:period==='7d'?-7:period==='30d'?-30:null;
  return days===null?null:londonMidnight(shiftDate(londonDate(now),days))?.toISOString()??null;
}
