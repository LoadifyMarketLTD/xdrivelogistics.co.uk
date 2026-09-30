import type { Page } from '@playwright/test';

export function directoryPayload(count = 2) {
  const companies = Array.from({ length: count }, (_, index) => ({
    companyId: `44444444-4444-4444-8444-${String(index + 1).padStart(12, '0')}`,
    name: `Fixture ${index === 0 ? 'North' : index === 1 ? 'South' : index + 1} Logistics`,
    memberId: `XD-TEST-${index + 1}`, businessPhone: '+440000000000',
    memberType: index === 0 ? 'Carrier / Fleet' : 'Owner Driver', memberSince: '2026-01-01',
    city: index === 0 ? 'Blackburn' : 'Manchester', postcode: index === 0 ? 'BB1' : 'M1', country: 'United Kingdom',
    vehicleTypes: ['Luton', 'LWB'], specialistServices: ['Tail lift', 'Same day'], maxPallets: 4,
    deliveryReliability: { score: index === 0 ? null : 96, evidenceCount: index === 0 ? 0 : 25, completedJobs: index === 0 ? 0 : 25 },
    paymentReliability: { score: null, evidenceCount: 0, onTimePaid: 0, latePaid: 0, overdueOpen: 0 }, distanceMiles: index + 1,
  }));
  const drivers = companies.slice(0, 2).map((company, index) => ({
    driverId: `55555555-5555-4555-8555-${String(index + 1).padStart(12, '0')}`, displayName: `Fixture Driver ${index + 1}`,
    companyId: company.companyId, companyName: company.name, memberId: company.memberId, memberType: company.memberType,
    businessPhone: company.businessPhone, city: company.city, postcode: company.postcode, country: company.country,
    availability: 'available', vehicleType: 'Luton', hasTailLift: true, palletsCapacity: 4, specialistServices: ['Tail lift'],
    deliveryReliability: company.deliveryReliability, paymentReliability: company.paymentReliability, distanceMiles: company.distanceMiles,
  }));
  return { companies, drivers, partial: false, truncation: {}, privacy: 'Fixture: broad company locations only; no live coordinates.', reputation: 'Fixture evidence only, not real member ratings.' };
}
export async function mockDirectory(page: Page, count = 2) {
  await page.route('**/api/directory?**', (route) => route.fulfill({ json: directoryPayload(count) }));
}
