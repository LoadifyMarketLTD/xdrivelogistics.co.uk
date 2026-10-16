import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const exactLabels = (source: string, labels: string[]) => {
  for (const label of labels) {
    const escaped = label.replaceAll('&', '&amp;');
    expect(source.includes(label) || source.includes(escaped), `missing CX label: ${label}`).toBe(true);
  }
};

describe('Courier Exchange live operational subtab contract', () => {
  it('locks shared Live Availability to the exact CX audience tabs', () => {
    const admin = read('app/admin/live-availability/page.tsx');
    const driver = read('app/driver/availability/live/page.tsx');
    for (const source of [admin, driver]) exactLabels(source, ['All', 'Drivers & Sub-contractors', 'Other Drivers']);
    expect(admin).not.toContain('>Future</button>');
  });

  it('locks My Fleet to Live/Future, audience tabs, search rail and map-backed capacity', () => {
    const fleet = read('app/admin/fleet/vehicles/page.tsx');
    const driverFleet = read('app/driver/fleet/page.tsx');
    const driverAvailability = read('app/driver/availability/live/page.tsx');
    exactLabels(fleet, ['My Fleet', 'Add Future Position', 'Live', 'Future', 'All', 'Drivers & Sub-contractors', 'Other Drivers', 'Search Panel']);
    expect(fleet).toContain('<FleetPositionMap');
    expect(driverFleet).toContain('DriverAvailabilityLiveWorkspace mode="fleet"');
    exactLabels(driverAvailability, ['Add Future Position', 'Live', 'Future', 'All', 'Drivers & Sub-contractors', 'Other Drivers']);
    expect(driverAvailability).toContain('<DriverNearbyMap');
  });

  it('locks Return Journeys to the CX type tabs and keeps actions separate', () => {
    const admin = read('app/admin/fleet/returns/page.tsx');
    const driver = read('app/driver/returns/page.tsx');
    for (const source of [admin, driver]) exactLabels(source, ['All', 'Ad Hoc', 'Regular']);
    expect(driver).toContain('Add Journey');
    expect(driver).toContain('Our Journeys');
    expect(admin).toContain('Publish Return Journey');
  });

  it('locks Loads to All Live / On Demand / Regular Load / Daily Hire', () => {
    const company = read('app/components/workspace/CompanyMarketplaceExchange.tsx');
    const driver = read('app/driver/loads/page.tsx');
    for (const source of [company, driver]) exactLabels(source, ['All Live', 'On Demand', 'Regular Load', 'Daily Hire']);
  });

  it('locks Quotes to Received / Archived / Submitted / Unsuccessful across all quote surfaces', () => {
    for (const file of [
      'app/components/workspace/CompanyMarketplaceExchange.tsx',
      'app/admin/quotes/page.tsx',
      'app/driver/quotes/page.tsx',
      'app/broker/bids/page.tsx',
      'app/customer/quotes/CustomerQuotesCxPage.tsx',
    ]) {
      const source = read(file);
      exactLabels(source, ['Received', 'Archived', 'Submitted', 'Unsuccessful']);
      expect(source).toContain('cx-quote-state-tabs');
      expect(source).not.toContain('Accepted / Won');
    }
  });

  it('locks the full operational Diary profile to the nine CX states and keeps POD record-local', () => {
    const diary = read('lib/diary/canonicalDiary.ts');
    exactLabels(diary, ['All', 'Unallocated', 'Allocated', 'In Progress', 'Completed', 'Cancelled', 'Expired', 'Awaiting Feedback', 'Recent Feedback']);
    const base = diary.slice(diary.indexOf('const BASE_OPERATIONAL_TABS'), diary.indexOf('export const CANONICAL_DIARY_TABS_BY_ROLE'));
    expect(base).not.toContain('POD / Evidence');
  });

  it('locks Freight Vision to All In Progress / Live Tracked', () => {
    for (const file of ['app/admin/freight-vision/page.tsx', 'app/driver/freight-vision/page.tsx']) {
      exactLabels(read(file), ['All In Progress', 'Live Tracked']);
    }
  });

  it('locks Drivers & Vehicles to Users / Drivers / Company Vehicles / Vehicle Tracking', () => {
    for (const file of ['app/admin/fleet/resources/page.tsx', 'app/driver/drivers-vehicles/page.tsx']) {
      const source = read(file);
      exactLabels(source, ['Users / Drivers', 'Company Vehicles', 'Vehicle Tracking']);
      expect(source).not.toContain('>Documents</button>');
      expect(source).not.toContain('>Event Log</button>');
    }
  });
});
