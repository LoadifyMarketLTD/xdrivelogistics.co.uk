import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  SuperAdminEmptyState,
  SuperAdminUnavailableState,
} from '../app/super-admin/_components/SuperAdminEnterprisePrimitives';
import { StatusChip } from '../app/super-admin/_components/superAdminFormatters';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const primitives = source('app/super-admin/_components/SuperAdminEnterprisePrimitives.tsx');
const primitiveCss = source('app/super-admin/_components/SuperAdminEnterprisePrimitives.module.css');
const liveTable = source('app/super-admin/_components/SuperAdminLiveTablePage.tsx');
const formatters = source('app/super-admin/_components/superAdminFormatters.tsx');

describe('Super Admin v3 enterprise primitives', () => {
  it('provides the canonical reusable page and data primitives', () => {
    for (const name of [
      'SuperAdminPageHeader',
      'SuperAdminMetricCard',
      'SuperAdminMetricGrid',
      'SuperAdminSectionCard',
      'SuperAdminStatusBadge',
      'SuperAdminFilterBar',
      'SuperAdminNotice',
      'SuperAdminEmptyState',
      'SuperAdminUnavailableState',
      'SuperAdminDataGrid',
      'SuperAdminPager',
    ]) expect(primitives).toContain(`export function ${name}`);
  });

  it('migrates shared live-table rendering to the v3 primitive system', () => {
    for (const name of [
      'SuperAdminPageHeader',
      'SuperAdminMetricCard',
      'SuperAdminDataGrid',
      'SuperAdminPager',
      'SuperAdminUnavailableState',
    ]) expect(liveTable).toContain(name);
    expect(liveTable).not.toContain("const ENTERPRISE_SHADOW");
    expect(liveTable).not.toContain("const X = {");
  });

  it('keeps empty and unavailable states semantically distinct', () => {
    const empty = renderToStaticMarkup(<SuperAdminEmptyState title="No records" />);
    const unavailable = renderToStaticMarkup(<SuperAdminUnavailableState title="Unavailable" />);
    expect(empty).toContain('data-state="empty"');
    expect(empty).not.toContain('role="alert"');
    expect(unavailable).toContain('data-state="unavailable"');
    expect(unavailable).toContain('role="alert"');
  });

  it('maps operational statuses onto the shared badge component', () => {
    expect(formatters).toContain('SuperAdminStatusBadge');
    const clear = renderToStaticMarkup(<StatusChip value="clear" />);
    const blocked = renderToStaticMarkup(<StatusChip value="blocked" />);
    const unknown = renderToStaticMarkup(<StatusChip value="something_new" />);
    expect(clear).toContain('clear');
    expect(blocked).toContain('blocked');
    expect(unknown).toContain('something new');
  });

  it('keeps the v3 density, responsive behavior and XDrive token palette centralized', () => {
    expect(primitiveCss).toContain('#0B2F6B');
    expect(primitiveCss).toContain('#1D57D8');
    expect(primitiveCss).toContain('#F4F6F8');
    expect(primitiveCss).toContain('border-radius: 8px');
    expect(primitiveCss).toContain('@media (max-width: 900px)');
    expect(primitiveCss).toContain('@media (max-width: 620px)');
    expect(primitiveCss).toContain('min-height: 48px');
  });

  it('does not introduce template branding into application primitives', () => {
    expect(primitives).not.toContain('CargoMax');
    expect(primitives).not.toContain('ShipNow');
    expect(primitiveCss).not.toContain('CargoMax');
    expect(primitiveCss).not.toContain('ShipNow');
  });
});

