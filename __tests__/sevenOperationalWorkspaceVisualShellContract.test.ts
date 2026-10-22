import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

const layouts = [
  'app/customer/layout.tsx',
  'app/broker/layout.tsx',
  'app/admin/layout.tsx',
  'app/driver/layout.tsx',
];

describe('seven operational workspaces share the Owner Driver visual shell', () => {
  it.each(layouts)('%s loads the shared visual tokens and light theme guard', (layout) => {
    const source = read(layout);
    expect(source).toContain('workspace-light-guard.css');
    expect(source).toContain('top-workspace-shell.css');
    expect(source).toContain('workspace-measured-cx-baseline.css');
    for (const wrapper of ['xdrive-workspace-visual', 'xdrive-workspace-measured', 'xdrive-operational-top-workspace', 'xdrive-canonical-workspace']) {
      expect(source).toContain(wrapper);
    }
  });

  it('Owner Driver and employed Driver reuse one operational navigation component', () => {
    expect(read('app/driver/_components/DriverTopWorkspaceShell.tsx')).toContain('<TopWorkspaceShell>{children}</TopWorkspaceShell>');
  });

  it('does not opt Super Admin into the operational visual wrapper', () => {
    const source = read('app/super-admin/layout.tsx');
    expect(source).not.toContain('xdrive-workspace-measured');
  });
});