import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const form = fs.readFileSync(path.join(root, 'app/components/workspace/LoadPostingForm.tsx'), 'utf8');
const field = fs.readFileSync(path.join(root, 'app/components/workspace/PostcodeAddressField.tsx'), 'utf8').replace(/\r\n/g, '\n');
const route = fs.readFileSync(path.join(root, 'app/api/location/postcode-addresses/route.ts'), 'utf8');

describe('postcode address lookup contract', () => {
  it('wires address lookup into collection, delivery, and additional stop fields', () => {
    expect(form).toContain("import PostcodeAddressField from './PostcodeAddressField'");
    expect(form).toContain('<PostcodeAddressField postcode={postcode} address={address} onAddress={onAddress} onTown={onTown} onPostcodeResolved={onPostcode}');
    expect(form).toContain('<StopFields');
    expect(form).toContain('additionalStops.map');
  });

  it('keeps postcode lookup authenticated and provider keys server-only', () => {
    expect(route).toContain('getBearerToken(request)');
    expect(route).toContain('supabaseValidator.auth.getUser(token)');
    expect(route).toContain('process.env.IDEAL_POSTCODES_API_KEY');
    expect(route).toContain('process.env.GETADDRESS_API_KEY');
    expect(route).toContain('process.env.MAPBOX_ACCESS_TOKEN');
    expect(field).not.toContain('MAPBOX_ACCESS_TOKEN');
    expect(route).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(field).not.toContain('IDEAL_POSTCODES_API_KEY');
    expect(field).not.toContain('GETADDRESS_API_KEY');
  });

  it('uses postcode lookup providers and constrains Photon exact-postcode results', () => {
    expect(field).toContain('isFullUkPostcode(normalized)');
    expect(route).toContain('api.ideal-postcodes.co.uk/v1/postcodes/');
    expect(route).toContain('api.getAddress.io/find/');
    expect(route).toContain('api.mapbox.com/search/geocode/v6/forward');
    expect(route).toContain("provider: 'mapbox-geocoding-autocomplete'");
    expect(route).not.toContain('api.postcodes.io/postcodes/');
    expect(field).not.toContain('api.postcodes.io');
    expect(route).toContain('return found.some(value => postcodeFragment(value) === compact)');
    expect(route).toContain("'Cache-Control': 'private, no-store, max-age=0, must-revalidate'");
    expect(route).toContain("'Netlify-CDN-Cache-Control': 'no-store'");
    expect(route).toContain("Origin: 'https://www.xdrivelogistics.co.uk'");
    expect(route).toContain("Referer: 'https://www.xdrivelogistics.co.uk/'");
  });

  it('formats structured address rows and carries post towns from exact providers', () => {
    expect(route).toContain('row.line_1');
    expect(route).toContain('row.post_town');
    expect(route).toContain('row.town_or_city');
    expect(route).toContain('towns: Object.fromEntries');
    expect(route).toContain('suggestions: dedupe(rows.map');
  });

  it('uses full postcode lookup and partial postcode autocomplete on the field', () => {
    expect(field).toContain('const params = isFullUkPostcode(normalized) ? new URLSearchParams({postcode:normalized}) : new URLSearchParams({q:postcode.trim()});');
    expect(field).toContain('}, [postcode]);');
    expect(field).toContain('normalizedSuggestion.includes(query)');
    expect(field).toContain('onAddress(suggestion);');
    expect(field).toContain('onPostcodeResolved?.(normalizeOperationalPostcode(found[0]))');
    expect(route).toContain("isFullUkPostcode(rawQuery) ? normalizePostcode(rawQuery) : '';");
    expect(route).toContain("const autocompleteQuery = rawQuery || postcode;");
  });

  it('clears stale suggestions and aborts the previous postcode request', () => {
    expect(field).toContain('const normalized = normalizeOperationalPostcode(postcode);\n    setSuggestions([]);\n    setTowns({});\n    setOpen(false);');
    expect(field).toContain('controller.abort();');
    expect(field).toContain('if (!response.ok) return;');
    expect(field).toContain('if (payload.configured === false) return;');
  });

  it('falls through from a failed Ideal exact lookup to GetAddress and Photon', () => {
    expect(route).toContain('if (postcodeLikeQuery && !exactPostcode)');
    const idealIndex = route.indexOf('if (idealKey && exactPostcode)');
    const getAddressIndex = route.indexOf('if (getAddressKey && exactPostcode)');
    const photonFallbackIndex = route.indexOf('// Continue with the public source if exact address providers have no results.');
    expect(idealIndex).toBeGreaterThan(-1);
    expect(getAddressIndex).toBeGreaterThan(idealIndex);
    expect(photonFallbackIndex).toBeGreaterThan(getAddressIndex);
    expect(route).toContain('if (result?.suggestions.length)');
  });

  it('does not add another normal-state helper row beneath the address control', () => {
    expect(field).toContain("position: 'absolute'");
    expect(field).toContain('Addresses for postcode');
    expect(field).toContain("placeholder={loading && !address ? 'Finding addresses…' : undefined}");
    expect(field).not.toContain('Select a street below');
  });

  it('keeps manual address entry available even when every lookup provider returns no suggestions', () => {
    expect(route).toContain('suggestions: []');
    expect(field).toContain('onAddress(event.target.value)');
  });
});
