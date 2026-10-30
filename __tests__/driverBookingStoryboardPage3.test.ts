import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Driver booking storyboard page 3', () => {
  it('uses an isolated on-site-pickup component for the persisted lifecycle state', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    expect(source).toContain("approvedScreen.number===3 && currentStatus==='on_site_pickup'");
    expect(source).toContain('<OnSitePickupStep');
  });

  it('keeps collection evidence optional while supporting photos and documents', () => {
    const page=fs.readFileSync(path.join(process.cwd(),'app/driver-pwa-fresh/bookings/[id]/workflow/OnSitePickupStep.tsx'),'utf8');
    const handover=fs.readFileSync(path.join(process.cwd(),'app/api/driver/web/jobs/[id]/handover/route.ts'),'utf8');
    expect(page).toContain('Collection Evidence (optional)');
    expect(page).toContain('Camera / Photos');
    expect(page).toContain('Add Document');
    expect(handover).not.toContain('At least one collection photo');
  });

  it('sends staged collection documents with the real handover payload', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    expect(source).toContain('documentPaths: collectionDocuments');
    expect(source).toContain("'x-xdrive-evidence-category': 'documents'");
    expect(source).toContain("Confirm Loaded");
  });
});
