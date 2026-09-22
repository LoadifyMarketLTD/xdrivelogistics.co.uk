import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app/admin/fleet/resources/page.tsx'), 'utf8');

describe('CX Drivers & Vehicles consolidated access contract', () => {
  it('presents the combined workspace as Drivers & Vehicles', () => {
    expect(source).toContain('title="Drivers & Vehicles"');
    expect(source).toContain('Drivers Register');
    expect(source).toContain('Vehicles Register');
  });

  it('keeps direct navigation to both canonical registers and connected capacity surfaces', () => {
    expect(source).toContain("router.push('/admin/drivers')");
    expect(source).toContain("router.push('/admin/vehicles')");
    expect(source).toContain("router.push('/admin/live-availability')");
    expect(source).toContain("router.push('/admin/fleet/returns')");
  });

  it('keeps Resources selected as the consolidated operating view', () => {
    expect(source).toContain('aria-current="page"');
    expect(source).toContain('Resources</button>');
  });
});
