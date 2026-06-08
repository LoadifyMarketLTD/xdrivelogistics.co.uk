import { NextResponse } from 'next/server';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function POST() {
  return json(410, { error: 'Use account-specific onboarding submit endpoints.' });
}
