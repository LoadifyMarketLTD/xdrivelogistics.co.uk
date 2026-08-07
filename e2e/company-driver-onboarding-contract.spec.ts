import { expect, test } from '@playwright/test';

import {
  buildOnboardingUrl,
  normalizeOnboardingAccountType,
  resolveOnboardingAccountTypeFromMetadata,
} from '../app/api/_lib/onboarding';
import {
  companyDriverPayloadSchema,
  ownerDriverPayloadSchema,
} from '../app/api/onboarding/_lib/schemas';

test.describe('Company Driver onboarding contract', () => {
  test('uses Company Driver as the canonical invitation-only account type', () => {
    expect(normalizeOnboardingAccountType('company_driver')).toBe('company_driver');
    expect(normalizeOnboardingAccountType('individual_driver')).toBe('company_driver');
    expect(normalizeOnboardingAccountType('driver_only')).toBe('company_driver');
    expect(normalizeOnboardingAccountType('fleet_driver')).toBe('company_driver');
    expect(normalizeOnboardingAccountType('owner_operator')).toBe('owner_driver');
  });

  test('metadata resolves canonical product identities while accepting legacy aliases only at the read boundary', () => {
    expect(resolveOnboardingAccountTypeFromMetadata({
      requested_role: 'company_driver',
    }, null)).toBe('company_driver');

    expect(resolveOnboardingAccountTypeFromMetadata({
      requested_role: 'individual_driver',
    }, null)).toBe('company_driver');

    expect(resolveOnboardingAccountTypeFromMetadata({
      requested_role: 'owner_operator',
      account_type: 'owner_driver',
    }, null)).toBe('owner_driver');
  });

  test('keeps the historical invitation URL segment as an isolated compatibility boundary', () => {
    expect(buildOnboardingUrl('safe-token', 'company_driver')).toContain(
      '/onboarding/individual-driver/safe-token',
    );
  });

  test('requires Company Driver identity fields without requiring Owner Operator vehicle fields', () => {
    const driverPayload = {
      full_name: 'E2E Company Driver',
      address: '1 Test Street',
      phone: '07000000000',
      email: 'driver.e2e@example.com',
      right_to_work_status: 'citizen',
    };

    expect(companyDriverPayloadSchema.safeParse(driverPayload).success).toBe(true);
    expect(companyDriverPayloadSchema.safeParse({ ...driverPayload, full_name: '' }).success).toBe(false);
    expect(companyDriverPayloadSchema.safeParse({ ...driverPayload, email: 'invalid' }).success).toBe(false);

    // Owner Operator remains a separate compliance-reviewed business/driver identity.
    expect(ownerDriverPayloadSchema.safeParse({ registration: 'E2E123' }).success).toBe(true);
  });
});
