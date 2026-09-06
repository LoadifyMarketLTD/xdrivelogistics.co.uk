import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const navbarSource = source('app/super-admin/_components/SuperAdminNavbar.tsx');
const navbarCSS = source('app/super-admin/super-admin-master-contract.css');
const signOutSource = source('app/auth/sign-out/page.tsx');

describe('MASTER CONTRACT FINAL v2 — navbar checker', () => {
  it('parses the navbar TSX and contains no forbidden mobile-navigation implementation', () => {
    const ast = ts.createSourceFile('SuperAdminNavbar.tsx', navbarSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const diagnostics = (ast as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
    expect(diagnostics).toHaveLength(0);

    const identifiers: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node)) identifiers.push(node.text);
      ts.forEachChild(node, visit);
    };
    visit(ast);

    expect(navbarSource).not.toContain('Hamburger');
    expect(navbarSource).not.toContain('<MobileHamburgerMenu');
    expect(identifiers).not.toContain('Hamburger');
    expect(identifiers).not.toContain('MobileHamburgerMenu');
  });

  it('requires the exact brand, canonical logo-pack mark, search, three primary buttons and user dropdown', () => {
    expect(navbarSource).toContain('<LogoIcon size={24} />');
    expect(navbarSource).toContain('src="/icons/icon-192x192.png"');
    expect(navbarSource).toContain('XDrive Logistics');
    expect(navbarSource).toContain('Search platform...');
    expect(navbarSource).toContain('Explore areas');
    expect(navbarSource).toContain('Action Centre');
    expect(navbarSource).toContain('Platform Overview');
    expect(navbarSource).toContain('Platform Owner');

    expect(navbarSource).toContain('href="/super-admin/directory"');
    expect(navbarSource).toContain('href="/super-admin/action-centre"');
    expect(navbarSource).toContain('href="/super-admin/platform"');
    expect(navbarSource).toContain("email=\"xdrivelogisticsltd@gmail.com\"");
    expect(navbarSource).toContain("{ label: 'Super Admin home', href: '/super-admin' }");
    expect(navbarSource).toContain("{ label: 'Explore all areas', href: '/super-admin/directory' }");
    expect(navbarSource).toContain("{ label: 'Sign out', href: '/auth/sign-out' }");
  });

  it('requires the exact navbar source order', () => {
    const ordered = [
      'XDrive Logistics',
      'Search platform...',
      'Explore areas',
      'Action Centre',
      'Platform Overview',
      'Platform Owner',
    ];
    let previous = -1;
    for (const label of ordered) {
      const index = navbarSource.indexOf(label);
      expect(index, `${label} missing or out of order`).toBeGreaterThan(previous);
      previous = index;
    }
  });

  it('requires exact enterprise geometry and forbids collapse/responsive hiding in navbar CSS', () => {
    expect(navbarCSS).toContain('.sa-navbar');
    expect(navbarCSS).toContain('position: fixed;');
    expect(navbarCSS).toContain('display: flex;');
    expect(navbarCSS).toContain('align-items: center;');
    expect(navbarCSS).toContain('gap: 24px;');
    expect(navbarCSS).toContain('padding: 24px;');
    expect(navbarCSS).toContain('background: #FFFFFF;');
    expect(navbarCSS).toContain('padding: 12px 18px;');
    expect(navbarCSS).toContain('border-radius: 8px;');
    expect(navbarCSS).toContain('box-shadow: 0px 2px 6px rgba(0,0,0,0.08);');
    expect(navbarCSS).toContain('overflow-x: auto;');
    expect(navbarCSS).not.toContain('@media');
    expect(navbarSource).not.toContain('collapse');
  });

  it('requires exact navbar typography and 24px icons', () => {
    expect(navbarCSS).toContain('font-size: 20px;');
    expect(navbarCSS).toContain('font-weight: 700;');
    expect(navbarCSS).toContain('font-size: 16px;');
    expect(navbarCSS).toContain('font-weight: 500;');
    expect(navbarCSS).toContain('font-size: 14px;');
    expect(navbarCSS).toContain('font-weight: 400;');
    expect(navbarCSS).toContain('width: 24px;');
    expect(navbarCSS).toContain('height: 24px;');
  });

  it('keeps sign out on the existing authenticated logout path', () => {
    expect(signOutSource).toContain("import { useAuth } from '../../components/AuthContext'");
    expect(signOutSource).toContain('const { logout } = useAuth()');
    expect(signOutSource).toContain('void logout()');
    expect(navbarSource).not.toContain('supabase.auth.signOut');
  });
});
