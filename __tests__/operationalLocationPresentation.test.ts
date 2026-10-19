import { describe, expect, it } from 'vitest';

import { operationalLocationLabel } from '../app/components/workspace/locationPresentation';

describe('operationalLocationLabel', () => {
  it('does not duplicate a full postcode already present in the location', () => {
    expect(operationalLocationLabel('Blackburn, BB1 2AB', 'BB1 2AB')).toBe('Blackburn, BB1 2AB');
  });

  it('does not append a full postcode when its outcode is already the public location', () => {
    expect(operationalLocationLabel('Blackburn, BB1', 'BB1 2AB')).toBe('Blackburn, BB1');
  });

  it('normalises punctuation and case before deciding whether a postcode is duplicated', () => {
    expect(operationalLocationLabel('blackburn - bb1', 'BB1')).toBe('blackburn - bb1');
  });

  it('appends postcode when the location does not contain it', () => {
    expect(operationalLocationLabel('Blackburn', 'BB1 2AB')).toBe('Blackburn, BB1 2AB');
  });

  it('falls back cleanly when location and postcode are empty', () => {
    expect(operationalLocationLabel('', '', 'Collection not supplied')).toBe('Collection not supplied');
  });
});
