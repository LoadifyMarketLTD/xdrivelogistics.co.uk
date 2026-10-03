import fs from 'node:fs';
import path from 'node:path';

import { isCapabilityAllowedForPath } from '../lib/roleCapabilities';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const ownerContext = {
  workspaceRole: 'owner_driver' as const,
  accountStatus: 'active',
  companyStatus: 'active',
  driverId: 'driver-owner-fixture',
  driverStatus: 'active',
  appAccess: true,
  canCommercialBid: true,
  ownerDriverWorkspace: true,
};

const MORE_ROUTES = [
  '/driver/jobs',
  '/driver/won-work',
  '/driver/availability',
  '/driver/load-alerts',
  '/driver/nearby',
  '/driver/finance',
  '/driver/documents',
  '/driver/messages',
] as const;

describe('Owner Driver More contract', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const css = read('app/components/workspace/top-workspace-shell.css');
  const owner = shell.slice(
    shell.indexOf('function composeDriverPrimaryNav'),
    shell.indexOf('function composeDispatcherPrimaryNav'),
  );

  it('keeps exactly the curated secondary Owner Driver routes', () => {
    const moreStart = owner.indexOf("], 'owner-driver-more', 'More', [");
    const moreEnd = owner.indexOf(']);', moreStart);
    const moreBlock = owner.slice(moreStart, moreEnd);

    for (const href of MORE_ROUTES) expect(moreBlock).toContain(`'${href}'`);

    for (const duplicate of [
      '/driver/notifications',
      '/driver/change-password',
      '/driver/profile',
      '/driver/settings',
      '/driver/settings?section=company',
      '/driver/settings?section=overview',
      '/settings/billing',
      '/driver/event-log',
      '/driver/loads',
      '/driver/quotes',
      '/driver/returns',
    ]) {
      expect(moreBlock).not.toContain(`'${duplicate}'`);
    }
  });

  it('uses labels that clearly distinguish secondary availability and matching from primary Live Availability', () => {
    expect(owner).toContain("label: 'Availability & Schedule'");
    expect(owner).toContain("label: 'Load Matching & Alerts'");
    expect(owner).toContain("label: 'Finance & Invoices'");
    expect(owner).toContain("['owner-driver-live-availability-primary', 'Live Availability', '/driver/availability/live']");
  });

  it('keeps stable Work, Matching & Availability, and Business section boundaries', () => {
    expect(shell).toContain("'/driver/jobs': 'Work'");
    expect(shell).toContain("'/driver/won-work': 'Work'");
    expect(shell).toContain("'/driver/availability': 'Matching & Availability'");
    expect(shell).toContain("'/driver/load-alerts': 'Matching & Availability'");
    expect(shell).toContain("'/driver/nearby': 'Matching & Availability'");
    expect(shell).toContain("'/driver/finance': 'Business'");
    expect(shell).toContain("'/driver/documents': 'Business'");
    expect(shell).toContain("'/driver/messages': 'Business'");
    expect(shell).toContain('section !== previousSection ? section : null');
  });

  it('renders stable Lucide icons for every Owner Driver More item instead of source mojibake', () => {
    expect(shell).toContain('const OWNER_DRIVER_MORE_ICONS = {');
    for (const href of MORE_ROUTES) expect(shell).toContain(`'${href}':`);
    expect(shell).toContain('<OwnerDriverMoreIcon item={item} />');
  });
  it('keeps every retained Owner Driver More route real and permitted', () => {
    for (const href of MORE_ROUTES) {
      const routePath = path.join(process.cwd(), 'app', ...href.split('/').filter(Boolean), 'page.tsx');
      expect(fs.existsSync(routePath), href).toBe(true);
      expect(isCapabilityAllowedForPath(href, null, ownerContext), href).toBe(true);
      const source = fs.readFileSync(routePath, 'utf8');
      expect(source).not.toMatch(/redirect\(\s*['"][^'"]+['"]\s*\)/);
    }
  });

  it('preserves the canonical compatibility redirect instead of reviving a standalone More page', () => {
    const legacy = read('app/driver/more/page.tsx');
    expect(legacy).toContain("redirect('/driver')");
    expect(legacy).not.toContain('MorePage');
  });

  it('supports Escape focus recovery and arrow-key menu navigation', () => {
    expect(shell).toContain('menuTriggerRefs');
    expect(shell).toContain("event.key !== 'Escape' || !openGroupId");
    expect(shell).toContain("['ArrowDown', 'ArrowUp', 'Home', 'End']");
    expect(shell).toContain('workspace-menu-trigger-');
    expect(shell).toContain('aria-labelledby');
  });

  it('keeps Owner Driver More compact on desktop and fluid on mobile', () => {
    expect(css).toContain('.top-workspace-shell[data-workspace-role="owner_driver"] .top-workspace-nav__menu');
    expect(css).toContain('width: 252px !important;');
    expect(css).toContain('.top-workspace-nav__menu-item:focus-visible');
    expect(css).toContain('@media (max-width: 768px)');
    expect(css).toContain('width: auto !important;');
    expect(css).toContain('@media (min-width: 481px) and (max-width: 768px)');
    expect(css).toContain('width: 280px !important;');
  });
});
