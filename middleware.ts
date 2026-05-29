import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const createNonce = () => {
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (const byte of nonceBytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const buildCspHeader = (nonce: string) =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://images.unsplash.com https://*.supabase.co",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-src 'self' https://app.netlify.com",
    "form-action 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
  ].join('; ');

const withSecurityHeaders = (response: NextResponse, nonce: string, cspHeader: string) => {
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('x-nonce', nonce);
  return response;
};

export async function middleware(request: NextRequest) {
  const nonce = createNonce();
  const cspHeader = buildCspHeader(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  return withSecurityHeaders(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
    nonce,
    cspHeader
  );
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|webmanifest)$).*)',
  ],
};
