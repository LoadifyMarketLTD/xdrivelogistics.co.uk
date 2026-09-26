type GetAccessToken = () => Promise<string | null>;

/** Open from a user click, keeping the unsaved transport form in its original tab. */
export async function startStripeCompanyOnboarding(companyId: string, getAccessToken: GetAccessToken): Promise<void> {
  if (!companyId) throw new Error('The posting company could not be verified. Please try publishing again.');
  const stripeTab = window.open('about:blank', '_blank');
  if (!stripeTab) throw new Error('Allow pop-ups for XDrive, then select Set up / activate Stripe again. Your load details have not changed.');
  try {
    // Remove opener access before navigating the new tab to Stripe.
    stripeTab.opener = null;
    const token = await getAccessToken();
    if (!token) throw new Error('Your session has expired. Please sign in again before starting Stripe setup.');
    const response = await fetch('/api/payments/connect/onboarding', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId }),
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await response.json().catch(() => null) as { onboardingUrl?: unknown; error?: unknown } | null;
    if (!response.ok || typeof payload?.onboardingUrl !== 'string') {
      throw new Error(typeof payload?.error === 'string' ? payload.error : 'Stripe setup could not be started. Please try again.');
    }
    const url = new URL(payload.onboardingUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'connect.stripe.com' || url.port || url.username || url.password) {
      throw new Error('Stripe returned an invalid setup link. Please try again.');
    }
    if (stripeTab.closed) throw new Error('The Stripe tab was closed. Select Set up / activate Stripe again to continue.');
    stripeTab.location.replace(url.href);
  } catch (reason) {
    stripeTab.close();
    if (reason instanceof DOMException && (reason.name === 'TimeoutError' || reason.name === 'AbortError')) {
      throw new Error('Stripe setup timed out. Please try again. Your load details have not changed.');
    }
    throw reason;
  }
}
