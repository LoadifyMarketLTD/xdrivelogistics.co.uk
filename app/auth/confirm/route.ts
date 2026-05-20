import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const sourceUrl = new URL(request.url);
  const callbackUrl = new URL('/auth/callback', request.url);

  callbackUrl.search = sourceUrl.search;
  return NextResponse.redirect(callbackUrl);
}
