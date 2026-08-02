import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('workspace shell layout contract', () => {
  it('keeps sidebar width and compact header within the shared shell range', () => {
    const shell = readFileSync(join(process.cwd(), 'app/components/workspace/WorkspaceShell.tsx'), 'utf8');

    expect(shell).toContain("width: '268px'");
    expect(shell).toContain("minHeight: '60px'");
  });

  it('keeps Action Centre access in the shared shell header', () => {
    const shell = readFileSync(join(process.cwd(), 'app/components/workspace/WorkspaceShell.tsx'), 'utf8');
    expect(shell).toContain('Action Centre');
    expect(shell).toContain('const actionCentreHref =');
    expect(shell).toContain('router.push(actionCentreHref)');
  });
});
