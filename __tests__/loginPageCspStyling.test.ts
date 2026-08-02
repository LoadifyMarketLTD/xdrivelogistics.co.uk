import fs from 'node:fs';
import path from 'node:path';

describe('login page CSP-safe styling', () => {
  const pagePath = path.join(process.cwd(), 'app/login/page.tsx');
  const cssPath = path.join(process.cwd(), 'app/login/login.module.css');
  const page = fs.readFileSync(pagePath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');

  it('uses an external CSS module instead of an inline styled-jsx block', () => {
    expect(page).toContain("import styles from './login.module.css'");
    expect(page).not.toContain('<style jsx>');
  });

  it('uses repository assets that exist in public', () => {
    expect(page).toContain('src="/hero-dispatch-control.webp"');
    expect(page).toContain('src="/xdrive-logo-horizontal.png"');

    expect(fs.existsSync(path.join(process.cwd(), 'public/hero-dispatch-control.webp'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'public/xdrive-logo-horizontal.png'))).toBe(true);
  });

  it('keeps the responsive split-screen layout contract', () => {
    expect(css).toContain('grid-template-columns: minmax(0, 1.3fr) minmax(420px, 0.7fr)');
    expect(css).toContain('@media (max-width: 820px)');
    expect(css).toContain('flex-direction: column');
  });
});
