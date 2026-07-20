'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { supabase } from '@/lib/supabaseClient';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
  green: '#22c55e',
  red: '#ef4444',
};

type HealthStatus = 'ok' | 'degraded' | 'error' | 'checking';

type HealthCheck = {
  service: string;
  status: HealthStatus;
  latencyMs?: number;
  detail?: string;
};

type CheckOutcome = {
  status?: 'ok' | 'degraded';
  detail?: string;
};

type EmailReadinessPayload = {
  readinessStatus?: 'healthy' | 'degraded' | 'error';
  readinessMessage?: string;
  errors?: string[];
};

const statusColor = (status: HealthStatus): string => {
  if (status === 'ok') return THEME.green;
  if (status === 'degraded') return THEME.accent;
  if (status === 'error') return THEME.red;
  return THEME.muted;
};

const statusLabel = (status: HealthStatus): string => {
  if (status === 'ok') return '● HEALTHY';
  if (status === 'degraded') return '● DEGRADED';
  if (status === 'error') return '● ERROR';
  return '○ CHECKING…';
};

export default function Page() {
  const [checks, setChecks] = useState<HealthCheck[]>([
    { service: 'Supabase Database', status: 'checking' },
    { service: 'Auth Service', status: 'checking' },
    { service: 'Stats API', status: 'checking' },
    { service: 'Operations API', status: 'checking' },
    { service: 'Finance API', status: 'checking' },
    { service: 'Compliance API', status: 'checking' },
    { service: 'Email Readiness', status: 'checking' },
  ]);

  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const runChecks = useCallback(async () => {
    setCheckedAt(null);

    setChecks((previousChecks) =>
      previousChecks.map((check) => ({
        ...check,
        status: 'checking' as const,
        detail: undefined,
        latencyMs: undefined,
      })),
    );

    const auth = await getAuthHeader();

    const runCheck = async (
      service: string,
      checkFn: () => Promise<void | CheckOutcome>,
    ): Promise<HealthCheck> => {
      const start = Date.now();

      try {
        const outcome = await checkFn();

        return {
          service,
          status: outcome?.status ?? 'ok',
          latencyMs: Date.now() - start,
          detail: outcome?.detail,
        };
      } catch (error) {
        return {
          service,
          status: 'error',
          latencyMs: Date.now() - start,
          detail:
            error instanceof Error
              ? error.message
              : 'Unknown error',
        };
      }
    };

    const results = await Promise.allSettled([
      runCheck('Supabase Database', async () => {
        const { error } = await supabase
          .from('companies')
          .select('id', {
            count: 'exact',
            head: true,
          });

        if (error) {
          throw new Error(error.message);
        }
      }),

      runCheck('Auth Service', async () => {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw new Error(error.message);
        }

        if (!data.session) {
          throw new Error('No active session');
        }
      }),

      ...(auth
        ? [
            runCheck('Stats API', async () => {
              const response = await fetch(
                '/api/super-admin/stats',
                {
                  headers: {
                    Authorization: auth,
                  },
                },
              );

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }
            }),

            runCheck('Operations API', async () => {
              const response = await fetch(
                '/api/super-admin/operations?section=jobs&limit=1',
                {
                  headers: {
                    Authorization: auth,
                  },
                },
              );

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }
            }),

            runCheck('Finance API', async () => {
              const response = await fetch(
                '/api/super-admin/finance?section=invoices&limit=1',
                {
                  headers: {
                    Authorization: auth,
                  },
                },
              );

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }
            }),

            runCheck('Compliance API', async () => {
              const response = await fetch(
                '/api/super-admin/compliance?section=documents&limit=1',
                {
                  headers: {
                    Authorization: auth,
                  },
                },
              );

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }
            }),

            runCheck('Email Readiness', async () => {
              const response = await fetch(
                '/api/super-admin/email-readiness',
                {
                  headers: {
                    Authorization: auth,
                  },
                },
              );

              const payload = (await response
                .json()
                .catch(() => null)) as EmailReadinessPayload | null;

              if (!response.ok) {
                throw new Error(
                  payload?.errors?.[0] ??
                    payload?.readinessMessage ??
                    `HTTP ${response.status}`,
                );
              }

              if (payload?.readinessStatus === 'error') {
                throw new Error(
                  payload.readinessMessage ??
                    'Email delivery has an active failure.',
                );
              }

              if (payload?.readinessStatus === 'degraded') {
                return {
                  status: 'degraded' as const,
                  detail:
                    payload.readinessMessage ??
                    'Email delivery is operational with warnings.',
                };
              }

              return {
                status: 'ok' as const,
                detail:
                  payload?.readinessMessage ??
                  'Email delivery is operational.',
              };
            }),
          ]
        : [
            Promise.resolve({
              service: 'Stats API',
              status: 'error' as const,
              detail: 'No session',
            }),
            Promise.resolve({
              service: 'Operations API',
              status: 'error' as const,
              detail: 'No session',
            }),
            Promise.resolve({
              service: 'Finance API',
              status: 'error' as const,
              detail: 'No session',
            }),
            Promise.resolve({
              service: 'Compliance API',
              status: 'error' as const,
              detail: 'No session',
            }),
            Promise.resolve({
              service: 'Email Readiness',
              status: 'error' as const,
              detail: 'No session',
            }),
          ]),
    ]);

    const resolvedChecks: HealthCheck[] = results.map((result) =>
      result.status === 'fulfilled'
        ? result.value
        : {
            service: 'Unknown',
            status: 'error' as const,
            detail: 'Health check failed unexpectedly.',
          },
    );

    setChecks(resolvedChecks);
    setCheckedAt(new Date().toLocaleString('en-GB'));
  }, []);

  useEffect(() => {
    void runChecks();
  }, [runChecks]);

  const allHealthy = checks.every(
    (check) => check.status === 'ok',
  );

  const hasError = checks.some(
    (check) => check.status === 'error',
  );

  const hasDegraded = checks.some(
    (check) => check.status === 'degraded',
  );

  const overallStatus: HealthStatus = allHealthy
    ? 'ok'
    : hasError
      ? 'error'
      : hasDegraded
        ? 'degraded'
        : 'checking';

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: THEME.pageBg,
          padding: '1.5rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>🩺</span>

          <div style={{ flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flexWrap: 'wrap',
              }}
            >
              <h1
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  color: THEME.text,
                  margin: 0,
                }}
              >
                Platform Health
              </h1>

              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: THEME.accent,
                  backgroundColor: 'rgba(245,158,11,0.12)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                }}
              >
                Platform
              </span>

              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: statusColor(overallStatus),
                  marginLeft: '0.5rem',
                }}
              >
                {statusLabel(overallStatus)}
              </span>
            </div>

            <p
              style={{
                color: THEME.muted,
                margin: '0.25rem 0 0',
                fontSize: '0.85rem',
              }}
            >
              Real-time health status for all platform APIs and services.
            </p>
          </div>

          <button
            onClick={() => void runChecks()}
            style={{
              padding: '0.45rem 1rem',
              backgroundColor: THEME.accent,
              color: '#0f172a',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            🔄 Re-check
          </button>
        </div>

        {checkedAt && (
          <div
            style={{
              color: THEME.muted,
              fontSize: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            Last checked: {checkedAt}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {checks.map((check) => (
            <div
              key={check.service}
              style={{
                backgroundColor: THEME.cardBg,
                border: `1px solid ${
                  check.status === 'error'
                    ? THEME.red
                    : check.status === 'degraded'
                      ? THEME.accent
                      : check.status === 'ok'
                        ? 'rgba(34,197,94,0.3)'
                        : THEME.cardBorder
                }`,
                borderRadius: '10px',
                padding: '1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.4rem',
                }}
              >
                <span
                  style={{
                    color: THEME.text,
                    fontWeight: 700,
                    fontSize: '0.88rem',
                  }}
                >
                  {check.service}
                </span>

                <span
                  style={{
                    color: statusColor(check.status),
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  {statusLabel(check.status)}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                {check.latencyMs !== undefined && (
                  <span
                    style={{
                      color: THEME.muted,
                      fontSize: '0.72rem',
                    }}
                  >
                    Latency:{' '}
                    <span
                      style={{
                        color:
                          check.latencyMs < 500
                            ? THEME.green
                            : check.latencyMs < 2000
                              ? THEME.accent
                              : THEME.red,
                        fontWeight: 600,
                      }}
                    >
                      {check.latencyMs}ms
                    </span>
                  </span>
                )}

                {check.detail && (
                  <span
                    style={{
                      color:
                        check.status === 'error'
                          ? THEME.red
                          : check.status === 'degraded'
                            ? THEME.accent
                            : THEME.muted,
                      fontSize: '0.7rem',
                    }}
                  >
                    {check.detail}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
}
