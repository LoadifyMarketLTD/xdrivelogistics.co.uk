'use client';

import { useMemo, useState } from 'react';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

type FraudAction = 'investigate' | 'clear' | 'confirm' | 'dismiss';

type Row = {
  id: string;
  subject_user_id: string | null;
  subject_company_id: string | null;
  onboarding_application_id: string | null;
  matched_user_id: string | null;
  matched_company_id: string | null;
  case_type: string;
  severity: 'medium' | 'high' | 'critical';
  status: string;
  automatic_hold: boolean;
  evidence: Record<string, unknown>;
  decision_reason: string | null;
  created_at: string;
  updated_at: string;
  applicant_email: string;
  account_type: string;
  application_risk_status: string;
  application_risk_reason: string | null;
  subject_company_name: string | null;
  matched_company_name: string | null;
};

const severityColor: Record<Row['severity'], string> = {
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

const summarizeEvidence = (evidence: Record<string, unknown>) => {
  const entries = Object.entries(evidence).slice(0, 4);
  if (entries.length === 0) return 'No evidence metadata recorded.';
  return entries
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value ?? '—')}`)
    .join(' · ');
};

export default function Page() {
  const [reloadToken, setReloadToken] = useState(() => Date.now());
  const [busyCaseId, setBusyCaseId] = useState<string | null>(null);

  const reviewCase = async (row: Row, action: FraudAction) => {
    if (action === 'confirm') {
      const confirmed = window.confirm(
        'Confirming fraud will reject the onboarding application and block the user profile. Continue?',
      );
      if (!confirmed) return;
    }

    const reason = window.prompt(
      action === 'confirm'
        ? 'Record the evidence and reason for confirming fraud:'
        : action === 'clear'
          ? 'Record why this identity conflict is cleared:'
          : action === 'dismiss'
            ? 'Record why this alert is dismissed:'
            : 'Record the investigation note:',
      row.decision_reason ?? '',
    );

    if (!reason?.trim()) return;

    setBusyCaseId(row.id);
    try {
      const auth = await getAuthHeader();
      if (!auth) return;

      const response = await fetch('/api/super-admin/compliance/fraud-cases', {
        method: 'PATCH',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          caseId: row.id,
          action,
          reason: reason.trim(),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        window.alert(payload.error ?? `Review failed (${response.status}).`);
        return;
      }

      setReloadToken(Date.now());
    } finally {
      setBusyCaseId(null);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'identity',
        label: 'Applicant',
        render: (row: Row) => (
          <div style={{ minWidth: '180px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>{row.applicant_email || 'Unknown applicant'}</div>
            <div style={{ fontSize: '0.66rem', color: '#94a3b8', marginTop: '0.15rem', textTransform: 'capitalize' }}>
              {row.account_type.replace(/_/g, ' ') || 'Unknown account type'}
            </div>
            <div style={{ fontSize: '0.64rem', color: '#94a3b8', marginTop: '0.15rem' }}>
              User: {row.subject_user_id ?? '—'}
            </div>
          </div>
        ),
      },
      {
        key: 'companies',
        label: 'Companies',
        render: (row: Row) => (
          <div style={{ minWidth: '160px', fontSize: '0.72rem' }}>
            <div>Subject: {row.subject_company_name ?? 'Independent / not linked'}</div>
            <div style={{ color: '#94a3b8', marginTop: '0.2rem' }}>
              Match: {row.matched_company_name ?? 'Unknown / independent'}
            </div>
          </div>
        ),
      },
      {
        key: 'case',
        label: 'Conflict',
        render: (row: Row) => (
          <div style={{ minWidth: '150px' }}>
            <div style={{ textTransform: 'capitalize', fontSize: '0.75rem', fontWeight: 700 }}>
              {row.case_type.replace(/_/g, ' ')}
            </div>
            <span
              style={{
                display: 'inline-flex',
                marginTop: '0.28rem',
                padding: '0.12rem 0.36rem',
                borderRadius: '999px',
                border: `1px solid ${severityColor[row.severity]}`,
                color: severityColor[row.severity],
                fontSize: '0.62rem',
                fontWeight: 800,
                textTransform: 'uppercase',
              }}
            >
              {row.severity}
            </span>
          </div>
        ),
      },
      {
        key: 'evidence',
        label: 'Evidence',
        render: (row: Row) => (
          <div style={{ maxWidth: '360px', fontSize: '0.68rem', lineHeight: 1.45, color: '#cbd5e1', wordBreak: 'break-word' }}>
            {summarizeEvidence(row.evidence ?? {})}
          </div>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        render: (row: Row) => (
          <div>
            <StatusChip value={row.status} />
            <div style={{ marginTop: '0.3rem' }}>
              <StatusChip value={row.application_risk_status || 'clear'} />
            </div>
            {row.automatic_hold && (
              <div style={{ marginTop: '0.3rem', color: '#f59e0b', fontSize: '0.64rem', fontWeight: 700 }}>
                Automatic hold
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'created',
        label: 'Detected',
        render: (row: Row) => (
          <span style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>{formatDateTime(row.created_at)}</span>
        ),
      },
      {
        key: 'actions',
        label: 'Decision',
        render: (row: Row) => {
          const busy = busyCaseId === row.id;
          return (
            <div style={{ display: 'grid', gap: '0.28rem', minWidth: '118px' }}>
              <button type="button" disabled={busy} onClick={() => void reviewCase(row, 'investigate')} style={{ fontSize: '0.66rem' }}>
                Investigate
              </button>
              <button type="button" disabled={busy} onClick={() => void reviewCase(row, 'clear')} style={{ fontSize: '0.66rem' }}>
                Clear conflict
              </button>
              <button type="button" disabled={busy} onClick={() => void reviewCase(row, 'dismiss')} style={{ fontSize: '0.66rem' }}>
                Dismiss alert
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void reviewCase(row, 'confirm')}
                style={{ fontSize: '0.66rem', color: '#ef4444', fontWeight: 800 }}
              >
                Confirm fraud & block
              </button>
            </div>
          );
        },
      },
    ],
    [busyCaseId],
  );

  return (
    <SuperAdminLiveTablePage<Row>
      icon="🛡️"
      title="Identity & Fraud Review"
      sectionLabel="Compliance"
      description="Duplicate documents and identity conflicts are held automatically. A permanent block requires a recorded Platform Owner decision."
      endpoint={`/api/super-admin/compliance/fraud-cases?status=all&limit=250&reload=${reloadToken}`}
      summaryField="summary"
      emptyMessage="No identity conflicts or fraud-review cases found."
      columns={columns}
    />
  );
}
