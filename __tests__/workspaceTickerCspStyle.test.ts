import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('workspace activity feed CSP-safe styling', () => {
  it('keeps the retired shell ticker hidden without styled-jsx or fixed positioning', () => {
    const shell = readFileSync(join(process.cwd(), 'app/components/workspace/WorkspaceShell.tsx'), 'utf8');
    const css = readFileSync(join(process.cwd(), 'app/components/workspace/WorkspaceShell.module.css'), 'utf8');
    const uiCss = readFileSync(join(process.cwd(), 'app/components/workspace/WorkspaceUI.module.css'), 'utf8');

    expect(shell).not.toContain('<style jsx');
    expect(css).toContain('.tickerRoot');
    expect(css).toContain('display: none !important;');
    expect(css).not.toContain('@keyframes xdriveTicker');
    expect(css).not.toContain('position: fixed;');
    expect(css).toContain('.workspaceRoot :global(.xdrive-two-column)');
    expect(css).toContain('.workspaceRoot :global(.xdrive-settings-layout)');
    expect(uiCss).toContain('.workspaceActivityFeedItemButton');
  });
});
