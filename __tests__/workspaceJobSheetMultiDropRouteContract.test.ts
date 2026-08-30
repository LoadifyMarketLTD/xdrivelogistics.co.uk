import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(path.join(root, 'app/api/workspace/jobs/[jobId]/sheet/route.ts'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'app/components/workspace/CompanyJobSheetPanel.tsx'), 'utf8');

describe('workspace job sheet multi-drop route contract', () => {
  it('projects the persisted ordered job_stops route through the authorised job sheet endpoint', () => {
    expect(route).toContain("supabaseAdmin.from('job_stops')");
    expect(route).toContain(".order('sequence', { ascending: true })");
    expect(route).toContain('stops: routeStops');
    expect(route).toContain('stopsResult.error');
  });

  it('renders every persisted stop instead of collapsing multi-drop to pickup and delivery', () => {
    expect(panel).toContain('const routeStops = sheet.route.stops ?? []');
    expect(panel).toContain('const hasPersistedRoute = routeStops.length >= 2');
    expect(panel).toContain('routeStops.map((stop, index) =>');
    expect(panel).toContain('label={`Stop ${sequence} · ${human(stop.type)}`}');
    expect(panel).toContain('formatExecutionAddress(stop.address, stop.postcode)');
    expect(panel).toContain('value={stop.contactName ?? \'Not supplied\'}');
  });

  it('keeps the legacy two-point job-sheet fallback for historical bookings without job_stops', () => {
    expect(panel).toContain('<Detail label="Pickup"');
    expect(panel).toContain('<Detail label="Delivery"');
  });
});
