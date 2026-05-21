import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const sourceUrl = new URL(request.url);
  const type = sourceUrl.searchParams.get('type');
  const flow = sourceUrl.searchParams.get('flow');
  const nextPath = sourceUrl.searchParams.get('next');
  const isRecoveryFlow =
    type === 'recovery' ||
    flow === 'recovery' ||
    nextPath === '/reset-password' ||
    nextPath?.startsWith('/reset-password?') ||
    false;
  const callbackUrl = new URL(isRecoveryFlow ? '/reset-password' : '/auth/callback', request.url);

  if (isRecoveryFlow && !sourceUrl.searchParams.has('flow')) {
    sourceUrl.searchParams.set('flow', 'recovery');
  }

  callbackUrl.search = sourceUrl.search;
  return NextResponse.redirect(callbackUrl);
}
