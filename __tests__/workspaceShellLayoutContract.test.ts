import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_SHELL_BREAKPOINTS,
  WORKSPACE_SHELL_DIMENSIONS,
} from '../app/components/workspace/workspaceShellContract';

describe('workspace shell layout contract', () => {
  it('keeps sidebar width contract: 230px desktop / 56px tablet / 280px mobile drawer', () => {
    const shell = readFileSync(join(process.cwd(), 'app/components/workspace/WorkspaceShell.tsx'), 'utf8');

    expect(WORKSPACE_SHELL_DIMENSIONS.desktopSidebar).toBe(230);
    expect(WORKSPACE_SHELL_DIMENSIONS.compactSidebar).toBe(56);
    expect(WORKSPACE_SHELL_DIMENSIONS.mobileDrawer).toBe(280);
    expect(WORKSPACE_SHELL_DIMENSIONS.headerHeight).toBe(50);
    expect(WORKSPACE_SHELL_BREAKPOINTS.compactMaxWidth).toBe(1024);
    expect(shell).toContain('WORKSPACE_SHELL_DIMENSIONS.desktopSidebar');
    expect(shell).toContain('WORKSPACE_SHELL_DIMENSIONS.compactSidebar');
    expect(shell).toContain('WORKSPACE_SHELL_DIMENSIONS.mobileDrawer');
    expect(shell).toContain('WORKSPACE_SHELL_DIMENSIONS.headerHeight');
    expect(shell).toContain('WORKSPACE_SHELL_BREAKPOINTS.compactMaxWidth');
  });

  it('keeps Action Centre access in the shared shell header', () => {
    const shell = readFileSync(join(process.cwd(), 'app/components/workspace/WorkspaceShell.tsx'), 'utf8');
    expect(shell).toContain('Action Centre');
    expect(shell).toContain('const actionCentreHref =');
    expect(shell).toContain('router.push(actionCentreHref)');
  });
});
