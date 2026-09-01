'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, FileUp } from 'lucide-react';

import { supabase } from '../../../lib/supabaseClient';

type ChecklistDocument = {
  family: string;
  docType: string;
  status: 'missing' | 'uploaded' | 'approved' | 'expiring_soon' | 'expired' | 'rejected';
  reviewStatus: 'not_uploaded' | 'pending_review' | 'approved' | 'rejected';
  expiryDate?: string | null;
  daysUntilExpiry?: number | null;
  satisfiedBy?: string | null;
};

type ChecklistPayload = {
  application?: { status?: string; completionPercentage?: number } | null;
  missingDocuments?: string[];
  missingCount?: number;
  complete?: boolean;
  documents?: ChecklistDocument[];
  documentDetailsAvailable?: boolean;
  documentDetailsNote?: string | null;
};

const pretty = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const STATUS_LABELS: Record<ChecklistDocument['status'], string> = {
  missing: 'Missing',
  uploaded: 'Uploaded',
  approved: 'Approved',
  expiring_soon: 'Expiring soon',
  expired: 'Expired',
  rejected: 'Rejected',
};
const statusLabel = (document: ChecklistDocument) => {
  if (document.status === 'uploaded' && document.reviewStatus === 'pending_review') return 'Uploaded · pending review';
  if (document.status === 'expiring_soon') return document.daysUntilExpiry === null || document.daysUntilExpiry === undefined
    ? STATUS_LABELS.expiring_soon
    : `Expiring in ${document.daysUntilExpiry} day${document.daysUntilExpiry === 1 ? '' : 's'}`;
  return STATUS_LABELS[document.status];
};

export default function OnboardingDocumentChecklist() {
  const [payload, setPayload] = useState<ChecklistPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const response = await fetch('/api/onboarding/missing-documents', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const body = await response.json().catch(() => null) as ChecklistPayload | null;
      if (!cancelled && body) setPayload(body);
    };
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, []);

  const documents = useMemo(() => payload?.documents ?? [], [payload?.documents]);

  if (!payload?.application) return null;

  const missing = payload.missingDocuments ?? [];
  const expiringSoon = documents.filter((document) => document.status === 'expiring_soon').length;
  const hasOutstanding = missing.length > 0;
  const border = hasOutstanding || expiringSoon > 0 ? '#efc36f' : '#b7dec9';
  const background = hasOutstanding || expiringSoon > 0 ? '#fffaf0' : '#f4fbf7';
  const foreground = hasOutstanding || expiringSoon > 0 ? '#553b13' : '#12633f';

  return <aside role="status" aria-live="polite" style={{ margin: '12px auto 0', width: 'min(1120px, calc(100% - 24px))', border: `1px solid ${border}`, borderLeft: `5px solid ${hasOutstanding || expiringSoon > 0 ? '#f5a300' : '#38a169'}`, borderRadius: 12, background, padding: '13px 14px', color: foreground }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: hasOutstanding || expiringSoon > 0 ? '#fff0d5' : '#e8f7ee', color: hasOutstanding || expiringSoon > 0 ? '#b66b00' : '#168553', flex: '0 0 auto' }}>
        {hasOutstanding || expiringSoon > 0 ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <strong style={{ display: 'block', color: hasOutstanding || expiringSoon > 0 ? '#7a4d00' : '#12633f', fontSize: 13 }}>
          {hasOutstanding
            ? `Your onboarding still needs ${missing.length} document${missing.length === 1 ? '' : 's'}`
            : expiringSoon > 0
              ? `Required documents complete · ${expiringSoon} expiring soon`
              : 'Required document checklist complete.'}
        </strong>
        <p style={{ margin: '4px 0 9px', color: hasOutstanding || expiringSoon > 0 ? '#806b43' : '#4f7462', fontSize: 11.5, lineHeight: 1.45 }}>
          {hasOutstanding
            ? 'Upload or correct the items below. This reminder remains visible until the canonical requirements are complete.'
            : expiringSoon > 0
              ? 'Your required documents are currently approved, but one or more will expire soon.'
              : 'No canonical missing onboarding documents are currently outstanding.'}
        </p>

        {documents.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 7 }}>
          {documents.map((document) => {
            const warning = ['missing', 'expired', 'rejected', 'expiring_soon'].includes(document.status);
            const pending = document.status === 'uploaded';
            const Icon = document.status === 'approved' ? CheckCircle2 : pending ? Clock3 : warning ? AlertTriangle : FileUp;
            return <div key={`${document.family}:${document.docType}`} style={{ border: `1px solid ${warning ? '#efd9a9' : pending ? '#d7e0ea' : '#cce5d7'}`, borderRadius: 8, background: '#fff', padding: '8px 9px', display: 'flex', alignItems: 'flex-start', gap: 7 }}>
              <Icon size={14} style={{ marginTop: 1, flex: '0 0 auto' }} />
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: 10.5, color: '#263750' }}>{pretty(document.docType)}</strong>
                <span style={{ display: 'block', marginTop: 2, fontSize: 9.5, color: warning ? '#9a650a' : pending ? '#607089' : '#168553', fontWeight: 750 }}>{statusLabel(document)}</span>
                {document.satisfiedBy ? <span style={{ display: 'block', marginTop: 2, fontSize: 9, color: '#728198' }}>Satisfied by {pretty(document.satisfiedBy)}</span> : null}
              </div>
            </div>;
          })}
        </div> : missing.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{missing.map((document) => <span key={document} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid #efd9a9', borderRadius: 7, background: '#fff', padding: '5px 8px', color: '#6c501e', fontSize: 10.5, fontWeight: 750 }}><FileUp size={12} />{pretty(document)} · Missing</span>)}</div> : null}

        {payload.documentDetailsAvailable === false && payload.documentDetailsNote ? <p style={{ margin: '8px 0 0', color: '#806b43', fontSize: 9.5 }}>{payload.documentDetailsNote}</p> : null}
      </div>
    </div>
  </aside>;
}
