/** Derive a public outcode only from an actual job postcode/outcode field, never from the town. */
export function extractPublicOutcode(value:unknown):string{
  if(typeof value!=='string')return '';
  const text=value.trim().toUpperCase().replace(/\s+/g,' ');
  const match=text.match(/^([A-Z]{1,2}\d[A-Z\d]?)(?: \d[A-Z]{2})?$/);
  return match?match[1]:'';
}
/** Public route label: uses the actual outcode returned by XDrive, never a town->postcode guess. */
export function routeLabel(town:string,postcodeArea?:string):string{
  const city=(town||'').trim().replace(/\s+/g,' ');
  const raw=(postcodeArea||'').trim().toUpperCase();
  // Public UK outcode only (e.g. BB1 / LS1 / M12), never a full postcode.
  const outcode=/^[A-Z]{1,2}\d[A-Z\d]?$/.test(raw)?raw:'';
  if(!outcode)return city;
  if(new RegExp('(?:^|[^A-Z0-9])'+outcode+'(?:$|[^A-Z0-9])','i').test(city))return city;
  return city?city+', '+outcode:outcode;
}
