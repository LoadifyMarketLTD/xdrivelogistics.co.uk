import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('workspace shell layout contract', () => {
  it('keeps sidebar width contract: 230px desktop / 56px tablet / 280px mobile drawer', () => {
    const shell = readFileSync(join(process.cwd(), 'app/components/workspace/WorkspaceShell.tsx'), 'utf8');

    // Desktop: 230px sidebar width
    expect(shell).toContain("'230px'");
    // Tablet collapsed: 56px icon-only sidebar (Section 2)
    expect(shell).toContain("'56px'");
    // Mobile drawer: 280px width (Section 2)
    expect(shell).toContain("'280px'");
    // Compact breakpoint preserved at <=1024px
    expect(shell).toContain('window.innerWidth <= 1024');
    // Header height contract preserved
    expect(shell).toContain("minHeight: '50px'");
  });

  it('keeps Action Centre access in the shared shell header', () => {
    const shell = readFileSync(join(process.cwd(), 'app/components/workspace/WorkspaceShell.tsx'), 'utf8');
    expect(shell).toContain('Action Centre');
    expect(shell).toContain('const actionCentreHref =');
    expect(shell).toContain('router.push(actionCentreHref)');
  });
});
