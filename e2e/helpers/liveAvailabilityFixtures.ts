import type { Page } from '@playwright/test';
import { COMPANY, OTHER, mockWorkspace } from './workspaceRecoveryFixtures';

export const LIVE_DRIVER = '66666666-6666-4666-8666-666666666666';
export async function mockLiveAvailability(page: Page) {
  const now = new Date().toISOString();
  await mockWorkspace(page, 'carrier', false, false, {
    drivers: [
      { id: LIVE_DRIVER, company_id: COMPANY, display_name: 'Fixture Available Driver', availability_status: 'available', status: 'active' },
      { id: '77777777-7777-4777-8777-777777777777', company_id: COMPANY, display_name: 'Fixture Busy Driver', availability_status: 'busy', status: 'active' },
    ],
    vehicles: [{ id: '88888888-8888-4888-8888-888888888888', company_id: COMPANY, assigned_driver_id: LIVE_DRIVER, type: 'Luton', reg_plate: 'TEST ONLY' }],
    driver_locations: [{ driver_id: LIVE_DRIVER, company_id: COMPANY, lat: 53.748, lng: -2.484, recorded_at: now }],
    jobs: [],
  });
  await page.route('**/api/workspace/operations-intelligence?**', (route) => route.fulfill({ json: {
    generatedAt: now, partial: false, futurePositions: [{ id: LIVE_DRIVER, futurePosition: 'Manchester M1', futurePositionDate: '2026-10-02T12:00:00Z', coordinates: { lat: 53.48, lng: -2.24 } }],
    vehicleAdvertising: [], returnJourneys: [], jobDetails: [], trackingEvents: [],
  } }));
  await page.route('**/api/availability/nearby?**', (route) => route.fulfill({ json: { positions: [{
    company_id: OTHER, scope: 'exchange', member_name: 'Fixture Exchange Member', member_code: 'XD-TEST-EXCHANGE', vehicle_type: 'LWB',
    payload_kg: null, pallets_capacity: null, has_tail_lift: null, lat: 53.5, lng: -2.2, recorded_at: now, distance_miles: 12,
  }] } }));
}
