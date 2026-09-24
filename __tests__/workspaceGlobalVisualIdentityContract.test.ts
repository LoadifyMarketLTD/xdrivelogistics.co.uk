import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('global workspace visual identity contract', () => {
  const layouts = [
    'app/driver/layout.tsx',
    'app/customer/layout.tsx',
    'app/broker/layout.tsx',
    'app/admin/layout.tsx',
  ];

  it('loads one shared visual identity layer for every primary workspace family', () => {
    for (const layout of layouts) {
      expect(read(layout)).toContain("workspace-global-identity.css");
    }
  });

  it('keeps one XDrive palette and density contract instead of role-specific themes', () => {
    const css = read('app/components/workspace/workspace-global-identity.css');
    for (const token of ['--xw-navy: #0b2f6b', '--xw-blue: #1d57d8', '--xw-orange: #f5a300', '--xw-page: #f4f5f7', '--xw-panel: #ffffff']) {
      expect(css).toContain(token);
    }
    expect(css).toContain('Keep role differences semantic, not cosmetic.');
  });
});
