/** Derive a public outcode only from an actual job postcode/outcode field, never from the town. */
export function extractPublicOutcode(value:unknown):string{
  if(typeof value!=='string')return '';
  const text=value.trim().toUpperCase().replace(/\s+/g,' ');
  const match=text.match(/^([A-Z]{1,2}\d[A-Z\d]?)(?: \d[A-Z]{2})?$/);
  return match?match[1]:'';
}
/** Remove redundant UK country/postcode suffixes without inventing a location. */
export function normalizeRouteAddress(value: string): string {
  const cleaned=(value||'').trim().replace(/\s+/g,' ');
  const tail=cleaned.match(/^(.*),\s*GB,\s*([A-Z]{1,2}\d[A-Z\d]?\s+\d[A-Z]{2})\s*$/i);
  if(!tail)return cleaned.replace(/,\s*GB\s*$/i,'');
  const before=tail[1].trim(), postcode=tail[2].toUpperCase();
  const seen=new RegExp('(?:^|[^A-Z0-9])'+postcode.replace(/\s+/g,'\\s*')+'(?:$|[^A-Z0-9])','i').test(before);
  return seen?before:before+', '+postcode;
}
/** Public route label: uses the actual outcode returned by XDrive, never a town->postcode guess. */
export function routeLabel(town:string,postcodeArea?:string):string{
  const city=normalizeRouteAddress(town);
  const raw=(postcodeArea||'').trim().toUpperCase();
  // Public UK outcode only (e.g. BB1 / LS1 / M12), never a full postcode.
  const outcode=/^[A-Z]{1,2}\d[A-Z\d]?$/.test(raw)?raw:'';
  if(!outcode)return city;
  if(new RegExp('(?:^|[^A-Z0-9])'+outcode+'(?:$|[^A-Z0-9])','i').test(city))return city;
  return city?city+', '+outcode:outcode;
}
