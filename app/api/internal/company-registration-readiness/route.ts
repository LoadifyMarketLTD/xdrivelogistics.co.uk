import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ready: false, reason: 'missing_configuration' }, { status: 503 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const authorization = Buffer.from(`${apiKey}:`).toString('base64');
    const response = await fetch('https://api.company-information.service.gov.uk/company/13171804', {
      headers: {
        Authorization: `Basic ${authorization}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      return NextResponse.json({ ready: false, reason: 'provider_rejected', providerStatus: response.status }, { status: 503 });
    }

    const payload = (await response.json()) as { company_number?: unknown; company_status?: unknown };
    const ready = payload.company_number === '13171804' && payload.company_status === 'active';
    return NextResponse.json({ ready, providerStatus: response.status }, { status: ready ? 200 : 503 });
  } catch {
    return NextResponse.json({ ready: false, reason: 'provider_unavailable' }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
