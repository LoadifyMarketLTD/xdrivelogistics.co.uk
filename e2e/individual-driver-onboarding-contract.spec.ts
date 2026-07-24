import { expect, test } from '@playwright/test';

import {
  buildOnboardingUrl,
  normalizeOnboardingAccountType,
  resolveOnboardingAccountTypeFromMetadata,
} from '../app/api/_lib/onboarding';
import {
  individualDriverPayloadSchema,
  ownerDriverPayloadSchema,
} from '../app/api/onboarding/_lib/schemas';

test.describe('individual driver onboarding contract', () => {
  test('normalizes driver-only aliases without converting owner operators', () => {
    expect(normalizeOnboardingAccountType('individual_driver')).toBe('individual_driver');
    expect(normalizeOnboardingAccountType('driver_only')).toBe('individual_driver');
    expect(normalizeOnboardingAccountType('fleet_driver')).toBe('individual_driver');
    expect(normalizeOnboardingAccountType('owner_operator')).toBe('owner_driver');
  });

  test('specific requested role overrides the legacy owner_driver account_type', () => {
    expect(resolveOnboardingAccountTypeFromMetadata({
      requested_role: 'individual_driver',
      account_type: 'owner_driver',
    }, null)).toBe('individual_driver');

    expect(resolveOnboardingAccountTypeFromMetadata({
      requested_role: 'owner_operator',
      account_type: 'owner_driver',
    }, null)).toBe('owner_driver');
  });

  test('builds a dedicated individual-driver onboarding URL', () => {
    expect(buildOnboardingUrl('safe-token', 'individual_driver')).toContain(
      '/onboarding/individual-driver/safe-token',
    );
  });

  test('requires driver identity fields without requiring owner vehicle fields', () => {
    const driverPayload = {
      full_name: 'E2E Individual Driver',
      address: '1 Test Street',
      phone: '07000000000',
      email: 'driver.e2e@example.com',
      right_to_work_status: 'citizen',
    };

    expect(individualDriverPayloadSchema.safeParse(driverPayload).success).toBe(true);
    expect(individualDriverPayloadSchema.safeParse({ ...driverPayload, full_name: '' }).success).toBe(false);
    expect(individualDriverPayloadSchema.safeParse({ ...driverPayload, email: 'invalid' }).success).toBe(false);

    // Owner-driver remains a separate permissive compliance-reviewed payload.
    expect(ownerDriverPayloadSchema.safeParse({ registration: 'E2E123' }).success).toBe(true);
  });
});
