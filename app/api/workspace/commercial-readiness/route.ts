import { NextRequest, NextResponse } from 'next/server';
import { GET as getReadiness } from '../readiness/route';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
/** Compatibility for an already-loaded older workspace. One authoritative evaluator. */
export async function GET(request: NextRequest) {
  const response = await getReadiness(request);
  const payload = await response.json();
  const action = request.nextUrl.searchParams.get('action') === 'quote' ? 'quote' : 'post_load';
  return NextResponse.json({ ...payload, action, blockers: Array.isArray(payload.blockers) ? payload.blockers.map((blocker: Record<string, unknown>) => ({
    ...blocker, actionKind: action,
    actionUrl: blocker.actionHref ?? (blocker.actionType === 'stripe_setup' ? '/settings/payments' : '/onboarding/resume'),
  })) : [] }, { status: response.status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
