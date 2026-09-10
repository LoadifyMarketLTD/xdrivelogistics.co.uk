export const lightPalette = {
  background: '#F1F3F6', surface: '#FFFFFF', raised: '#E6EDF5', text: '#172033',
  muted: '#475569', border: '#CBD5E1', brand: '#0B2F6B', accent: '#F5A300',
};
export const darkPalette = {
  background: '#090F1A', surface: '#182231', raised: '#223044', text: '#F8FAFC',
  muted: '#CBD5E1', border: '#64748B', brand: '#0B2F6B', accent: '#F5A300',
};
export type Palette = typeof lightPalette;
const pages = new Set(['#8B8B8B', '#EEF2F6', '#EEF3F9', '#F1F3F6', '#F3F4F6', '#F7F7F7']);
const muted = new Set(['#B8B8B8','#8A8A8A','#5B6472','#5F6878','#64748B','#747B8B','#667085','#7A8493','#596579','#526071','#626262','#475569','#3F4A5A','#344054','#334155','#536174']);
function rgb(value: string) {
  let h = value.toUpperCase();
  if (/^#[0-9A-F]{3}$/.test(h)) h = '#' + [...h.slice(1)].map(c => c+c).join('');
  if (!/^#[0-9A-F]{6}$/.test(h)) return undefined;
  return { hex: h, values: [1,3,5].map(i => parseInt(h.slice(i,i+2),16)) as [number,number,number] };
}
export function luminance(value: string): number {
  const data=rgb(value); if (!data) return 0;
  const a=data.values.map(v => { const n=v/255; return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4; });
  return a[0]!*0.2126+a[1]!*0.7152+a[2]!*0.0722;
}
export function contrast(a: string,b: string) {
  const x=luminance(a),y=luminance(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
// Adapt existing screen colours by surface role without changing their layout.
export function surfaceColor(value: unknown, night: boolean): unknown {
  if (typeof value !== 'string') return value;
  const data=rgb(value); if (!data) return value;
  const {hex,values:[r,g,b]}=data; const p=night?darkPalette:lightPalette;
  if(pages.has(hex)) return p.background;
  if(hex==='#FFFFFF') return p.surface;
  if(!night) return value;
  if(Math.min(r,g,b)>175) {
    if(r>g+15 && r>b+15) return '#48242B';
    if(g>r+10 && g>b+5) return '#163D2A';
    if(r>b+20 && g>b+15) return '#43371B';
    return p.raised;
  }
  return value;
}
export function foregroundColor(value: unknown, background: string, night: boolean): string {
  const p=night?darkPalette:lightPalette;
  const bg=rgb(background)?background:p.background;
  const darkSurface=luminance(bg)<0.22;
  let candidate=typeof value==='string'?value:(darkSurface?'#F8FAFC':'#172033');
  const data=rgb(candidate);
  if(!data) return candidate;
  const {hex,values:[r,g,b]}=data;
  if(muted.has(hex)) candidate=darkSurface?'#CBD5E1':'#475569';
  else if(['#111111','#000000','#0A0A0A','#1A1F2B','#172033','#242737','#242737','#233044'].includes(hex)) candidate=darkSurface?'#F8FAFC':'#172033';
  if(contrast(candidate,bg)>=4.5) return candidate;
  if(b>r+20 && b>g+10) candidate=darkSurface?'#BFD5FF':'#0B2F6B';
  else if(g>r+15 && g>b+10) candidate=darkSurface?'#8BDEA4':'#237A41';
  else if(r>b+60 && g>b+30) candidate=darkSurface?'#F5A300':'#8A4B00';
  else if(r>g+35 && r>b+35) candidate=darkSurface?'#FFB4AB':'#B42318';
  if(contrast(candidate,bg)>=4.5) return candidate;
  return contrast('#172033',bg)>contrast('#F8FAFC',bg)?'#172033':'#F8FAFC';
}
