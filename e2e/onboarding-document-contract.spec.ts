import { expect, test } from '@playwright/test';

import { requiredOnboardingDocuments } from '../lib/server/onboardingCompliance';

test.describe('Onboarding document contract', () => {
  test('Customer onboarding does not require compliance uploads', () => {
    expect(requiredOnboardingDocuments('customer_shipper', {})).toEqual([]);
  });

  test('Broker requires company, liability and VAT evidence when a VAT number is supplied', () => {
    expect(requiredOnboardingDocuments('broker_shipper', {})).toEqual([
      'company_registration',
      'public_liability',
    ]);
    expect(requiredOnboardingDocuments('broker_shipper', { vat_number: 'GB123456789' })).toEqual([
      'company_registration',
      'public_liability',
      'vat_registration',
    ]);
  });

  test('Fleet requires core insurance evidence and conditionally requires VAT and operator licence', () => {
    expect(requiredOnboardingDocuments('fleet_courier', {})).toEqual([
      'company_registration',
      'public_liability',
      'goods_in_transit',
      'vehicle_insurance',
    ]);
    expect(requiredOnboardingDocuments('fleet_courier', {
      vat_number: 'GB987654321',
      operator_licence_required: true,
    })).toEqual([
      'company_registration',
      'public_liability',
      'goods_in_transit',
      'vehicle_insurance',
      'vat_registration',
      'operator_licence',
    ]);
  });

  test('Owner Driver requires identity, address, insurance and right-to-work evidence', () => {
    expect(requiredOnboardingDocuments('owner_driver', { right_to_work_status: 'citizen' })).toEqual([
      'driving_licence',
      'proof_of_address',
      'insurance',
      'right_to_work',
    ]);
    expect(requiredOnboardingDocuments('owner_driver', {
      right_to_work_status: 'pre_settled',
      cpc_required: true,
    })).toEqual([
      'driving_licence',
      'proof_of_address',
      'insurance',
      'right_to_work',
      'visa_document',
      'cpc',
    ]);
  });
});
