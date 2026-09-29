import { expect, test } from '@playwright/test';

import {
  buildOnboardingUrl,
  normalizeOnboardingAccountType,
} from '../app/api/_lib/onboarding';
import {
  individualDriverPayloadSchema,
  ownerDriverPayloadSchema,
} from '../app/api/onboarding/_lib/schemas';
import {
  getOnboardingContract,
  normalizeCanonicalOnboardingAccountType,
  toPersistedOnboardingAccountType,
} from '../lib/onboardingContract';

test.describe('company-driver onboarding compatibility contract', () => {
  test('legacy driver aliases resolve to the invitation-only company-driver contract', () => {
    expect(normalizeOnboardingAccountType('individual_driver')).toBe('individual_driver');
    expect(normalizeOnboardingAccountType('driver_only')).toBe('individual_driver');
    expect(normalizeOnboardingAccountType('fleet_driver')).toBe('individual_driver');
    expect(normalizeCanonicalOnboardingAccountType('fleet_driver')).toBe('company_driver');
    expect(toPersistedOnboardingAccountType('company_driver')).toBe('individual_driver');
    expect(getOnboardingContract('company_driver')?.publicRegistration).toBe(false);
    expect(normalizeOnboardingAccountType('owner_operator')).toBe('owner_driver');
  });

  test('owner-driver remains a separate public carrier-owner onboarding contract', () => {
    expect(normalizeCanonicalOnboardingAccountType('owner_operator')).toBe('owner_driver');
    expect(toPersistedOnboardingAccountType('owner_operator')).toBe('owner_driver');
    expect(getOnboardingContract('owner_driver')?.publicRegistration).toBe(true);
    expect(getOnboardingContract('owner_driver')?.createsCompanyWorkspace).toBe(true);
  });

  test('builds a dedicated individual-driver onboarding URL', () => {
    expect(buildOnboardingUrl('safe-token', 'individual_driver')).toContain(
      '/onboarding/individual-driver/safe-token',
    );
  });

  test('requires driver identity fields without requiring owner vehicle fields', () => {
    const driverPayload = {
      full_name: 'E2E Individual Driver',
      dob: '1991-04-15',
      address: '1 Test Street',
      phone: '07000000000',
      email: 'driver.e2e@example.com',
      right_to_work_status: 'citizen',
    };

    expect(individualDriverPayloadSchema.safeParse(driverPayload).success).toBe(true);
    expect(individualDriverPayloadSchema.safeParse({ ...driverPayload, full_name: '' }).success).toBe(false);
    expect(individualDriverPayloadSchema.safeParse({ ...driverPayload, dob: '' }).success).toBe(false);
    expect(individualDriverPayloadSchema.safeParse({ ...driverPayload, right_to_work_status: '' }).success).toBe(false);
    expect(individualDriverPayloadSchema.safeParse({ ...driverPayload, email: 'invalid' }).success).toBe(false);

    // Owner-driver is a separate carrier-owner flow and must include the minimum
    // identity and canonical vehicle fields before it can be submitted.
    expect(ownerDriverPayloadSchema.safeParse({ registration: 'E2E123' }).success).toBe(false);
    expect(ownerDriverPayloadSchema.safeParse({
      full_name: 'E2E Owner Driver',
      dob: '1990-01-02',
      address: '1 Test Street',
      phone: '07000000001',
      email: 'owner.e2e@example.com',
      right_to_work_status: 'citizen',
      registration: 'E2E123',
      make: 'Mercedes-Benz',
      model: 'Sprinter',
    }).success).toBe(true);
  });
});
