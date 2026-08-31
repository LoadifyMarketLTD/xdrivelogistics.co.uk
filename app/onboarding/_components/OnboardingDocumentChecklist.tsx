'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp } from 'lucide-react';

import { supabase } from '../../../lib/supabaseClient';

type ChecklistPayload = {
  application?: { status?: string; completionPercentage?: number } | null;
  missingDocuments?: string[];
  missingCount?: number;
  complete?: boolean;
};

const pretty = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

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

  if (!payload?.application) return null;

  const missing = payload.missingDocuments ?? [];
  if (!missing.length) {
    return <aside style={{ margin: '12px auto 0', width: 'min(1120px, calc(100% - 24px))', border: '1px solid #b7dec9', borderRadius: 12, background: '#f4fbf7', padding: '11px 13px', display: 'flex', gap: 10, alignItems: 'center', color: '#12633f', fontSize: 12 }}>
      <CheckCircle2 size={18} /><div><strong>Required document checklist complete.</strong><div style={{ marginTop: 2, color: '#4f7462', fontSize: 11 }}>No canonical missing onboarding documents are currently outstanding.</div></div>
    </aside>;
  }

  return <aside role="status" aria-live="polite" style={{ margin: '12px auto 0', width: 'min(1120px, calc(100% - 24px))', border: '1px solid #efc36f', borderLeft: '5px solid #f5a300', borderRadius: 12, background: '#fffaf0', padding: '13px 14px', color: '#553b13' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: '#fff0d5', color: '#b66b00', flex: '0 0 auto' }}><AlertTriangle size={18} /></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <strong style={{ display: 'block', color: '#7a4d00', fontSize: 13 }}>Your onboarding still needs {missing.length} document{missing.length === 1 ? '' : 's'}</strong>
        <p style={{ margin: '4px 0 9px', color: '#806b43', fontSize: 11.5, lineHeight: 1.45 }}>Upload or correct the items below. This reminder remains visible until the canonical requirements are complete.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{missing.map((document) => <span key={document} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid #efd9a9', borderRadius: 7, background: '#fff', padding: '5px 8px', color: '#6c501e', fontSize: 10.5, fontWeight: 750 }}><FileUp size={12} />{pretty(document)}</span>)}</div>
      </div>
    </div>
  </aside>;
}
