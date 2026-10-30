import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Driver booking storyboard page 7', () => {
  it('uses an isolated Proof of Delivery component for the delivered stage and the dedicated POD route', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    expect(source).toContain("approvedScreen.number===7 && ['delivered','completed'].includes(currentStatus)");
    expect(source).toContain('<ProofOfDeliveryStep');
    expect(source).toContain('podOnly ||');
    const route=fs.readFileSync(path.join(process.cwd(),'app/driver-pwa-fresh/bookings/[id]/pod/page.tsx'),'utf8');
    expect(route).not.toContain('fresh-booking-detail-header');
  });

  it('restores and autosaves the persistent POD draft after a delivered-page refresh', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    expect(source).toContain("['on_site_delivery','delivered','completed'].includes(podDraftStatus)");
    expect(source).toContain('if (!podDraftActive || loading || !podJobId || podAlreadyComplete) return;');
    expect(source).toContain('if (!podDraftActive || !podDraftLoaded || !podJobId || podAlreadyComplete) return;');
  });

  it('keeps delivery evidence, recipient, left-at, signature and final confirmation in page 7', () => {
    const page=fs.readFileSync(path.join(process.cwd(),'app/driver-pwa-fresh/bookings/[id]/workflow/ProofOfDeliveryStep.tsx'),'utf8');
    expect(page).toContain('1. Delivery Information');
    expect(page).toContain('2. Delivery Evidence');
    expect(page).toContain('3. Recipient & Signature');
    expect(page).toContain('4. Final Confirmation');
    expect(page).toContain('Send & Complete POD');
    expect(page).toContain('Save POD Draft');
  });

  it('retains real POD completion gates and does not allow exception statuses to be finalised', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    expect(source).toContain("if (!deliveryPhotos.length)");
    expect(source).toContain("if (!recipientName.trim())");
    expect(source).toContain('if (!newSignature && !savedSignatureData && !hasStoredSignature)');
    expect(source).toContain("if (mobilePwa && !podLeftAt.trim())");
    expect(source).toContain("podDeliveryStatus !== 'Completed Delivery'");
    expect(source).toContain('hardCopyRequired && !hardCopyAcknowledged');
  });

  it('derives the delivery date from a persisted Delivered event when the POD record has no date yet', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    expect(source).toContain("entry.eventType==='delivered'&&entry.createdAt");
    expect(source).toContain("setPodDeliveredOn(deliveredDate.toISOString().slice(0,10))");
  });
});
