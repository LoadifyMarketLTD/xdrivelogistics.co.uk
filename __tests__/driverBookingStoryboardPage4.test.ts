import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Driver booking storyboard page 4', () => {
  it('uses an isolated Loaded / Collected component for persisted loaded state', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    expect(source).toContain("approvedScreen.number===4 && currentStatus==='loaded'");
    expect(source).toContain('<LoadedCollectedStep');
  });

  it('builds collected rows from recorded handover rather than declared booking cargo', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    const start=source.indexOf("approvedScreen.number===4 && currentStatus==='loaded'");
    const end=source.indexOf('return <div className="fresh-mobile-booking"',start);
    const block=source.slice(start,end);
    expect(block).toContain('const handover=job.collection_handover');
    expect(block).toContain("handover?.itemCount");
    expect(block).toContain("handover?.weightKg");
    expect(block).not.toContain('sheet?.cargo.pallets');
    expect(block).not.toContain('job.id.slice');
  });

  it('keeps evidence and notes conditional and exposes only the next canonical action', () => {
    const page=fs.readFileSync(path.join(process.cwd(),'app/driver-pwa-fresh/bookings/[id]/workflow/LoadedCollectedStep.tsx'),'utf8');
    expect(page).toContain('const hasEvidence=photoCount>0||documentCount>0');
    expect(page).toContain('Collection confirmed');
    expect(page).toContain('On My Way to Delivery');
  });
});
