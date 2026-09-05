import { supabaseAdmin } from '../../_lib/supabaseAdmin';

export type PlatformHealthStatus = 'healthy' | 'degraded' | 'error';

export type PlatformHealthCheck = {
  service: string;
  status: PlatformHealthStatus;
  latencyMs: number;
  detail: string;
};

export type PlatformHealthIntegration = {
  service: string;
  configured: boolean;
  detail: string;
};

export type PlatformHealthSummary = {
  determined: boolean;
  totalChecks: number;
  healthyCount: number;
  degradedCount: number;
  errorCount: number;
  unhealthyCount: number | null;
  overall: PlatformHealthStatus | 'unknown';
};

const timed = async (service: string, fn: () => Promise<string>): Promise<PlatformHealthCheck> => {
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

export const summarizePlatformHealth = (checks: PlatformHealthCheck[]): PlatformHealthSummary => {
  if (checks.length === 0) {
    return {
      determined: false,
      totalChecks: 0,
      healthyCount: 0,
      degradedCount: 0,
      errorCount: 0,
      unhealthyCount: null,
      overall: 'unknown',
    };
  }

  const healthyCount = checks.filter((check) => check.status === 'healthy').length;
  const degradedCount = checks.filter((check) => check.status === 'degraded').length;
  const errorCount = checks.filter((check) => check.status === 'error').length;
  const unhealthyCount = degradedCount + errorCount;

  return {
    determined: true,
    totalChecks: checks.length,
    healthyCount,
    degradedCount,
    errorCount,
    unhealthyCount,
    overall: errorCount > 0 ? 'error' : degradedCount > 0 ? 'degraded' : 'healthy',
  };
};

export const runPlatformHealthChecks = async () => {
  if (!supabaseAdmin) throw new Error('Platform health client is not configured.');
  const client = supabaseAdmin;

  const checks = await Promise.all([
    timed('Supabase Database', async () => {
      const { count, error } = await client.from('companies').select('id', { count: 'exact', head: true });
      if (error) throw new Error(error.message);
      if (typeof count !== 'number') throw new Error('Database exact-count health probe returned an incomplete snapshot.');
      return `Database query completed successfully (${count.toLocaleString()} companies visible to the service role).`;
    }),
    timed('Supabase Storage', async () => {
      const storageClient = client.storage;
      if (!storageClient || typeof storageClient.listBuckets !== 'function') {
        throw new Error('Storage health client is unavailable.');
      }
      const { data, error } = await storageClient.listBuckets();
      if (error) throw new Error(error.message);
      if (!Array.isArray(data)) throw new Error('Storage health probe returned an invalid bucket list.');
      return `${data.length} storage bucket${data.length === 1 ? '' : 's'} accessible.`;
    }),
    timed('Notification Store', async () => {
      const { count, error } = await client.from('notification_events').select('id', { count: 'exact', head: true });
      if (error) throw new Error(error.message);
      if (typeof count !== 'number') throw new Error('Notification store exact-count health probe returned an incomplete snapshot.');
      return `Notification event store is reachable (${count.toLocaleString()} events).`;
    }),
  ]);

  return { checks, summary: summarizePlatformHealth(checks) };
};

const configured = (...names: string[]) => names.every((name) => Boolean(process.env[name]?.trim()));

export const buildPlatformIntegrationReadiness = (): PlatformHealthIntegration[] => [
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
