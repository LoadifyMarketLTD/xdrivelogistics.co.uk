import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('Driver PWA reference parity - 30 Oct 2026', () => {
  it('persists Alerts folders and unread state and exposes NEW badges', () => {
    const loads = source('app/driver-pwa-fresh/jobs/LoadsClient.tsx');
    const card = source('app/driver-pwa-fresh/FreshJobCard.tsx');
    expect(loads).toContain('xdrive-driver-saved-load-ids');
    expect(loads).toContain('xdrive-driver-deleted-load-ids');
    expect(loads).toContain('xdrive-driver-seen-load-ids');
    expect(loads).toContain("Notification Reason:");
    expect(card).toContain('fresh-new-badge');
    expect(card).toContain('NEW');
  });

  it('keeps the reference quote outcome lifecycle', () => {
    const quotes = source('app/driver-pwa-fresh/quotes/page.tsx');
    expect(quotes).toContain("'submitted'|'unsuccessful'");
    expect(quotes).toContain("jobStatus==='cancelled'?'Cancelled'");
    expect(quotes).toContain("'Sold'");
    expect(quotes).toContain('Your Quote was Unsuccessful');
    expect(quotes).toContain('FreshSectionTabs');
  });

  it('supports Received Booking accept/decline inside the Driver PWA', () => {
    const offers = source('app/driver-pwa-fresh/booking-offers/page.tsx');
    expect(offers).toContain('ACCEPTANCE REQUIRED');
    expect(offers).toContain('Decline Job');
    expect(offers).toContain('Accept Job');
    expect(offers).toContain("/api/booking-offers/");
    expect(offers).toContain('FreshSectionTabs');
  });

  it('renders persisted multi-stop workflow with stop evidence and ordered completion', () => {
    const execution = source('app/components/workspace/DriverJobExecutionPage.tsx');
    const webAction = source('app/api/driver/web/jobs/[id]/[action]/route.ts');
    expect(execution).toContain('Multi-stop booking');
    expect(execution).toContain('Complete the earlier stop first.');
    expect(execution).toContain("selectStopEvidence(stop,'photos'");
    expect(execution).toContain("selectStopEvidence(stop,'documents'");
    expect(execution).toContain("updateStopStatus(stop,'completed')");
    expect(webAction).toContain('requireCollectionsComplete');
    expect(webAction).toContain('Complete all collection stops before starting the delivery journey.');
    expect(webAction).toContain('requireFinalDeliveryArrivalReady');
  });

  it('requires delivery departure ETA and captures operational references', () => {
    const execution = source('app/components/workspace/DriverJobExecutionPage.tsx');
    const route = source('app/api/driver/web/jobs/[id]/delivery-departure/route.ts');
    expect(execution).toContain('Enter your ETA for this Delivery');
    expect(execution).toContain('Your Ref');
    expect(execution).toContain('Customer Ref');
    expect(execution).toContain('Number Of Items');
    expect(execution).toContain('saveDepartureDetails');
    expect(route).toContain('driver_delivery_departure_details');
    expect(route).toContain('Complete all collection stops before saving the delivery ETA.');
    expect(route).toContain('booking_reference');
    expect(route).toContain('customer_reference');
  });

  it('provides collection document scan workflow and post-POD availability prompt', () => {
    const execution = source('app/components/workspace/DriverJobExecutionPage.tsx');
    expect(execution).toContain('Scan Document');
    expect(execution).toContain('to add another page');
    expect(execution).toContain('Scan Complete');
    expect(execution).toContain('showAvailabilityPrompt');
    expect(execution).toContain('Would you like to update your availability status now?');
    expect(execution).toContain("router.push('/driver/availability')");
  });

  it('keeps undo consistent with persisted stop state', () => {
    const execution = source('app/components/workspace/DriverJobExecutionPage.tsx');
    const undo = source('app/api/driver/web/jobs/[id]/webUndoStatus.ts');
    expect(execution).toContain('undoCurrentStatus');
    expect(execution).toContain('>Undo</button>');
    expect(undo).toContain("current==='loaded'?'completed':'arrived'");
    expect(undo).toContain("targetStatus=current==='loaded'?'arrived':'pending'");
    expect(undo).toContain('restoreStopRollback');
  });

  it('uses real XDrive member data rather than reference-app SmartPay', () => {
    const detail = source('app/driver-pwa-fresh/jobs/[id]/page.tsx');
    const profile = source('app/api/member-profile/[companyId]/route.ts');
    const pwaSources = [
      source('app/driver-pwa-fresh/jobs/LoadsClient.tsx'),
      source('app/driver-pwa-fresh/jobs/[id]/page.tsx'),
      source('app/driver-pwa-fresh/booking-offers/page.tsx'),
      source('app/driver-pwa-fresh/quotes/page.tsx'),
    ].join('\n');
    expect(detail).toContain('/api/member-profile/');
    expect(detail).toContain('Feedback (Last 90 days)');
    expect(detail).toContain('fresh-call-button');
    expect(profile).toContain('feedbackLast90Days');
    expect(pwaSources).not.toContain('SmartPay Enabled');
  });
});
