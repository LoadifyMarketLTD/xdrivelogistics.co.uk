import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Driver execution dashboard contract', () => {
  const page = read('app/driver/page.tsx');
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');

  it('keeps the home screen focused on current execution', () => {
    for (const marker of ['Current assignment','NEXT ACTION','Next booking','Driver readiness']) expect(page).toContain(marker);
    expect(page).toContain('Your current job, next action and next booking.');
  });

  it('uses the canonical shared lifecycle and mutation authority', () => {
    expect(page).toContain('workspaceJobPresentationStatus');
    expect(page).toContain('jobLifecyclePresentationGroup');
    expect(page).toContain('nextDriverExecutionStatus');
    expect(page).toContain("supabase.rpc('driver_update_job_status_atomic'");
  });

  it('keeps evidence-gated pickup and delivery steps on the full job screen', () => {
    expect(page).toContain("label: 'Add collection evidence'");
    expect(page).toContain("label: 'Capture POD'");
    expect(page).toContain("mode: 'open'");
  });

  it('does not load marketplace data for an employed Driver dashboard', () => {
    expect(page).not.toContain("fetch('/api/driver/marketplace/loads'");
    expect(page).not.toContain('Matching loads');
  });

  it('shows commercial tools only when commercial authority exists', () => {
    expect(page).toContain("const commercialAccess = ownerDriver || user?.canCommercialBid === true");
    expect(page).toContain("{ownerDriver ? (");
    expect(page).toContain('Current assignment');
    expect(page).toContain('Next booking');
    expect(page).toContain('Driver readiness');
    expect(page).toContain('/api/driver/dashboard/commercial-summary');
    expect(page).toContain('{commercialAccess && !ownerDriver ? (');
    for (const route of ['/driver/loads','/driver/quotes','/driver/won-work','/driver/nearby','/driver/returns']) expect(page + shell).toContain(route);
    expect(page).not.toContain('Owner-driver commercial tools');
  });

  it('keeps core execution routes one click away through the unified shell', () => {
    for (const route of ['/driver/jobs','/driver/history','/driver/availability','/driver/vehicles','/driver/documents','/driver/messages','/driver/event-log']) expect(page + shell).toContain(route);
  });
});
