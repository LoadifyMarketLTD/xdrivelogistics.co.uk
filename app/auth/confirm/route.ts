import { NextRequest, NextResponse } from 'next/server';
import { AUTH_CALLBACK_PATH, RESET_PASSWORD_PATH } from '../../../lib/authFlow';

export async function GET(request: NextRequest) {
  const sourceUrl = new URL(request.url);
  const type = sourceUrl.searchParams.get('type');
  const flow = sourceUrl.searchParams.get('flow');
  const nextPath = sourceUrl.searchParams.get('next');
  const isRecoveryFlow =
    type === 'recovery' ||
    flow === 'recovery' ||
    nextPath === RESET_PASSWORD_PATH ||
    nextPath?.startsWith(`${RESET_PASSWORD_PATH}?`) ||
    false;

  const destination = new URL(isRecoveryFlow ? RESET_PASSWORD_PATH : AUTH_CALLBACK_PATH, request.url);
  destination.search = sourceUrl.search;
  return NextResponse.redirect(destination);
}
