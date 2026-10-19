import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'app/admin/live-availability/page.tsx'), 'utf8');

describe('CX-close Live Availability composition', () => {
  it('uses the current CX operational layout instead of a dashboard preamble', () => {
    expect(source).toContain('<OperationalPageLayout');
    expect(source).toContain('<OperationalFilters');
    expect(source).not.toContain('<OperationalSignalStrip');
    expect(source).not.toContain('<PageHeader');
    expect(source).not.toContain('Fleet resources');
    expect(source).not.toContain('Intelligence updated');
  });

  it('keeps the CX left rail controls and availability period switch', () => {
    for (const label of ['Add Future Position', 'Live', 'Future', 'Search Panel', 'Location', 'Radius Search', 'Availability Status', 'Member / Driver', 'Vehicle Size', 'Body Type', 'My Sub-contractors', 'Groups', 'UK &amp; Euro', 'Euro', 'Display dropdown version', 'Add / Edit Groups']) {
      expect(source).toContain(label);
    }
    expect(source).toContain('xdrive-vehicle-size-range');
    expect(source).toContain('saveAsDefault={saveAsDefault}');
    expect(source).toContain('onClear={clearFilters}');
  });

  it('keeps the exact CX audience strip above the map', () => {
    expect(source).toContain('>All</button>');
    expect(source).toContain('>Drivers &amp; Sub-contractors</button>');
    expect(source).toContain('>Other Drivers <span');
    expect(source).toContain('aria-label="Quick Search"');
    const tabs = source.indexOf('aria-label="Availability views"');
    const map = source.indexOf('<FleetPositionMap', tabs);
    expect(tabs).toBeGreaterThan(0);
    expect(map).toBeGreaterThan(tabs);
  });

  it('keeps the map dominant and the CX register below it', () => {
    const map = source.indexOf('height={300}');
    const register = source.indexOf("columns={['Member (ID)', 'Phone', 'Vehicle Size', 'Current Location', 'Home Location', 'Location Received', 'Journeys']}");
    expect(map).toBeGreaterThan(0);
    expect(register).toBeGreaterThan(map);
    expect(source).not.toContain('<TwoColumn');
  });

  it('supports CX-style saved availability defaults without inventing server preferences', () => {
    expect(source).toContain('LIVE_AVAILABILITY_DEFAULTS_KEY');
    expect(source).toContain('window.localStorage.setItem');
    expect(source).toContain('loadDefaults();');
    expect(source).toContain('Clear');
    expect(source).not.toContain('>Load Default<');
  });

  it('preserves privacy-scoped Exchange discovery and postcode area lookup', () => {
    expect(source).toContain('/api/availability/nearby');
    expect(source).toContain("position.scope === 'exchange'");
    expect(source).toContain('/api/location/postcode-area');
    expect(source).toContain('workspace-postcode-area');
    expect(source).not.toContain('position.driver_id');
  });

  it('does not introduce Super Admin coupling', () => {
    expect(source).not.toContain('/super-admin');
  });
});
