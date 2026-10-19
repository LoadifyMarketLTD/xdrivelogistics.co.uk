import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  normalizeOperationalPostcode,
  operationalAddressSuggestionLabel,
} from '../app/components/workspace/PostcodeAddressField';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('global operational postcode autocomplete', () => {
  it('normalises compact UK postcodes like CX', () => {
    expect(normalizeOperationalPostcode('bb19ql')).toBe('BB1 9QL');
    expect(normalizeOperationalPostcode('M11AA')).toBe('M1 1AA');
  });

  it('renders CX-style address suggestion labels without mutating stored address text', () => {
    expect(operationalAddressSuggestionLabel('Cornelian Street, Blackburn', 'bb19ql'))
      .toBe('Cornelian Street, Blackburn, BB1 9QL, GB');
  });

  it('enhances operational location inputs globally', () => {
    const resolver = read('app/components/workspace/OperationalPostcodeAreaResolver.tsx');
    expect(resolver).toContain("context.includes('enter location')");
    expect(resolver).toContain("context.includes('town / postcode')");
    expect(resolver).toContain("context.includes('postcode / area')");
    expect(resolver).toContain('/api/location/postcode-addresses?');
    expect(resolver).toContain("new URLSearchParams({ q: rawValue })");
    expect(resolver).toContain('LOCATION_QUERY.test(rawValue)');
    expect(resolver).toContain('rawValue.length >= 2');
    expect(resolver).toContain('const hint = postcodeField ? hintFor(input) : null');
    expect(resolver).toContain('if (locationField) return');
    expect(resolver).not.toContain('lookupGooglePlaces(rawValue)');
    expect(resolver).not.toContain('maps.googleapis.com/maps/api/js');
    expect(resolver).toContain("dropdown.dataset.xdriveLocationSuggestions = 'true'");
    expect(resolver).toContain('document.body.appendChild(dropdown)');
    expect(resolver).toContain("position: 'fixed'");
    expect(resolver).toContain('existingDropdownFor(input)');
    expect(resolver).toContain('setReactInputValue');
    expect(resolver).toContain('suggestionHasCountry');
  });

  it('uses provider-backed partial address autocomplete for CX-style postcode typing', () => {
    const route = read('app/api/location/postcode-addresses/route.ts');
    expect(route).toContain("https://api.ideal-postcodes.co.uk/v1/autocomplete/addresses");
    expect(route).toContain("url.searchParams.set('query', query)");
    expect(route).toContain("provider: 'ideal-postcodes-autocomplete'");
    expect(route).toContain("provider: 'getaddress-autocomplete'");
    expect(route).toContain("provider: 'mapbox-geocoding-autocomplete'");
    expect(route).toContain("provider: 'photon-openstreetmap'");
    expect(route).toContain("https://photon.komoot.io/api/");
    expect(route).toContain("https://photon.komoot.io/reverse");
    expect(route).not.toContain("provider: 'postcodes-io-autocomplete'");
    expect(route).not.toContain('/autocomplete?limit=12');
    expect(route).toContain("'Netlify-CDN-Cache-Control': 'no-store'");
  });

  it('clears stale postcode-only results before every new location lookup', () => {
    const resolver = read('app/components/workspace/OperationalPostcodeAreaResolver.tsx');
    expect(resolver).toContain('dropdown.replaceChildren()');
    expect(resolver).toContain("dropdown.style.display = 'none'");
  });

  it('keeps the shared resolver mounted in the common workspace shell', () => {
    expect(read('app/components/workspace/TopWorkspaceShell.tsx')).toContain('<OperationalPostcodeAreaResolver />');
  });
});
