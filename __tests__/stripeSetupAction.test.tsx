import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { startStripeCompanyOnboarding } from '../lib/startStripeCompanyOnboarding';
import StripeSetupAction from '../app/components/workspace/StripeSetupAction';

const companyId = '11111111-1111-4111-8111-111111111111';
const onboardingUrl = 'https://connect.stripe.com/setup/c/acct_example/test-link';
const tab = { closed: false, opener: {} as object | null, close: vi.fn(), location: { replace: vi.fn() } };
const open = vi.fn();
const request = vi.fn();
const getAccessToken = vi.fn();
const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

beforeEach(() => {
  vi.resetAllMocks();
  tab.closed = false;
  tab.opener = {};
  open.mockReturnValue(tab);
  getAccessToken.mockResolvedValue('test-access-token');
  request.mockImplementation(async () => Response.json({ onboardingUrl }));
  vi.stubGlobal('window', { open });
  vi.stubGlobal('fetch', request);
});

afterEach(() => vi.unstubAllGlobals());

describe('direct company Stripe setup action', () => {
  it('uses the authenticated existing onboarding endpoint for the posting company, not a generic signup link', async () => {
    await startStripeCompanyOnboarding(companyId, getAccessToken);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('/api/payments/connect/onboarding', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ companyId }),
      headers: { Authorization: 'Bearer test-access-token', 'Content-Type': 'application/json' },
    }));
    expect(tab.location.replace).toHaveBeenCalledWith(onboardingUrl);
    expect(tab.close).not.toHaveBeenCalled();
  });
  it('opens synchronously and removes opener access before fetching the session', async () => {
    getAccessToken.mockImplementation(async () => {
      expect(open).toHaveBeenCalledWith('about:blank', '_blank');
      expect(tab.opener).toBeNull();
      return 'test-access-token';
    });
    await startStripeCompanyOnboarding(companyId, getAccessToken);
  });
  it('does not start onboarding when pop-ups are blocked', async () => {
    open.mockReturnValue(null);
    await expect(startStripeCompanyOnboarding(companyId, getAccessToken)).rejects.toThrow('Allow pop-ups');
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
  it('does not open a tab without a verified posting company', async () => {
    await expect(startStripeCompanyOnboarding('', getAccessToken)).rejects.toThrow('posting company');
    expect(open).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
  it('closes the unused tab if the session expired', async () => {
    getAccessToken.mockResolvedValue(null);
    await expect(startStripeCompanyOnboarding(companyId, getAccessToken)).rejects.toThrow('session has expired');
    expect(request).not.toHaveBeenCalled();
    expect(tab.close).toHaveBeenCalledTimes(1);
  });
  it('preserves server owner/admin authorization errors instead of bypassing them', async () => {
    request.mockResolvedValue(Response.json({ error: 'Only a company owner or admin can configure Stripe payouts.' }, { status: 403 }));
    await expect(startStripeCompanyOnboarding(companyId, getAccessToken)).rejects.toThrow('Only a company owner or admin');
    expect(tab.location.replace).not.toHaveBeenCalled();
    expect(tab.close).toHaveBeenCalledTimes(1);
  });
  it('closes the unused tab on a failed network request', async () => {
    request.mockRejectedValue(new Error('Network unavailable'));
    await expect(startStripeCompanyOnboarding(companyId, getAccessToken)).rejects.toThrow('Network unavailable');
    expect(tab.close).toHaveBeenCalledTimes(1);
  });
  it('handles a non-JSON server response without navigation', async () => {
    request.mockResolvedValue(new Response('Unavailable', { status: 503 }));
    await expect(startStripeCompanyOnboarding(companyId, getAccessToken)).rejects.toThrow('could not be started');
    expect(tab.location.replace).not.toHaveBeenCalled();
  });
  it('provides a retryable timeout without changing the load form', async () => {
    request.mockRejectedValue(new DOMException('Timed out', 'TimeoutError'));
    await expect(startStripeCompanyOnboarding(companyId, getAccessToken)).rejects.toThrow('load details have not changed');
    expect(tab.close).toHaveBeenCalledTimes(1);
  });
  it.each([
    'http://connect.stripe.com/setup/test', 'https://connect.stripe.com.evil.example/setup',
    'https://evil.example/setup', 'javascript:alert(1)', 'https://connect.stripe.com:444/setup',
    'https://user:pass@connect.stripe.com/setup', '/settings/payments',
  ])('rejects an unsafe onboarding destination: %s', async (url) => {
    request.mockResolvedValue(Response.json({ onboardingUrl: url }));
    await expect(startStripeCompanyOnboarding(companyId, getAccessToken)).rejects.toThrow();
    expect(tab.location.replace).not.toHaveBeenCalled();
    expect(tab.close).toHaveBeenCalledTimes(1);
  });
  it.each([null, {}, { onboardingUrl: 1 }, { onboardingUrl: null }])('rejects a missing setup link: %j', async (payload) => {
    request.mockResolvedValue(Response.json(payload));
    await expect(startStripeCompanyOnboarding(companyId, getAccessToken)).rejects.toThrow('could not be started');
    expect(tab.location.replace).not.toHaveBeenCalled();
  });
  it('handles the user closing the new tab while onboarding is being prepared', async () => {
    request.mockImplementation(async () => { tab.closed = true; return Response.json({ onboardingUrl }); });
    await expect(startStripeCompanyOnboarding(companyId, getAccessToken)).rejects.toThrow('tab was closed');
    expect(tab.location.replace).not.toHaveBeenCalled();
  });
  it('renders an explicit Stripe button without starting onboarding during render', () => {
    const html = renderToStaticMarkup(createElement(StripeSetupAction, { companyId, getAccessToken }));
    expect(html).toContain('Set up / activate Stripe');
    expect(html).toContain('type="button"');
    expect(html).toContain('new tab');
    expect(html).toContain('publish the load again');
    expect(open).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
});

describe('Post Load direct-party payment boundary', () => {
  const form = read('app/components/workspace/LoadPostingForm.tsx');
  const createJob = read('app/api/jobs/create/route.ts');
  it('does not expose Stripe setup as a prerequisite for posting transport work', () => {
    expect(form).not.toContain('StripeSetupAction');
    expect(form).not.toContain('stripeSetupCompanyId');
    expect(createJob).not.toContain('getStripeCommercialReadiness');
    expect(createJob).not.toContain('setupCompanyId: input.companyId');
  });
  it('keeps owner/admin Stripe onboarding separate from Post Load and avoids automatic publication or form navigation', () => {
    const onboarding = read('app/api/payments/connect/onboarding/route.ts');
    expect(onboarding).toContain("new Set(['owner', 'admin'])");
    const action = read('lib/startStripeCompanyOnboarding.ts');
    expect(action).not.toContain('/api/jobs/create');
    expect(action).not.toContain('window.location');
    expect(action).not.toContain('localStorage');
  });
});
