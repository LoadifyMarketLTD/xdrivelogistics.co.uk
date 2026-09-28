import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Unified workspace navbar contract', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const shellCss = read('app/components/workspace/top-workspace-shell.css');
  const superShell = read('app/super-admin/_components/SuperAdminCardNavigationShell.tsx');
  const superCss = read('app/super-admin/_components/SuperAdminCardNavigationShell.module.css');

  it('uses one two-row primary navigation shell for operational workspaces', () => {
    expect(shell).toContain('top-workspace-nav--primary');
    expect(shellCss).toContain('.top-workspace-nav--primary');
    expect(shellCss).toContain('top: 58px !important');
    expect(shellCss).toContain('height: 44px !important');
  });

  it('promotes the primary workflow for every operational role', () => {
    for (const composer of [
      'composeCustomerPrimaryNav',
      'composeBrokerPrimaryNav',
      'composeDriverPrimaryNav',
      'composeCarrierPrimaryNav',
      'composeFleetPrimaryNav',
      'composeDispatcherPrimaryNav',
      'composeFinancePrimaryNav',
      'composeCompliancePrimaryNav',
    ]) expect(shell).toContain(composer);
  });

  it('keeps overflow functions under a consistent More menu', () => {
    expect(shell).toContain("moreLabel = 'More'");
    expect(shell).toContain("label: moreLabel");
  });

  it('gives Platform Owner the same horizontal navigation language', () => {
    expect(superShell).toContain('Platform owner primary navigation');
    expect(superShell).toContain('styles.primaryNav');
    expect(superCss).toContain('.primaryNav');
    expect(superCss).toContain('.primaryNavButtonActive');
    expect(superCss).toContain('.primaryNavMenu');
  });
});
