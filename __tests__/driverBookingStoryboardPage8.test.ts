import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Driver booking storyboard page 8', () => {
  it('uses an isolated POD Recorded component only after POD completion', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    expect(source).toContain("approvedScreen.number===8 && podComplete && sheet?.pod");
    expect(source).toContain('<PodRecordedStep');
  });

  it('shows only persisted POD summary fields and does not fabricate a POD reference', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    const start=source.indexOf("approvedScreen.number===8 && podComplete && sheet?.pod");
    const end=source.indexOf('return <div className="fresh-mobile-booking"',start);
    const block=source.slice(start,end);
    expect(block).toContain('sheet.pod.receiverName');
    expect(block).toContain('sheet.pod.leftAt');
    expect(block).toContain('sheet.pod.itemCount');
    expect(block).toContain('sheet.pod.photoCount');
    expect(block).toContain('sheet.pod.signatureRecorded');
    expect(block).not.toContain('sheet?.cargo.weightKg');
    expect(block).not.toContain('job.id.slice');
    expect(block).not.toMatch(/POD-20\d\d/);
  });

  it('shows weight only when it was persisted in POD notes and removes the storage marker from driver notes', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    expect(source).toContain("const weightSegment=podNoteSegments.find(value=>/^Weight:");
    expect(source).toContain("const recordedWeight=weightSegment?.replace(/^Weight:");
    expect(source).toContain("filter(value=>!/^Hard-copy POD requirement acknowledged");
  });

  it('opens the actual generated POD PDF and keeps invoice creation permission-aware', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    expect(source).toContain('const viewPodPdf = async () =>');
    expect(source).toContain("/api/workspace/jobs/${encodeURIComponent(job.id)}/pod/pdf");
    expect(source).toContain('canCreateInvoice={canGenerateInvoices}');
    const page=fs.readFileSync(path.join(process.cwd(),'app/driver-pwa-fresh/bookings/[id]/workflow/PodRecordedStep.tsx'),'utf8');
    expect(page).toContain('POD saved successfully');
    expect(page).toContain('Proof of Delivery PDF');
    expect(page).toContain('View PDF');
    expect(page).toContain('Create Invoice');
    expect(page).toContain('carrier company owner or administrator');
  });
});
