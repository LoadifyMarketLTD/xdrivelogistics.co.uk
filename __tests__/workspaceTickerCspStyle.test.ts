import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('workspace activity feed CSP-safe styling', () => {
  it('keeps ticker animation in CSS module and not styled-jsx blocks', () => {
    const shell = readFileSync(join(process.cwd(), 'app/components/workspace/WorkspaceShell.tsx'), 'utf8');
    const css = readFileSync(join(process.cwd(), 'app/components/workspace/WorkspaceShell.module.css'), 'utf8');

    expect(shell).not.toContain('<style jsx');
    expect(css).toContain('@keyframes xdriveTicker');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('.workspaceRoot :global(.xdrive-two-column)');
    expect(css).toContain('.workspaceRoot :global(.xdrive-settings-layout)');
  });
});
