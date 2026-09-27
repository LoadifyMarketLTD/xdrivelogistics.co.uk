import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculateOnboardingProgress } from '../lib/onboardingProgress';

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

  it('serves metadata in the initial head for Lighthouse and HTML-limited bots', () => {
    expect(nextConfig).toContain('htmlLimitedBots:');
    expect(nextConfig).toContain('Chrome-Lighthouse');
    expect(nextConfig).toContain('Lighthouse');
  });

  it('uses local marketing imagery and provides a mobile navigation', () => {
    expect(marketing).toContain("url('/uk-satellite-map.png')");
    expect(marketing).not.toContain('upload.wikimedia.org');
    expect(marketing).toContain('<details className="relative lg:hidden">');
    expect(marketing).toContain('Sign In');
  });

  it('calculates progress from actual required fields and documents', () => {
    expect(calculateOnboardingProgress('customer_shipper', {})).toBe(25);
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
  });
});
