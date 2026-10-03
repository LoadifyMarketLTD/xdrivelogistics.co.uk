import fs from 'node:fs';
import path from 'node:path';
import { isCapabilityAllowedForPath } from '../lib/roleCapabilities';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const ownerDriverContext = {
  workspaceRole: 'owner_driver' as const,
  driverId: 'owner-driver-1',
  canCommercialBid: true,
  driverStatus: 'active',
  appAccess: true,
  accountStatus: 'active',
  companyStatus: 'active',
};

describe('Owner Driver More on Preview 656 baseline', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const css = read('app/components/workspace/top-workspace-shell.css');
  const legacy = read('app/driver/more/page.tsx');

  it('uses a curated Owner Driver More list without settings and notification duplicates', () => {
    const start = shell.indexOf("ownerDriver ? [");
    const end = shell.indexOf("] : undefined);", start);
    const block = shell.slice(start, end);
    for (const label of [
      'My Jobs',
      'My Availability',
      'Won Work',
      'Auto-match & Alerts',
      "Who's Nearby",
      'Documents',
      'Invoices',
      'Messages',
      'Account',
    ]) expect(block).toContain(label);
    for (const removed of [
      'Notifications',
      'Security',
      'Company Profile',
      'Company Settings',
      'Membership & Billing',
    ]) expect(block).not.toContain(removed);
  });

  it('keeps every retained Owner Driver More route authorised', () => {
    for (const href of [
      '/driver/jobs',
      '/driver/availability',
      '/driver/won-work',
      '/driver/load-alerts',
      '/driver/nearby',
      '/driver/documents',
      '/driver/finance',
      '/driver/messages',
      '/driver/profile',
    ]) {
      expect(isCapabilityAllowedForPath(href, 'driver', ownerDriverContext), href).toBe(true);
    }
  });

  it('keeps Owner Driver More outside the horizontally scrolling nav track', () => {
    expect(shell).toContain('data-group-id={group.id}');
    expect(css).toContain('[data-group-id="owner-driver-more"] .top-workspace-nav__menu');
    expect(css).toContain('position: fixed;');
    expect(css).toContain('top: 92px !important;');
    expect(css).toContain('max-height: calc(100vh - 104px);');
    expect(css).toContain('overflow-y: auto;');
  });

  it('separates business/account tools from work and matching tools', () => {
    expect(shell).toContain("group.id === 'owner-driver-more' && item.href === '/driver/documents'");
    expect(css).toContain('data-section-start="true"');
  });

  it('retires the duplicated legacy /driver/more card page', () => {
    expect(legacy).toContain("redirect('/driver')");
    expect(legacy).not.toContain('Personal tools');
    expect(legacy).not.toContain('Support');
  });
});
