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

  it('keeps address lookup authenticated and the Mapbox token server-only', () => {
    expect(route).toContain('getBearerToken(request)');
    expect(route).toContain('validator.auth.getUser(token)');
    expect(route).toContain('process.env.MAPBOX_ACCESS_TOKEN');
    expect(field).not.toContain('MAPBOX_ACCESS_TOKEN');
  });

  it('uses a complete postcode before resolving street/address suggestions', () => {
    expect(field).toContain('isFullUkPostcode(normalized)');
    expect(route).toContain('api.postcodes.io/postcodes/');
    expect(route).toContain("reverse.searchParams.set('types', 'street')");
    expect(route).toContain("forward.searchParams.set('types', 'address,street')");
    expect(route).toContain("forward.searchParams.set('country', 'gb')");
  });

  it('accepts only provider results explicitly tied to the requested postcode', () => {
    expect(route).toContain('Boolean(candidate) && normalizedKey(candidate) === expectedPostcode');
    expect(route).not.toContain('return !candidate || normalizedKey(candidate) === expectedPostcode');
  });

  it('clears stale suggestions when postcode or provider state changes', () => {
    expect(field).toContain('const normalized = normalizePostcode(postcode);\n    setSuggestions([]);\n    setOpen(false);');
    expect(field).toContain('if (!response.ok)');
    expect(field).toContain('if (payload.configured === false)');
    expect(field).toContain('setSuggestions([]);');
  });

  it('does not add another normal-state helper row beneath the address control', () => {
    expect(field).toContain("position: 'absolute'");
    expect(field).toContain('Address suggestions');
    expect(field).toContain("placeholder={loading && !address ? 'Finding address…' : undefined}");
    expect(field).not.toContain('Select a street below');
  });

  it('keeps manual address entry available when lookup is unavailable', () => {
    expect(route).toContain('{ suggestions: [], configured: false }');
    expect(field).toContain('onChange={(event) => onAddress(event.target.value)}');
  });
});
