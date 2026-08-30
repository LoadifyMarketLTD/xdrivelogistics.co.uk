import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const form = fs.readFileSync(path.join(root, 'app/components/workspace/LoadPostingForm.tsx'), 'utf8');
const field = fs.readFileSync(path.join(root, 'app/components/workspace/PostcodeAddressField.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app/api/location/postcode-addresses/route.ts'), 'utf8');

describe('postcode address lookup contract', () => {
  it('wires the same lookup control into every stop address surface', () => {
    expect(form).toContain("import PostcodeAddressField from './PostcodeAddressField'");
    expect(form).toContain('<PostcodeAddressField postcode={postcode} address={address} onAddress={onAddress} error={errors?.address} />');
  });

  it('keeps postcode lookup authenticated and provider keys server-only', () => {
    expect(route).toContain('getBearerToken(request)');
    expect(route).toContain('supabaseValidator.auth.getUser(token)');
    expect(route).toContain('process.env.IDEAL_POSTCODES_API_KEY');
    expect(route).toContain('process.env.GETADDRESS_API_KEY');
    expect(route).not.toContain('MAPBOX_ACCESS_TOKEN');
    expect(route).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(field).not.toContain('IDEAL_POSTCODES_API_KEY');
    expect(field).not.toContain('GETADDRESS_API_KEY');
  });

  it('uses a dedicated UK postcode-address endpoint rather than nearby geocoding', () => {
    expect(field).toContain('isFullUkPostcode(normalized)');
    expect(route).toContain('api.ideal-postcodes.co.uk/v1/postcodes/');
    expect(route).toContain('api.getAddress.io/find/');
    expect(route).not.toContain('api.mapbox.com');
    expect(route).not.toContain('api.postcodes.io/postcodes/');
  });

  it('formats structured address rows returned for the exact postcode', () => {
    expect(route).toContain('row.line_1');
    expect(route).toContain('row.post_town');
    expect(route).toContain('row.town_or_city');
    expect(route).toContain('suggestions: dedupe(rows.map');
  });

  it('performs one provider lookup per complete postcode and filters locally while typing', () => {
    expect(field).toContain("new URLSearchParams({ postcode: normalized })");
    expect(field).toContain('}, [postcode]);');
    expect(field).not.toContain("params.set('q', query)");
    expect(field).toContain('normalizedSuggestion.includes(query)');
  });

  it('clears stale suggestions when postcode or provider state changes', () => {
    expect(field).toContain('const normalized = normalizePostcode(postcode);\n    setSuggestions([]);\n    setOpen(false);');
    expect(field).toContain('if (!response.ok) return;');
    expect(field).toContain('if (payload.configured === false) return;');
  });

  it('does not add another normal-state helper row beneath the address control', () => {
    expect(field).toContain("position: 'absolute'");
    expect(field).toContain('Addresses for postcode');
    expect(field).toContain("placeholder={loading && !address ? 'Finding addresses…' : undefined}");
    expect(field).not.toContain('Select a street below');
  });

  it('keeps manual address entry available when lookup is unavailable', () => {
    expect(route).toContain('configured: false');
    expect(field).toContain('onAddress(event.target.value)');
  });
});
