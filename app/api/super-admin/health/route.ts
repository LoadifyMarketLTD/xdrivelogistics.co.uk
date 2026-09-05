import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

type ServiceCheck = {
  service: string;
  status: 'healthy' | 'degraded' | 'error';
  latencyMs: number;
  detail: string;
};

const timed = async (service: string, fn: () => Promise<string>): Promise<ServiceCheck> => {
  const started = Date.now();
  try {
    const detail = await fn();
    return { service, status: 'healthy', latencyMs: Date.now() - started, detail };
  } catch (error) {
    return {
      service,
      status: 'error',
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : 'Health check failed.',
    };
  }
};

const configured = (...names: string[]) => names.every((name) => Boolean(process.env[name]?.trim()));

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const checks = await Promise.all([
    timed('Supabase Database', async () => {
      const { count, error } = await supabaseAdmin!.from('companies').select('id', { count: 'exact', head: true });
      if (error) throw new Error(error.message);
      if (typeof count !== 'number') throw new Error('Database exact-count health probe returned an incomplete snapshot.');
      return `Database query completed successfully (${count.toLocaleString()} companies visible to the service role).`;
    }),
    timed('Supabase Storage', async () => {
      const { data, error } = await supabaseAdmin!.storage.listBuckets();
      if (error) throw new Error(error.message);
      if (!Array.isArray(data)) throw new Error('Storage health probe returned an invalid bucket list.');
      return `${data.length} storage bucket${data.length === 1 ? '' : 's'} accessible.`;
    }),
    timed('Notification Store', async () => {
      const { count, error } = await supabaseAdmin!.from('notification_events').select('id', { count: 'exact', head: true });
      if (error) throw new Error(error.message);
      if (typeof count !== 'number') throw new Error('Notification store exact-count health probe returned an incomplete snapshot.');
      return `Notification event store is reachable (${count.toLocaleString()} events).`;
    }),
  ]);

  const integrations = [
    {
      service: 'Email / Resend',
      configured: configured('RESEND_API_KEY', 'EMAIL_FROM'),
      detail: configured('RESEND_API_KEY', 'EMAIL_FROM') ? 'Delivery credentials are configured.' : 'RESEND_API_KEY or EMAIL_FROM is missing.',
    },
    {
      service: 'Companies House',
      configured: configured('COMPANIES_HOUSE_API_KEY'),
      detail: configured('COMPANIES_HOUSE_API_KEY') ? 'API credential is configured.' : 'COMPANIES_HOUSE_API_KEY is missing.',
    },
    {
      service: 'Google Maps',
      configured: configured('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'),
      detail: configured('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY') ? 'Browser API credential is configured.' : 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing.',
    },
    {
      service: 'Stripe',
      configured: configured('STRIPE_SECRET_KEY'),
      detail: configured('STRIPE_SECRET_KEY') ? 'Server API credential is configured.' : 'STRIPE_SECRET_KEY is missing.',
    },
    {
      service: 'Upstash Redis',
      configured: configured('UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'),
      detail: configured('UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN') ? 'REST endpoint and token are configured.' : 'Redis REST URL or token is missing.',
    },
  ];

  return respond(200, { checkedAt: new Date().toISOString(), checks, integrations });
}
