export function stripeOnboardingFailure(reason: unknown) {
  const message = reason instanceof Error ? reason.message : '';
  if (/complete your platform profile/i.test(message)) {
    return { status: 503, code: 'STRIPE_PLATFORM_SETUP_REQUIRED',
      error: 'XDrive must complete its Stripe Connect platform profile before company accounts can connect. This is a platform setup issue, not missing details in your company account. Contact XDrive support; your form has been kept.' };
  }
  if (reason instanceof DOMException && ['TimeoutError', 'AbortError'].includes(reason.name)) {
    return { status: 504, code: 'STRIPE_ONBOARDING_TIMEOUT',
      error: 'Stripe did not respond in time. Your form has been kept. Please retry.' };
  }
  return { status: 502, code: 'STRIPE_ONBOARDING_UNAVAILABLE',
    error: 'Stripe setup could not be started. Your form has been kept. Please retry or contact XDrive support.' };
}
