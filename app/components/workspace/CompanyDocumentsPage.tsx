'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../AuthContext';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  KpiCard,
  KpiGrid,
  OperationalTable,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from './WorkspaceUI';

type CompanyDocumentRow = {
  id: string;
  company_id: string;
  doc_type: string;
  file_path: string | null;
  status: string;
  expiry_date: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
};

const DOCUMENT_LABELS: Record<string, string> = {
  operator_licence: 'Operator Licence',
  public_liability: 'Public Liability',
  goods_in_transit: 'Goods in Transit',
  vehicle_insurance: 'Vehicle Insurance',
  motor_fleet_insurance: 'Motor Fleet Insurance',
  vat_registration: 'VAT Registration',
  company_registration: 'Company Registration',
};

const documentLabel = (value: string) =>
  DOCUMENT_LABELS[value] ?? value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

const dateOnly = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Not set';

const isExpired = (value: string | null | undefined) => {
  if (!value) return false;
  const timestamp = new Date(`${value}T23:59:59`).getTime();
  return Number.isFinite(timestamp) && timestamp < Date.now();
};

export default function CompanyDocumentsPage() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(user?.companyId ?? null);
  const [documents, setDocuments] = useState<CompanyDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      if (!user?.id) {
        if (!cancelled) setCompanyId(null);
        return;
      }
      const resolved = await resolveActiveCompanyId({
        userId: user.id,
        fallbackCompanyId: user.companyId ?? null,
      });
      if (!cancelled) setCompanyId(resolved ?? null);
    };
    void resolve();
    return () => { cancelled = true; };
  }, [user?.id, user?.companyId]);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError('');

    if (!isSupabaseConfigured) {
      setDocuments([]);
      setError('Supabase is not configured for this workspace.');
      setLoading(false);
      return;
    }
    if (!companyId) {
      setDocuments([]);
      setError('Company context is unavailable, so company documents cannot be shown safely.');
      setLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase
      .from('company_documents')
      .select('id, company_id, doc_type, file_path, status, expiry_date, review_notes, created_at, updated_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (queryError) {
      setDocuments([]);
      setError(`Failed to load company documents: ${queryError.message}`);
    } else {
      setDocuments((data ?? []) as CompanyDocumentRow[]);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const pendingCount = useMemo(
    () => documents.filter((document) => ['pending', 'under_review'].includes(document.status)).length,
    [documents]
  );
  const approvedCount = useMemo(
    () => documents.filter((document) => document.status === 'approved').length,
    [documents]
  );
  const expiredCount = useMemo(
    () => documents.filter((document) => document.status === 'expired' || isExpired(document.expiry_date)).length,
    [documents]
  );

  const openDocument = async (documentId: string) => {
    setOpeningId(documentId);
    setError('');

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setOpeningId(null);
      return;
    }

    const response = await fetch(`/api/company/documents/signed-url?id=${encodeURIComponent(documentId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = (await response.json().catch(() => ({}))) as {
      signedUrl?: string;
      error?: string;
    };

    if (!response.ok || !payload.signedUrl) {
      setError(payload.error ?? 'Unable to open the company document.');
      setOpeningId(null);
      return;
    }

    window.open(payload.signedUrl, '_blank', 'noopener,noreferrer');
    setOpeningId(null);
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Compliance"
        title="Company Documents"
        description="Company-level compliance records and their recorded review state. This workspace does not self-approve company compliance evidence."
      />

      {error && <AlertBanner tone="danger">{error}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Company documents" value={documents.length} tone="navy" />
        <KpiCard label="Pending / under review" value={pendingCount} tone={pendingCount > 0 ? 'orange' : 'green'} />
        <KpiCard label="Approved" value={approvedCount} tone="green" />
        <KpiCard label="Expired" value={expiredCount} tone={expiredCount > 0 ? 'red' : 'green'} />
      </KpiGrid>

      <Panel
        title="Company compliance register"
        description="Statuses and review notes are read from the existing company_documents compliance record. File access uses a short-lived company-scoped link."
      >
        <OperationalTable<CompanyDocumentRow>
          columns={[
            {
              id: 'document',
              header: 'Document',
              cell: (document) => <strong>{documentLabel(document.doc_type)}</strong>,
            },
            {
              id: 'status',
              header: 'Status',
              cell: (document) => (
                <StatusBadge
                  value={isExpired(document.expiry_date) && document.status === 'approved' ? 'expired by date' : document.status}
                  tone={
                    document.status === 'approved' && !isExpired(document.expiry_date)
                      ? 'green'
                      : document.status === 'rejected' || document.status === 'expired' || isExpired(document.expiry_date)
                        ? 'red'
                        : 'orange'
                  }
                />
              ),
            },
            {
              id: 'expiry',
              header: 'Expiry',
              cell: (document) => dateOnly(document.expiry_date),
            },
            {
              id: 'review-note',
              header: 'Review note',
              cell: (document) => document.review_notes?.trim() || '—',
            },
            {
              id: 'added',
              header: 'Added',
              cell: (document) => dateOnly(document.created_at),
            },
            {
              id: 'file',
              header: 'File',
              isAction: true,
              cell: (document) => document.file_path ? (
                <ActionButton
                  tone="secondary"
                  disabled={openingId === document.id}
                  onClick={() => void openDocument(document.id)}
                >
                  {openingId === document.id ? 'Opening…' : 'Open'}
                </ActionButton>
              ) : (
                'No file recorded'
              ),
            },
          ]}
          rows={documents}
          getRowKey={(document) => document.id}
          empty={
            <EmptyState
              title={loading ? 'Loading company documents…' : 'No company documents recorded'}
              description={loading ? undefined : 'Company-level evidence will appear here when a company document record exists.'}
            />
          }
        />
      </Panel>
    </PageFrame>
  );
}
