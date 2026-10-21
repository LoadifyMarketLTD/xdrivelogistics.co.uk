import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

function walk(directory: string): string[] {
  const absolute = path.join(root, directory);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(relative) : [relative.replace(/\\/g, '/')];
  });
}

function routePattern(pageFile: string) {
  const route = '/' + pageFile.replace(/^app\//, '').replace(/\/page\.tsx$/, '');
  const escaped = route
    .split('/')
    .map((part) => {
      if (/^\[\.\.\..+\]$/.test(part)) return '.+';
      if (/^\[\[\.\.\..+\]\]$/.test(part)) return '.*';
      if (/^\[[^\]]+\]$/.test(part)) return '[^/]+';
      return part.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&');
    })
    .join('/');
  return new RegExp('^' + escaped + '$');
}

describe('Super Admin deep control-plane contract', () => {
  it('keeps every Super Admin API route on the shared active-owner authentication boundary', () => {
    const routes = walk('app/api/super-admin').filter((file) => file.endsWith('/route.ts'));
    expect(routes.length).toBeGreaterThan(40);

    for (const file of routes) {
      const source = read(file);
      const methods = [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)\b/g)];
      if (methods.length === 0) continue;

      expect(source, file).toContain('verifyPlatformOwner');
      expect(source, file).not.toContain('const verifyPlatformOwner =');
      expect(source, file).not.toContain('const resolveOwnerProfile =');
      if (!file.endsWith('/_lib/verifyPlatformOwner.ts')) {
        expect(source, file).not.toContain('getBearerToken(request)');
      }
    }
  });

  it('keeps all literal Super Admin navigation targets backed by a page route', () => {
    const pages = walk('app/super-admin')
      .filter((file) => file.endsWith('/page.tsx'))
      .map(routePattern);
    const sourceFiles = walk('app/super-admin').filter((file) => /\.(?:ts|tsx)$/.test(file));
    const hrefs = new Set<string>();

    for (const file of sourceFiles) {
      const source = read(file);
      for (const match of source.matchAll(/(?:href\s*[:=]\s*|router\.(?:push|replace)\(\s*)['"`]([^'"`?#]+)['"`]/g)) {
        if (match[1].startsWith('/super-admin')) hrefs.add(match[1]);
      }
    }

    expect(hrefs.size).toBeGreaterThan(50);
    for (const href of hrefs) {
      expect(pages.some((pattern) => pattern.test(href)), href).toBe(true);
    }
  });

  it('provides keyboard focus and coarse-pointer touch targets at the CX readability layer', () => {
    const typography = read('app/super-admin/super-admin-cx-typography.css');
    expect(typography).toContain('@media (pointer: coarse)');
    expect(typography).toContain('min-height: 44px !important;');
    expect(typography).toContain(':focus-visible');
    expect(typography).toContain('touch-action: manipulation');
  });
});
