import fs from 'node:fs';
import path from 'node:path';

describe('Netlify canonical XDrive site guard', () => {
  const root = process.cwd();
  const config = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
  const guard = fs.readFileSync(path.join(root, 'scripts/netlify-ignore-foreign-site.mjs'), 'utf8');

  it('wires the build ignore guard from netlify.toml', () => {
    expect(config).toContain('ignore = "node ./scripts/netlify-ignore-foreign-site.mjs"');
  });

  it('continues only for the canonical xdrivelogistics Netlify site', () => {
    expect(guard).toContain("OFFICIAL_SITE_NAME = 'xdrivelogistics'");
    expect(guard).toContain("siteName !== OFFICIAL_SITE_NAME");
    expect(guard).toContain('process.exit(0)');
    expect(guard).toContain('process.exit(1)');
  });

  it('does not skip local or unclassified environments', () => {
    expect(guard).toContain("process.env.NETLIFY === 'true'");
    expect(guard).toContain('if (!onNetlify)');
    expect(guard).toContain('if (!siteName)');
  });
});
