import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Driver booking storyboard page 6', () => {
  it('uses an isolated On Site at Delivery component for persisted on_site_delivery state', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    expect(source).toContain("approvedScreen.number===6 && currentStatus==='on_site_delivery'");
    expect(source).toContain('<OnSiteDeliveryStep');
  });

  it('persists item count, weight, notes and delivery photos through the POD draft before Delivered', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    expect(source).toContain('const confirmDeliveredFromPage6 = async () =>');
    expect(source).toContain('const saved=await savePodDraftNow()');
    expect(source).toContain("await moveStatus('delivered')");
    expect(source).toContain('itemCount: podItemCount, weight: podWeight');
    expect(source).toContain('photoUris: pendingPodPhotos');
    expect(source).toContain('onPhotos={e=>void selectDeliveryPhotos(e)}');
  });

  it('prefills delivery quantity and weight from the recorded collection handover when available', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    expect(source).toContain('row.collection_handover?.itemCount');
    expect(source).toContain('row.collection_handover?.weightKg');
  });

  it('keeps recipient and signature capture out of page 6 because they belong to POD page 7', () => {
    const page=fs.readFileSync(path.join(process.cwd(),'app/driver-pwa-fresh/bookings/[id]/workflow/OnSiteDeliveryStep.tsx'),'utf8');
    expect(page).toContain('Items to Deliver');
    expect(page).toContain('Delivery Photos');
    expect(page).toContain('Confirm Delivered');
    expect(page).not.toContain('Received By');
    expect(page).not.toContain('Signature');
    expect(page).toContain('photoPaths.length>0');
  });

  it('loads secure signed previews for delivery evidence instead of exposing storage paths as image URLs', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    expect(source).toContain("fetch('/api/pod/signed-url?jobId='");
    expect(source).toContain('setDeliveryPhotoUrls(urls)');
  });
});
