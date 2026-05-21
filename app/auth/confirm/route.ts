import { NextRequest, NextResponse } from 'next/server';
import { getAuthCallbackUrl, getResetPasswordUrl, isPasswordSetupFlowType } from '../../../lib/authFlow';

export async function GET(request: NextRequest) {
  const sourceUrl = new URL(request.url);
  const type = sourceUrl.searchParams.get('type');
  const flow = sourceUrl.searchParams.get('flow');
  const nextPath = sourceUrl.searchParams.get('next');
  const setupType =
    isPasswordSetupFlowType(type)
      ? type
      : isPasswordSetupFlowType(flow)
        ? flow
        : null;
  const isPasswordSetupFlow =
    setupType !== null ||
    nextPath === '/reset-password' ||
    nextPath?.startsWith('/reset-password?') ||
    false;
  const callbackUrl = new URL(
    isPasswordSetupFlow ? getResetPasswordUrl(setupType ?? 'recovery') : getAuthCallbackUrl(),
  );

  if (isPasswordSetupFlow) {
    sourceUrl.searchParams.set('type', setupType ?? 'recovery');
  }

  callbackUrl.search = sourceUrl.search;
  return NextResponse.redirect(callbackUrl);
}
