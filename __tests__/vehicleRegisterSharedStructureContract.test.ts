import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('shared vehicle register structure', () => {
  const pages = [
    'app/admin/vehicles/page.tsx',
    'app/driver/vehicles/page.tsx',
    'app/driver/drivers-vehicles/page.tsx',
    'app/components/workspace/VehicleReadinessRecovery.tsx',
    'app/admin/fleet/resources/page.tsx',
    'app/admin/fleet/vehicles/page.tsx',
  ];

  it.each(pages)('%s uses the canonical admin vehicle register shell', (file) => {
    const source = read(file);
    expect(source).toContain('VehicleRegisterShell');
  });

  it('keeps the shared shell anchored to the admin vehicle register classes', () => {
    const source = read('app/components/workspace/VehicleRegisterShell.tsx');
    expect(source).toContain('carrier-register-page carrier-register-page--vehicles');
    expect(source).toContain('carrier-register-toolbar');
    expect(source).toContain('carrier-register-title');
    expect(source).toContain('carrier-register-subtitle');
  });
});
