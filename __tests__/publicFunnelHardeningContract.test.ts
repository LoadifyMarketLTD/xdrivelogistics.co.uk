import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assessOnboardingRecovery, calculateOnboardingProgress } from '../lib/onboardingProgress';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('public funnel hardening', () => {
  const middleware = read('middleware.ts');
  const handlers = read('app/api/onboarding/_lib/handlers.ts');
  const schemas = read('app/api/onboarding/_lib/schemas.ts');
  const broker = read('app/onboarding/_components/BrokerOnboarding.tsx');
  const generic = read('app/onboarding/[token]/page.tsx');
  const marketing = read('app/(marketing)/_components/MarketingDetailPage.tsx');
  const nextConfig = read('next.config.mjs');
  const homepage = read('app/page.tsx');
  const loginLayout = read('app/login/layout.tsx');
  const registerLayout = read('app/register/layout.tsx');
  const onboardingLayout = read('app/onboarding/layout.tsx');
  const rootLayout = read('app/layout.tsx');
  const onboardingSession = read('app/api/onboarding/session/route.ts');

  it('applies middleware CSP to homepage, auth and onboarding routes', () => {
    expect(middleware).toContain("const styleSrc = `'self' 'unsafe-inline'`");
    expect(middleware).not.toContain("script-src 'self' 'unsafe-inline'");
    for (const route of [
      "'/'",
      "'/login/:path*'",
      "'/register/:path*'",
      "'/onboarding/:path*'",
      "'/auth/:path*'",
      "'/reset-password/:path*'",
    ]) {
      expect(middleware).toContain(route);
    }
  });

  it('keeps onboarding token GET read-only and activates on authenticated PATCH', () => {
    const getStart = handlers.indexOf('const GET = async');
    const patchStart = handlers.indexOf('const PATCH = async');
    const getSource = handlers.slice(getStart, patchStart);
    const patchSource = handlers.slice(patchStart, handlers.indexOf('return { GET, PATCH }'));

    expect(getSource).not.toContain(".update({");
    expect(patchSource).toContain('updatePayload.token_activated_at = activityTimestamp');
  });

  it('enforces required uploaded documents before canonical submission', () => {
    expect(handlers).toContain('getRequiredOnboardingDocuments(expectedAccountType)');
    expect(handlers).toContain("code: 'required_onboarding_documents_missing'");
    expect(handlers).toContain("from(documentTable)");
  });

  it('enforces minimum owner-driver identity and vehicle fields', () => {
    for (const key of [
      "'full_name'",
      "'dob'",
      "'address'",
      "'phone'",
      "'email'",
      "'right_to_work_status'",
      "'registration'",
      "'make'",
      "'model'",
    ]) {
      expect(schemas).toContain(key);
    }
    expect(schemas).toContain('Select the applicant right-to-work status explicitly.');
  });

  it('exposes broker company verification and required document upload', () => {
    expect(broker).toContain("fetch('/api/onboarding/company-registration'");
    expect(broker).toContain("fetch('/api/onboarding/documents'");
    expect(broker).toContain('Company Documents');
    expect(broker).toContain('requiredDocumentTypes.some');
  });

  it('does not invent a right-to-work value in generic onboarding', () => {
    expect(generic).not.toContain("right_to_work_status: formData.right_to_work_status ?? 'other'");
    expect(generic).not.toContain("right_to_work_status: source.right_to_work_status ?? 'other'");
  });

  it('persists uploaded document markers into onboarding progress', () => {
    expect(generic).toContain('const nextFormData = { ...formData, [markerKey]: data.path ??');
    expect(generic).toContain("currentStep: 'document_upload'");
    expect(generic).toContain('calculateOnboardingProgress');
  });

  it('attaches the middleware nonce to structured-data scripts', () => {
    expect(rootLayout).toContain("import { headers } from 'next/headers'");
    expect(rootLayout).toContain("const nonce = (await headers()).get('x-nonce') ?? undefined");
    expect(rootLayout).toContain('nonce={nonce}');
  });

  it('renders public and account-entry routes at request time for nonce-based CSP', () => {
    for (const source of [homepage, loginLayout, registerLayout, onboardingLayout]) {
      expect(source).toContain("export const dynamic = 'force-dynamic'");
    }
  });

  it('serves metadata in the initial head for every user agent', () => {
    expect(nextConfig).toContain('htmlLimitedBots: /.*/');
  });

  it('uses local marketing imagery and provides a mobile navigation', () => {
    expect(marketing).toContain('src="/uk-satellite-map.png"');
    expect(marketing).toContain('fetchPriority="high"');
    expect(marketing).not.toContain('upload.wikimedia.org');
    expect(marketing).toContain('<details className="relative lg:hidden">');
    expect(marketing).toContain('Sign In');
  });

  it('restores legacy uploaded documents and exposes canonical recovery requirements', () => {
    expect(onboardingSession).toContain(".from('driver_identity_documents')");
    expect(onboardingSession).toContain(".from('company_documents')");
    expect(onboardingSession).toContain('assessOnboardingRecovery(accountType, payload, { companyId: app.company_id })');
    expect(generic).toContain('Complete your XDrive onboarding');
    expect(generic).toContain('recoveryAssessment.missingFields.length > 0');
  });

  it('calculates progress from actual required fields and documents', () => {
    expect(calculateOnboardingProgress('customer_shipper', {})).toBe(5);
    expect(calculateOnboardingProgress('customer_shipper', {
      full_name: 'Alex Driver',
      contact_email: 'alex@example.test',
    })).toBe(95);

    const brokerProgress = calculateOnboardingProgress('broker_shipper', {
      company_name: 'Broker Ltd',
      trading_name: 'Broker',
      company_number: '12345678',
      billing_address: '1 Test Street',
      trading_address: '1 Test Street',
      contact_person: 'Alex',
      finance_contact: 'Sam',
      contact_email: 'alex@example.test',
      contact_phone: '01234567890',
      doc_company_registration: 'uploaded',
      doc_public_liability: 'uploaded',
    });
    expect(brokerProgress).toBe(95);

    const ownerRecovery = assessOnboardingRecovery('owner_driver', {
      full_name: 'Paul Driver',
      dob: '1980-06-26',
      address: '1 Test Street',
      phone: '07000000000',
      email: 'paul@example.test',
      right_to_work_status: 'british_citizen',
      doc_proof_of_address: 'stored/path.jpg',
    });
    expect(ownerRecovery.complete).toBe(false);
    expect(ownerRecovery.missingFields.map((item) => item.key)).toEqual(['registration', 'make', 'model']);
    expect(ownerRecovery.missingDocuments.map((item) => item.type)).toEqual(['driving_licence', 'right_to_work']);
    expect(ownerRecovery.blockingReasons).toHaveLength(2);

    const fleetRecovery = assessOnboardingRecovery('fleet_courier', {
      legal_company_name: 'HNR Express Solutions Ltd',
      trading_name: 'HNR Express Solutions',
      company_number: '12345678',
      registered_address: '1 Test Street',
      trading_address: '1 Test Street',
      contact_person: 'Sean Kisby',
      compliance_contact: 'Sean Kisby',
      transport_contact: 'Sean Kisby',
      doc_company_registration: 'stored/company.pdf',
      doc_public_liability: 'stored/public-liability.pdf',
      doc_goods_in_transit: 'stored/git.pdf',
      doc_vehicle_insurance: 'stored/motor.pdf',
    }, { companyId: null });
    expect(fleetRecovery.complete).toBe(false);
    expect(fleetRecovery.blockingReasons).toContain('Companies House verification is required before onboarding can be submitted.');
  });
});
