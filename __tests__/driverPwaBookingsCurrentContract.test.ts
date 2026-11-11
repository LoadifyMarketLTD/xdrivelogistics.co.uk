import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read = (p: string) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
describe('canonical Driver booking flow', () => {
  it('keeps pending booking acceptance in the live won-work workspace', () => {
    const page = read('app/driver/won-work/page.tsx');
    expect(page).toContain('PendingBookingOffers');
    expect(page).toContain('<PendingBookingOffers onChanged=');
  });
  it('keeps delivered bookings visible for mandatory POD in the canonical jobs workspace', () => {
    const page = read('app/driver/jobs/page.tsx');
    expect(page).toContain('isDeliveredAwaitingPod');
    expect(page).toContain('hasCompletePodEvidence');
  });
  it('requires POD before invoice in live execution', () => {
    const page = read('app/components/workspace/DriverJobExecutionPage.tsx');
    expect(page).toContain('Complete required POD');
    expect(page).toContain('hasCompletePodEvidence(job)');
    expect(page).toContain('Create Invoice');
  });
});
