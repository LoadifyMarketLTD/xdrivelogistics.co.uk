import { describe, expect, it } from 'vitest';
import { importedPostingTown, townFromPostingAddress, validPostingTown } from '../lib/loadPostingTown';

describe('posting town from explicit addresses', () => {
  it.each([
    ['101 Cornelian Street, Blackburn', 'BB1 9QL', 'Blackburn'],
    ['2 Sandcliff Road, Erith', 'DA8 1NY', 'Erith'],
    ['2 Sandcliff Road, Erith, DA8 1NY, GB', 'DA8 1NY', 'Erith'],
    ['Depot, 2 Sandcliff Road, Erith, DA8 1NY', 'DA8 1NY', 'Erith'],
    ['101 Cornelian Street', 'BB1 9QL', ''],
    ['2 Sandcliff Road, London Borough of Bexley, DA8 1NY', 'DA8 1NY', ''],
    ['2 Sandcliff Road, Erith, Kent', 'DA8 1NY', ''],
    ['101 Cornelian Street, Blackburn, BB1 9QL', 'DA8 1NY', ''],
  ])('extracts safely from %s', (address, postcode, town) => {
    expect(townFromPostingAddress(address, postcode)).toBe(town);
  });
  it('replaces the old town when Smart Read imports the reverse route', () => {
    expect(importedPostingTown({ address: { value: '2 Sandcliff Road, Erith' }, postcode: { value: 'DA8 1NY' } }, 'BB1 9QL', 'Blackburn')).toBe('Erith');
  });
  it('clears an old town when a changed postcode has no explicit town', () => {
    expect(importedPostingTown({ postcode: { value: 'DA8 1NY' } }, 'BB1 9QL', 'Blackburn')).toBe('');
  });
  it('preserves an existing town for an unchanged postcode-only import', () => {
    expect(importedPostingTown({ postcode: { value: 'BB19QL' } }, 'BB1 9QL', 'Blackburn')).toBe('Blackburn');
    expect(importedPostingTown(undefined, 'BB1 9QL', 'Blackburn')).toBe('Blackburn');
  });
  it('validates mandatory towns rather than street-level or empty values', () => {
    expect(validPostingTown('')).toBe(false);
    expect(validPostingTown('101 Cornelian Street')).toBe(false);
    expect(validPostingTown('London Borough of Bexley')).toBe(false);
    expect(validPostingTown('Erith')).toBe(true);
  });
});
