import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => fs.readFileSync(path, 'utf8');
const app = read('driver-pwa-next/src/ReserveApp.tsx');
const pod = read('driver-pwa-next/src/BookingDeliveryForm.tsx');
const booking = read('driver-pwa-next/src/BookingWorkspace.tsx');
const advertise = read('driver-pwa-next/src/PostPodAdvertise.tsx');

describe('Driver NEXT CX POD parity and server-confirmed completion', () => {
  it('uses one POD form with recipient, inline signature, Left At and evidence', () => {
    expect(pod).toContain('Proof of Delivery (POD)');
    expect(pod).toContain('Received By (Full Name)');
    expect(pod).toContain('Recipient signature *');
    expect(pod).toContain('<SignaturePad value={signature}');
    expect(pod).toContain('Left At');
    expect(pod).toContain('Camera');
    expect(pod).toContain('Image');
    expect(pod).toContain('Document');
    expect(pod).toContain('Confirm POD & Complete Delivery');
    expect(pod).not.toContain('if(signaturePage)');
    expect(pod).not.toContain('Save Signed POD');
  });

  it('requires the server to confirm signed POD before completing the booking', () => {
    expect(app).toContain('async function confirmPod(');
    expect(app).not.toContain('async function completeDelivery(');
    expect(app).not.toContain('async function savePod(');
    expect(app).toContain("nextStatus:'delivered'");
    expect(app).toContain("'/mobile/jobs/'+encodeURIComponent(j.id)+'/pod'");
    expect(app).toContain('if(!complete){');
    expect(app).toContain('setPodDone(true)');
    expect(app).toContain('setAvailabilityPrompt(j.id)');
    expect(app).toContain("status:'DELIVERED',podRecorded:false");
    expect(app).toContain("priorPaths(priorState.draft?.photoUris)");
    expect(app).toContain("priorPaths(priorState.draft?.documentUris)");
  });

  it('keeps Delivered/POD-pending bookings in Active until POD is recorded', () => {
    expect(booking).toContain("const podPending = job.status === 'DELIVERED' && !delivered;");
    expect(booking).toContain("'POD PENDING'");
    expect(booking).toContain("'Complete POD'");
    expect(app).toContain("bookingSection==='Delivered'?(j.status==='POD_SUBMITTED'||Boolean(j.podRecorded))");
  });

  it('requires hard-copy POD acknowledgement when requested by the customer', () => {
    expect(pod).toContain('job.hardCopyPodRequired&&');
    expect(pod).toContain('checked={hardCopyAcknowledged}');
    expect(app).toContain('hardCopyAcknowledged:!j.hardCopyPodRequired||hardCopyAcknowledged');
  });

  it('asks about availability only after signed POD, then offers Advertise for', () => {
    expect(app).toContain('Update status after POD');
    expect(app).toContain('Yes, update availability');
    expect(app).toContain('setAdvertiseJobId(availabilityPrompt)');
    expect(app).toContain('<PostPodAdvertise job={advertiseJob}');
    expect(advertise).toContain('Advertise for');
    expect(advertise).toContain("driverPost('/return-journeys'");
    expect(advertise).toContain("method:'PUT'");
    expect(advertise).toContain("availabilityStatus:'available'");
    expect(advertise).toContain('Publish availability');
  });

  it('does not publish return journey without a separate user confirmation', () => {
    expect(advertise).toContain('<form onSubmit={event=>void submit(event)}>');
    expect(advertise).toContain('if(busy||published)return;');
    expect(advertise).toContain('onClick={onCancel}');
  });
});
