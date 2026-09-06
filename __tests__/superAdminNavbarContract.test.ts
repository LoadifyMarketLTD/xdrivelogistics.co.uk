import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const navbarSource = source('app/super-admin/_components/SuperAdminNavbar.tsx');
const navbarCSS = source('app/super-admin/super-admin-master-contract.css');
const masterDocument = source('docs/super-admin/MASTER_CONTRACT_FINAL.md');

describe('Super Admin enterprise navbar contract', () => {
  it('contains no mobile menu implementation or responsive hiding contract', () => {
    expect(navbarSource).not.toContain('Hamburger');
    expect(navbarSource).not.toContain('<MobileHamburgerMenu');
    expect(navbarSource).not.toContain('collapse');
    expect(navbarCSS).not.toContain('@media');
    expect(masterDocument).toContain('MUST NOT transform into a hamburger');
    expect(masterDocument).toContain('horizontal scrolling');
  });

  it('contains the exact enterprise navigation identity and primary controls', () => {
    expect(navbarSource).toContain('XDrive Logistics');
    expect(navbarSource).toContain('Search platform');
    expect(navbarSource).toContain('Explore areas');
    expect(navbarSource).toContain('Action Centre');
    expect(navbarSource).toContain('Platform Overview');
    expect(navbarSource).toContain('Platform Owner');
    expect(navbarSource).toContain('xdrivelogisticsltd@gmail.com');
    expect(navbarSource).toContain('Super Admin home');
    expect(navbarSource).toContain('Explore all areas');
    expect(navbarSource).toContain('Sign out');
  });

  it('uses the exact enterprise navbar geometry', () => {
    expect(navbarCSS).toContain('.sa-navbar');
    expect(navbarCSS).toContain('position: fixed;');
    expect(navbarCSS).toContain('padding: 24px;');
    expect(navbarCSS).toContain('padding: 12px 18px;');
    expect(navbarCSS).toContain('border-radius: 8px;');
    expect(navbarCSS).toContain('box-shadow: 0px 2px 6px rgba(0,0,0,0.08);');
    expect(navbarCSS).toContain('gap: 24px;');
    expect(navbarCSS).toContain('gap: 8px;');
    expect(navbarCSS).toContain('font-size: 20px;');
    expect(navbarCSS).toContain('font-size: 16px;');
    expect(navbarCSS).toContain('font-size: 14px;');
    expect(navbarCSS).toContain('overflow-x: auto;');
  });
});
