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
    expect(resolver).toContain('data-xdrive-location-suggestions');
    expect(resolver).toContain('setReactInputValue');
  });

  it('keeps the shared resolver mounted in the common workspace shell', () => {
    expect(read('app/components/workspace/TopWorkspaceShell.tsx')).toContain('<OperationalPostcodeAreaResolver />');
  });
});
