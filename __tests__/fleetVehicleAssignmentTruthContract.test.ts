import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('fleet vehicle assignment truth', () => {
  it('does not silently choose one vehicle when multiple vehicles reference the same driver', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/admin/fleet/resources/page.tsx'), 'utf8');

    expect(source).toContain("const vehicles = data.vehicles.filter((item) => item.assigned_driver_id === driver.id);");
    expect(source).toContain('const vehicle = vehicles.length === 1 ? vehicles[0] : null;');
    expect(source).toContain("vehicles.length > 1 ? 'Multiple vehicle assignments' : null");
    expect(source).toContain("? `${vehicles.length} assigned vehicles`");
  });
});
