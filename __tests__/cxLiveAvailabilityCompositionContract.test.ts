import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app/admin/live-availability/page.tsx'), 'utf8');

describe('CX-close Live Availability composition', () => {
  it('uses role-specific compact operational signals instead of the old KPI wall', () => {
    expect(source).toContain('OperationalSignalStrip');
    expect(source).not.toContain('KpiGrid');
    expect(source).not.toContain('<KpiCard');
  });

  it('keeps the exact Courier Exchange live availability tabs', () => {
    expect(source).toContain('>All</button>');
    expect(source).toContain('>Drivers &amp; Sub-contractors</button>');
    expect(source).toContain('>Other Drivers <span');
    expect(source).not.toContain('>Future</button>');
    const tabs = source.indexOf('aria-label="Availability views"');
    const signals = source.indexOf('<OperationalSignalStrip');
    expect(tabs).toBeGreaterThan(0);
    expect(signals).toBeGreaterThan(tabs);
  });

  it('keeps meaningful Fleet signals without imposing a global dashboard count', () => {
    expect(source).toContain("label: 'Available'");
    expect(source).toContain("label: 'Busy'");
    expect(source).toContain("label: 'Fresh locations'");
    expect(source).toContain("label: 'Stale / missing'");
    expect(source).toContain("label: 'Future positions'");
    expect(source).toContain("label: 'Availability conflicts'");
  });

  it('uses the measured control geometry', () => {
    expect(source).toContain('minHeight: 32');
    expect(source).toContain('borderRadius: 4');
    expect(source).toContain('className="workspace-tab-strip"');
    expect(source).toContain("data-active={tab === 'live' ? 'true' : 'false'}");
  });

  it('stacks Fleet and Nearby Exchange filter fields using shared workspace geometry at tablet and mobile widths', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/workspace-measured-cx-baseline.css'), 'utf8');
    expect(source).toContain('className="workspace-filter-fields"');
    expect(source).not.toContain("gridTemplateColumns: tab === 'live'");
    expect(css).toContain('.xdrive-workspace-measured .workspace-filter-fields');
    expect(css).toMatch(/@media \(max-width: 1024px\)[\s\S]*?\.workspace-filter-fields\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;/);
    expect(css).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.workspace-filter-fields\s*\{\s*grid-template-columns: minmax\(0, 1fr\) !important;/);
    expect(css).toContain('.workspace-filter-fields > :first-child');
  });

  it('supports CX-style saved availability defaults without inventing server preferences', () => {
    expect(source).toContain('LIVE_AVAILABILITY_DEFAULTS_KEY');
    expect(source).toContain('window.localStorage.setItem');
    expect(source).toContain('Save Default');
    expect(source).toContain('Load Default');
    expect(source).toContain('Clear');
  });

  it('preserves privacy-scoped Nearby Exchange behaviour', () => {
    expect(source).toContain('/api/availability/nearby');
    expect(source).toContain("position.scope === 'exchange'");
    expect(source).toContain('driver identity is not disclosed');
  });

  it('adds CX-style contextual actions without exposing driver identity', () => {
    expect(source).toContain('/admin/messages?companyId=');
    expect(source).toContain('/admin/post-load?directCarrier=');
    expect(source).toContain('Message');
    expect(source).toContain('Book Direct');
    expect(source).not.toContain('position.driver_id');
  });

  it('does not introduce Super Admin coupling', () => {
    expect(source).not.toContain('/super-admin');
  });
});
