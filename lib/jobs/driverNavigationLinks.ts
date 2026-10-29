/** Build grounded external map destinations without duplicate outcodes. */
export function navigationDestination(address:string|null|undefined,postcode:string|null|undefined):string {
 const a=(address||'').trim().replace(/\s+/g,' ');
 const p=(postcode||'').trim().replace(/\s+/g,' ');
 if(!p)return a;
 if(!a)return p;
 const upper=a.toUpperCase(), post=p.toUpperCase();
 if(upper===post || upper.endsWith(', '+post) || upper.endsWith(' '+post))return a;
 if(/^[A-Z]{1,2}\d[A-Z\d]?$/.test(post) && upper.split(/[\s,]+/).includes(post))return a;
 return a+', '+p;
}
export function navigationUrl(address:string|null|undefined,postcode:string|null|undefined,mode:'navigate'|'view'='navigate') {
 const destination=navigationDestination(address,postcode);
 if(!destination)return null;
 // A bare UK outcode is ambiguous globally. Disambiguate it without fabricating a street address.
 const query=/^[A-Z]{1,2}\d[A-Z\d]?(?:\s*\d[A-Z]{2})?$/i.test(destination)?destination+', United Kingdom':destination;
 return mode==='navigate'
  ? 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(query)
  : 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);
}
