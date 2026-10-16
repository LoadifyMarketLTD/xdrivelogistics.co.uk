import fs from 'node:fs';
import path from 'node:path';

describe('Carrier settings and navbar consolidation contract', () => {
  const shell = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/TopWorkspaceShell.tsx'), 'utf8');
  const shellCss = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/top-workspace-shell.css'), 'utf8');
  const settingsCss = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/role-settings-workspace.css'), 'utf8');

  it('preserves authorised administration routes in Carrier navigation without a second role-specific exclusion', () => {
    expect(shell).toContain('const more: WorkspaceNavItem[] = [');
    expect(shell).toContain('const represented = new Set(');
    expect(shell).not.toContain('settingsOwnedHrefs');
    expect(shell).toContain('if (!represented.has(href))');
  });

  it('uses the shared Owner Driver label and caret for the Carrier utility menu', () => {
    expect(shell).toContain('<span>{group.label}</span>');
    expect(shell).toContain('className="top-workspace-nav__caret" size={14}');
    expect(shell).not.toContain('<Menu aria-hidden="true" size={18}');
    expect(shellCss).not.toContain('width: 34px !important;');
  });

  it('keeps the navbar geometry independent of Carrier page context', () => {
    expect(shell).not.toContain('CARRIER_PAGE_CONTEXTS');
    expect(shell).not.toContain('data-page-context=');
    expect(shellCss).not.toContain('top-workspace-nav__context');
    expect(shellCss).not.toContain('[data-page-context=');
    expect(shell).toContain('top-workspace-nav--primary');
  });
  it('keeps Settings readable and consistently spaced without duplicate shortcut density', () => {
    expect(settingsCss).toContain('grid-template-columns:210px minmax(0,1fr)');
    expect(settingsCss).toContain('min-height:34px');
    expect(settingsCss).toContain('font-size:12px');
  });
});
