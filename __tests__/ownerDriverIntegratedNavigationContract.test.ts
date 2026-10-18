import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { composeDriverPrimaryNav } from '../app/components/workspace/TopWorkspaceShell';
import { getVisibleWorkspaceNav } from '../lib/workspaceRole';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('owner-driver navigation integration contract', () => {
  it('keeps a compact Owner Driver primary shell with a curated More bucket', () => {
    const nav = composeDriverPrimaryNav(getVisibleWorkspaceNav('owner_driver'), true);
    expect(nav.some((group) => group.id === 'owner-driver-more')).toBe(true);
    expect(nav.some((group) => group.label === 'More')).toBe(true);
    const visible = new Set(nav.flatMap((group) => group.items.map((item) => item.href)));

    for (const href of [
      '/driver',
      '/driver/action-centre',
      '/driver/directory',
      '/driver/availability/live',
      '/driver/fleet',
      '/driver/returns',
      '/driver/loads',
      '/driver/quotes',
      '/driver/jobs',
      '/driver/history',
      '/driver/settings',
      '/driver/availability',
      '/driver/load-alerts',
      '/driver/nearby',
      '/driver/documents',
      '/driver/finance',
      '/driver/messages',
      '/driver/event-log',
    ]) expect(visible.has(href), href).toBe(true);

    for (const retiredTopLevel of ['/driver/won-work', '/driver/vehicles', '/driver/drivers-vehicles', '/driver/freight-vision']) {
      expect(visible.has(retiredTopLevel), retiredTopLevel).toBe(false);
    }
  });

  it('keeps retired top-level resources reachable through their canonical workspaces', () => {
    const fleetNav = read('app/driver/_components/DriverFleetIntegratedNav.tsx');
    for (const href of ['/driver/fleet', '/driver/vehicles', '/driver/drivers-vehicles', '/driver/freight-vision']) {
      expect(fleetNav).toContain(`href: '${href}'`);
    }

    const quotes = read('app/driver/quotes/page.tsx');
    expect(quotes).toContain("if (stage === 'archived' || stage === 'accepted') return 'archived'");
    expect(quotes).toContain("type TabId = 'received' | 'archived' | 'submitted' | 'unsuccessful'");
  });

  it('labels finance, search, won work and dynamic detail shells instead of the generic My Work fallback', () => {
    const shell = read('app/driver/_components/DriverWorkspaceShell.tsx');
    for (const [route, label] of [
      ['/driver/finance', 'Finance'],
      ['/driver/loads/search', 'Search Loads'],
      ['/driver/won-work', 'Won Work'],
      ['/driver/action-centre', 'Action Centre'],
    ]) {
      expect(shell).toContain(`'${route}': '${label}'`);
    }
    expect(shell).toContain("pathname.startsWith('/driver/finance/invoices/')");
    expect(shell).toContain("pathname.endsWith('/edit') ? 'Edit Invoice' : 'Invoice Details'");
    expect(shell).toContain("pathname.startsWith('/driver/loads/')");
    expect(shell).toContain("return 'Load Details'");
  });

  it('does not duplicate parent-workspace routes inside child page chrome', () => {
    expect(read('app/driver/loads/page.tsx')).not.toContain("router.push('/driver/load-alerts')");
    expect(read('app/driver/quotes/page.tsx')).not.toContain("href: '/driver/won-work'");
    expect(read('app/driver/drivers-vehicles/page.tsx')).not.toContain("onClick={() => router.push('/driver/documents')}");
    expect(read('app/driver/drivers-vehicles/page.tsx')).not.toContain('>Documents</button>');
    expect(read('app/driver/availability/page.tsx')).toContain("href: '/driver/availability/live'");
    expect(read('app/driver/nearby/page.tsx')).toContain("href: '/driver/availability'");
  });
});
