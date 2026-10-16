import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { composeDriverPrimaryNav } from '../app/components/workspace/TopWorkspaceShell';
import { getVisibleWorkspaceNav } from '../lib/workspaceRole';

describe('owner-driver navigation integration contract', () => {
  it('keeps a compact Owner Driver primary shell with a real More bucket', () => {
    const nav = composeDriverPrimaryNav(getVisibleWorkspaceNav('owner_driver'), true);
    expect(nav.some((group) => group.id === 'owner-driver-more')).toBe(true);
    expect(nav.some((group) => group.label === 'More')).toBe(true);
    const visible = new Set(nav.flatMap((group) => group.items.map((item) => item.href)));
    for (const href of ['/driver/won-work','/driver/availability','/driver/load-alerts','/driver/nearby','/driver/documents','/driver/finance','/driver/messages','/driver/event-log','/driver/freight-vision','/driver/drivers-vehicles','/driver/fleet','/driver/settings']) {
      expect(visible.has(href), href).toBe(true);
    }
  });

  it('labels finance, search, won work and dynamic detail shells instead of the generic My Work fallback', () => {
    const shell = fs.readFileSync(path.join(process.cwd(), 'app/driver/_components/DriverWorkspaceShell.tsx'), 'utf8');
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
    const search = fs.readFileSync(path.join(process.cwd(), 'app/driver/loads/search/page.tsx'), 'utf8');
    expect(search).not.toContain('220px search rail');
  });

  it('keeps parent workspace destinations in the shared shell instead of duplicating them inside page chrome', () => {
    const nav = composeDriverPrimaryNav(getVisibleWorkspaceNav('owner_driver'), true);
    const visible = new Set(nav.flatMap((group) => group.items.map((item) => item.href)));
    for (const href of ['/driver/loads', '/driver/quotes', '/driver/jobs', '/driver/history', '/driver/vehicles', '/driver/returns', '/driver/directory']) {
      expect(visible.has(href), href).toBe(true);
    }
    for (const href of ['/driver/action-centre', '/driver/load-alerts', '/driver/nearby', '/driver/documents', '/driver/messages', '/driver/freight-vision', '/driver/settings']) {
      expect(visible.has(href), href).toBe(true);
    }

    const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    expect(read('app/driver/loads/page.tsx')).not.toContain("router.push('/driver/load-alerts')");
    expect(read('app/driver/quotes/page.tsx')).not.toContain("href: '/driver/won-work'");
    expect(read('app/driver/drivers-vehicles/page.tsx')).not.toContain("onClick={() => router.push('/driver/documents')}");
    expect(read('app/driver/drivers-vehicles/page.tsx')).not.toContain('>Documents</button>');
    expect(visible.has('/driver/documents')).toBe(true);
    expect(read('app/driver/availability/page.tsx')).toContain("href: '/driver/availability/live'");
    expect(read('app/driver/nearby/page.tsx')).toContain("href: '/driver/availability'");
  });
});
