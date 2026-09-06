import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const navbarSource = source('app/super-admin/_components/SuperAdminNavbar.tsx');
const navbarCSS = source('app/super-admin/super-admin-master-contract.css');
const masterDocument = source('docs/super-admin/MASTER_CONTRACT_FINAL.md');
const signOutSource = source('app/auth/sign-out/page.tsx');

describe('MASTER CONTRACT FINAL v2 — Super Admin enterprise navbar', () => {
  it('parses the TSX as an AST and contains no forbidden mobile-navigation identifier', () => {
    const ast = ts.createSourceFile('SuperAdminNavbar.tsx', navbarSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const diagnostics = (ast as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
    expect(diagnostics).toHaveLength(0);
    const identifiers: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node)) identifiers.push(node.text);
      ts.forEachChild(node, visit);
    };
    visit(ast);
    expect(identifiers).not.toContain('Hamburger');
    expect(identifiers).not.toContain('MobileHamburgerMenu');
    expect(identifiers).not.toContain('Menu');
  });

  it('contains no hamburger, collapse or responsive-hiding implementation', () => {
    expect(navbarSource).not.toContain('Hamburger');
    expect(navbarSource).not.toContain('<MobileHamburgerMenu');
    expect(navbarSource).not.toContain('collapse');
    expect(navbarCSS).not.toContain('@media');
    expect(navbarCSS).toContain('overflow-x: auto;');
    expect(masterDocument).toContain('MUST NOT use responsive hiding');
  });

  it('contains the exact required controls, destinations and source order', () => {
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
      expect(index, `${label} missing`).toBeGreaterThan(previous);
      previous = index;
    }

    expect(navbarSource).toContain('href="/super-admin/directory"');
    expect(navbarSource).toContain('href="/super-admin/action-centre"');
    expect(navbarSource).toContain('href="/super-admin/platform"');
    expect(navbarSource).toContain('xdrivelogisticsltd@gmail.com');
    expect(navbarSource).toContain('Super Admin home');
    expect(navbarSource).toContain('Explore all areas');
    expect(navbarSource).toContain('href="/auth/sign-out">Sign out</Link>');
  });

  it('uses the existing authenticated logout implementation behind /auth/sign-out', () => {
    expect(signOutSource).toContain("import { useAuth } from '../../components/AuthContext'");
    expect(signOutSource).toContain('const { logout } = useAuth()');
    expect(signOutSource).toContain('void logout()');
    expect(navbarSource).not.toContain('supabase.auth.signOut');
  });

  it('uses the exact v2 navbar geometry and typography', () => {
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
    expect(navbarCSS).toContain('font-weight: 500;');
    expect(navbarCSS).toContain('font-size: 14px;');
    expect(navbarCSS).toContain('font-weight: 400;');
    expect(navbarCSS).toContain('width: 24px;');
    expect(navbarCSS).toContain('height: 24px;');
  });
});
