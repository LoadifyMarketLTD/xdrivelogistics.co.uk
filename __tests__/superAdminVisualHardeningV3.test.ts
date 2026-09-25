import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

function runtimeFiles(dir: string): string[] {
  const absolute = path.join(root, dir);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) return runtimeFiles(relative);
    return /\.(?:ts|tsx|css)$/.test(entry.name) ? [relative] : [];
  });
}

const layout = read('app/super-admin/layout.tsx');
const visual = read('app/super-admin/super-admin-visual-contract.css');
const command = read('app/super-admin/page.tsx');
const primitivesCss = read('app/super-admin/_components/SuperAdminEnterprisePrimitives.module.css');
const marketplace = read('app/super-admin/marketplace/page.tsx');
const runtime = runtimeFiles('app/super-admin').map((file) => `${file}\n${read(file)}`).join('\n');

describe('Super Admin Phase 9 visual hardening v3', () => {  it('loads only the v3 visual contract in the protected layout', () => {
    expect(layout).toContain("import './super-admin-visual-contract.css'");
    expect(layout).toContain('className="super-admin-enterprise-root"');
    expect(layout).toContain('data-super-admin-visual="enterprise-v3"');
    for (const legacy of [
      'super-admin-light.css',
      'super-admin-light-hardening.css',
      'super-admin-master-contract.css',
      'super-admin-v2-icon-enforcement.css',
    ]) expect(layout).not.toContain(legacy);
  });

  it('removes the legacy visual contract files entirely', () => {
    for (const legacy of [
      'app/super-admin/super-admin-light.css',
      'app/super-admin/super-admin-light-hardening.css',
      'app/super-admin/super-admin-master-contract.css',
      'app/super-admin/super-admin-v2-icon-enforcement.css',
    ]) expect(fs.existsSync(path.join(root, legacy))).toBe(false);
  });

  it('prevents legacy palette, typography and root selectors from returning', () => {
    for (const marker of ['#1A73E8', 'Roboto', '#0f172a', '#1e293b', 'super-admin-light-root']) {
      expect(runtime, `runtime still contains ${marker}`).not.toContain(marker);
    }
  });
  it('keeps global v3 CSS token-only instead of overriding page primitives', () => {
    expect(visual).toContain('.super-admin-enterprise-root');
    for (const broad of ['main h1', 'main h2', 'main h3', 'main svg', 'main table', 'main button']) {
      expect(visual).not.toContain(broad);
    }
  });

  it('removes the legacy connected-workspace block from Command Centre', () => {
    expect(command).not.toContain('ConnectedExchangePanel');
    expect(command).toContain('data-contract-surface="command-centre-kpis"');
  });

  it('uses the dense enterprise KPI grid and removes the old Marketplace dark island', () => {
    expect(primitivesCss).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))');
    expect(marketplace).not.toContain('#0f172a');
    expect(marketplace).not.toContain('#1e293b');
    expect(marketplace).toContain('SuperAdminPageHeader');
    expect(marketplace).toContain('SuperAdminMetricGrid');
  });
});
