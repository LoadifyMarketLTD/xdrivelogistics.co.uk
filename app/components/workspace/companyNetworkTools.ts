export const directionsHref = (origin:string,destination:string) => {
  if (!origin.trim()||!destination.trim()) return null;
  return 'https://www.google.com/maps/dir/?'+new URLSearchParams({api:'1',origin:origin.trim(),destination:destination.trim(),travelmode:'driving'}).toString();
};
export function calculateLoad(count:string,weight:string,length:string,width:string,height:string) {
  const raw=[count,weight,length,width,height];
  if(raw.some(v=>!v.trim())) return null;
  const [n,kg,l,w,h]=raw.map(Number);
  if(!Number.isSafeInteger(n)||n<1||![kg,l,w,h].every(v=>Number.isFinite(v)&&v>0))return null;
  const totalKg=n*kg,volumeM3=n*l*w*h/1e6,floorM2=n*l*w/1e4;
  return [totalKg,volumeM3,floorM2].every(Number.isFinite)?{totalKg,volumeM3,floorM2}:null;
}
