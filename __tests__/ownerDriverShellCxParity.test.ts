import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const shell = readFileSync('app/components/workspace/TopWorkspaceShell.tsx', 'utf8');
const css = readFileSync('app/components/workspace/top-workspace-shell.css', 'utf8');

describe('Owner Driver CX-level shell parity', () => {
  it('keeps the owner-driver primary IA intact', () => {
    for (const label of ['Dashboard','Loads','Quotes','My Jobs','Diary','Availability','Return Journeys','Directory','More']) {
      expect(shell).toContain(`'${label}'`);
    }
  });

  it('scopes visual changes to owner_driver only', () => {
    expect(css).toContain("data-workspace-role='owner_driver'");
    expect(css).toContain('PR675 Owner Driver: CX-level header and primary-nav visual parity');
  });

  it('uses compact CX-like header and nav proportions', () => {
    expect(css).toContain('height:54px!important');
    expect(css).toContain('height:42px!important');
    expect(css).toContain('text-transform:uppercase!important');
    expect(css).toContain('box-shadow:inset 0 -2px 0 #1d57d8!important');
  });
});