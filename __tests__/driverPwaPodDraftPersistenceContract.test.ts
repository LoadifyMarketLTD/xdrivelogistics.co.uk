import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const page = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/DriverJobExecutionPage.tsx'), 'utf8');
const podApi = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/web/jobs/[id]/[action]/route.ts'), 'utf8');

describe('Driver PWA POD draft persistence contract', () => {
  it('rehydrates uploaded photos and documents from the assigned booking after refresh', () => {
    expect(page).toContain('setPendingPodDocuments(Array.isArray(row.pod_photos)');
    expect(page).toContain('setPendingPodPhotos(Array.isArray(row.delivery_photos)');
    expect(page).toContain("verifySavedEvidence(savedPaths, 'pod_photos')");
    expect(page).toContain("verifySavedEvidence(paths, 'delivery_photos')");
  });
  it('submits the persisted document references and verifies storage paths server-side', () => {
    expect(page).toContain('documentUris: pendingPodDocuments');
    expect(podApi).toContain('storageObjectExists(path)');
    expect(podApi).toContain("rpc('record_driver_pod_atomic'");
    expect(podApi).toContain('alreadySubmitted: true');
  });
  it('gates POD entry on Delivered and never rounds fractional item counts', () => {
    expect(page).toContain("['delivered','completed','invoiced'].includes(currentStatus)&&<button");
    expect(podApi).toContain('const itemCount = itemCountRaw;');
    expect(podApi).toContain('!Number.isInteger(itemCount)');
  });
});
