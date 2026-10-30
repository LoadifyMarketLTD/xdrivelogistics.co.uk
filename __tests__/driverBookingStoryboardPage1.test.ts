import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bookingAreaLabel } from '../app/driver-pwa-fresh/bookings/[id]/workflow/workflowPresentation';

describe('Driver booking storyboard page 1', () => {
  it('keeps the route summary to town/outcode while stops can show full addresses', () => {
    expect(bookingAreaLabel('Unit 4, Logistics Park, Blackburn BB1 2BB', 'BB1 2BB')).toBe('Blackburn BB1');
    expect(bookingAreaLabel('Industrial Estate, Manchester M2 2AB', 'M2 2AB')).toBe('Manchester M2');
  });

  it('uses the isolated Booking Details component for accepted bookings', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/DriverJobExecutionPage.tsx'), 'utf8');
    expect(source).toContain("approvedScreen.number===1 && currentStatus==='accepted'");
    expect(source).toContain('<BookingDetailsStep');
  });

  it('keeps the first page focused on customer, stops and the next operational action', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app/driver-pwa-fresh/bookings/[id]/workflow/BookingDetailsStep.tsx'), 'utf8');
    expect(source).toContain('Booking Details');
    expect(source).toContain('Customer');
    expect(source).toContain('Stops');
    expect(source).toContain('Status &amp; Next Action');
    expect(source).toContain('On My Way to Pickup');
  });
});
