import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('login page CSP-safe styling', () => {
  const pagePath = path.join(process.cwd(), 'app/login/page.tsx');
  const cssPath = path.join(process.cwd(), 'app/login/login.module.css');
  const page = fs.readFileSync(pagePath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');

  it('uses an external CSS module instead of an inline styled-jsx block', () => {
    expect(page).toContain("import styles from './login.module.css'");
    expect(page).not.toContain('<style jsx>');
  });

  it('uses the canonical login hero and logo asset paths', () => {
    expect(page).toContain('src="/login-hero-operations-centre.webp"');
    expect(page).toContain('src="/xdrive-logo-horizontal.png"');
    expect(page).not.toContain('hero-dispatch-control.webp');
    expect(page).not.toContain('xdrive-login-hero');
  });

  it('keeps the complete authentication card and responsive split-screen layout', () => {
    expect(page).toContain('Welcome Back');
    expect(page).toContain('Forgot password?');
    expect(page).toContain('Sign In');
    expect(page).toContain('Register');
    expect(page).toContain('Send Reset Email');

    expect(css).toContain('grid-template-columns: minmax(0, 1.3fr) minmax(420px, 0.7fr)');
    expect(css).toContain('@media (max-width: 820px)');
    expect(css).toContain('flex-direction: column');
  });
});
