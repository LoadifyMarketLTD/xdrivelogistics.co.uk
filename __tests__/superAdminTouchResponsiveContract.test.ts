import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Super Admin touch and responsive interaction contract', () => {
  const typography = read('app/super-admin/super-admin-cx-typography.css');
  const shell = read('app/super-admin/_components/SuperAdminCardNavigationShell.module.css');
  const primitives = read('app/super-admin/_components/SuperAdminEnterprisePrimitives.module.css');
  const topbar = read('app/super-admin/_components/SuperAdminTopbar.tsx');
  const sidebar = read('app/super-admin/_components/SuperAdminSidebar.tsx');

  it('enforces a 44px interaction floor for controls', () => {
    expect(typography).toContain('min-height: 44px !important;');
    expect(typography).toContain('min-width: 44px;');
    expect(shell).toContain('min-height: 44px;');
    expect(primitives).toContain('min-height: 44px;');
  });

  it('keeps keyboard focus and owner-menu navigation explicit', () => {
    expect(typography).toContain(':focus-visible');
    expect(topbar).toContain("event.key === 'Escape'");
    expect(topbar).toContain("'ArrowDown', 'ArrowUp', 'Home', 'End'");
    expect(topbar).toContain('buttonRef.current?.focus()');
    expect(topbar).toContain('aria-controls="super-admin-owner-menu"');
  });

  it('removes the closed mobile sidebar from pointer and keyboard interaction', () => {
    expect(shell).toContain('visibility: hidden;');
    expect(shell).toContain('pointer-events: none;');
    expect(shell).toContain('.sidebarMobileOpen');
    expect(shell).toContain('visibility: visible;');
    expect(sidebar).toContain('id="super-admin-navigation"');
    expect(topbar).toContain('aria-controls="super-admin-navigation"');
  });

  it('preserves dense table readability and touch scrolling', () => {
    expect(primitives).toContain('overflow-x: auto;');
    expect(primitives).toContain('-webkit-overflow-scrolling: touch;');
    expect(primitives).toContain('overscroll-behavior-inline: contain;');
    expect(typography).toContain('padding-block: 10px !important;');
  });

  it('respects reduced-motion preferences', () => {
    expect(typography).toContain('@media (prefers-reduced-motion: reduce)');
    expect(typography).toContain('transition-duration: 0.01ms !important;');
  });
});
