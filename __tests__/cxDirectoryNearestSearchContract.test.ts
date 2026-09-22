import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX Directory nearest member search contract', () => {
  const page = read('app/components/workspace/MemberDirectoryPage.tsx');
  const route = read('app/api/directory/route.ts');

  it('adds CX-style Find My Nearest controls to Directory', () => {
    expect(page).toContain('FIND MY NEAREST');
    expect(page).toContain('Find My Nearest');
    expect(page).toContain('nearestRadius');
    expect(page).toContain('distanceMiles');
  });

  it('resolves postcode/outcode and radius on the server', () => {
    expect(route).toContain("searchParams.get('near')");
    expect(route).toContain("searchParams.get('radiusMiles')");
    expect(route).toContain('api.postcodes.io');
    expect(route).toContain('distanceMiles');
    expect(route).toContain('distanceMiles <= radiusMiles');
  });

  it('keeps Directory location privacy at member/company postcode level', () => {
    expect(page).toContain('Broad member/company location only');
    expect(route).not.toContain('exact_lat');
    expect(route).not.toContain('exact_lng');
    expect(route).not.toContain('driver_availability_presence');
  });
});
