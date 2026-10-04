import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

function pageFiles(relative: string): string[] {
  const absolute = path.join(root, relative);
  const rows: string[] = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) rows.push(...pageFiles(child));
    else if (entry.name === 'page.tsx') rows.push(child.replace(/\\/g, '/'));
  }
  return rows;
}

const workspacePages = [
  ...pageFiles('app/admin'),
  ...pageFiles('app/broker'),
  ...pageFiles('app/customer'),
].sort();
describe('all non-driver workspace pages follow the Owner Driver reference contract', () => {
  it('audits every current Admin, Broker and Customer route page', () => {
    expect(workspacePages).toHaveLength(123);
    for (const file of workspacePages) {
      const source = read(file);
      const lines = source.split(/\r?\n/).length;
      const canonical =
        /<PageFrame|<OperationalPageLayout|carrier-(?:register|detail|redirect)-page/.test(source);
      const shared =
        /components\/workspace|AdminWorkspaceModules|CustomerWorkspaceModules|CustomerOperationalPages|CustomerDashboardHome|BrokerDashboardHome|FleetActiveJobsPage/.test(source);
      const compatibility = /redirect\(/.test(source) || (lines <= 8 && /return\s+<\w+/.test(source));
      expect(canonical || shared || compatibility, `Unclassified workspace page: ${file}`).toBe(true);
    }
  });

  it('scopes the reference adapter to non-driver workspace layouts only', () => {
    for (const layout of ['app/admin/layout.tsx', 'app/broker/layout.tsx', 'app/customer/layout.tsx']) {
      expect(read(layout)).toContain('xdrive-owner-reference-workspace');
      expect(read(layout)).toContain('non-driver-owner-reference.css');
    }
    expect(read('app/driver/layout.tsx')).not.toContain('non-driver-owner-reference.css');
    expect(read('app/driver/layout.tsx')).not.toContain('xdrive-owner-reference-workspace');
  });
  it('locks the agreed dense operational geometry', () => {
    const css = read('app/components/workspace/non-driver-owner-reference.css');
    for (const marker of [
      '--owner-ref-page-x: 10px',
      '--owner-ref-page-y: 8px',
      '--owner-ref-gap: 8px',
      '--owner-ref-rail: 185px',
      '--owner-ref-control: 32px',
      '--owner-ref-tab: 38px',
      '--owner-ref-table-head: 36px',
      '--owner-ref-table-row: 46px',
      '--owner-ref-title: 21px',
      '--owner-ref-body: 12.5px',
      '--owner-ref-label: 11.5px',
      '--owner-ref-radius: 4px',
      'grid-template-columns: 185px minmax(0, 1fr) !important',
      'min-height: 52px !important',
    ]) expect(css).toContain(marker);
  });

  it('keeps the forbidden workspace scopes out of the adapter', () => {
    const css = read('app/components/workspace/non-driver-owner-reference.css');
    expect(css).not.toContain('.driver-prototype-app');
    expect(css).not.toContain('.xdrive-driver-workspace');
    expect(css).not.toContain('.super-admin');
  });

  it('uses isolated shared-component hooks so existing Driver selectors are not activated', () => {
    const ui = read('app/components/workspace/WorkspaceUI.tsx');
    expect(ui).toContain('owner-ref-hook-action-button');
    expect(ui).toContain('owner-ref-hook-empty-state');
    expect(ui).not.toContain('className="xdrive-action-button"');
    expect(ui).not.toContain('className="xdrive-empty-state ');
  });
});
