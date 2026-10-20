'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { readRouteAuthAccessToken } from '../../../lib/routeAuthCookie';
import { getOnboardingContract } from '../../../lib/onboardingContract';

type DocumentEntry = { id: string; docType: string; status: string; hasFile: boolean; uploadedAt: string };
type Application = { id: string; account_type: string; status: string; risk_status: string };
type Selection = { docType: string; label: string; file: File; replacement: boolean };
const buttonStyle = { border: '1px solid #b9c9da', borderRadius: 8, padding: '12px 16px', fontSize: 15, fontWeight: 700, minHeight: 44 } as const;

export default function OnboardingDocumentsPage() {
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [preview, setPreview] = useState<{ label: string; url: string } | null>(null);
  const [target, setTarget] = useState('');

  const headers = useCallback(async (): Promise<Record<string, string> | null> => {
    // Forward the synchronized token to the server, which authenticates it with
    // auth.getUser. Do not queue this page behind another Supabase auth lock.
    const cachedToken = readRouteAuthAccessToken();
    if (cachedToken) return { Authorization: `Bearer ${cachedToken}` };
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const { data: { session } } = await Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Session lookup timed out. Please reload and sign in again.')), 15000);
      }),
    ]).finally(() => { if (timeout) clearTimeout(timeout); });
    if (!session?.access_token) {
      router.replace('/login?next=' + encodeURIComponent(window.location.pathname + window.location.search));
      return null;
    }
    return { Authorization: `Bearer ${session.access_token}` };
  }, [router]);

  const load = useCallback(async () => {
    const auth = await headers();
    if (!auth) return;
    const response = await fetch('/api/onboarding/documents', { headers: auth, cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Your documents could not be loaded.');
    setApplication(result.application);
    setDocuments(result.documents ?? []);
  }, [headers]);

  useEffect(() => {
    setTarget(new URLSearchParams(window.location.search).get('document') ?? '');
    void load().catch(reason => setError(reason instanceof Error ? reason.message : 'Unable to load documents.'))
      .finally(() => setLoading(false));
  }, [load]);

  const openPreview = async (document: DocumentEntry, label: string) => {
    setBusy(document.docType); setError(''); setPreview(null);
    try {
      const auth = await headers(); if (!auth) return;
      const response = await fetch('/api/onboarding/documents?id=' + encodeURIComponent(document.id), { headers: auth, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error ?? 'Unable to prepare the secure preview.');
      setPreview({ label, url: result.url });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to open document.'); }
    finally { setBusy(null); }
  };

  const upload = async () => {
    if (!selection) return;
    const selected = selection;
    setBusy(selected.docType); setError(''); setMessage(''); setPreview(null);
    try {
      const auth = await headers(); if (!auth) return;
      const form = new FormData(); form.set('file', selected.file); form.set('docType', selected.docType);
      const response = await fetch('/api/onboarding/documents', { method: 'POST', headers: auth, body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'The replacement was not saved. Your previous file has been kept.');
      setSelection(null);
      setMessage(`${selected.label}: ${result.replaced ? 'replacement' : 'document'} uploaded successfully. The new file is awaiting verification. Your other documents and signed agreements have not changed.`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Upload failed. Please try again.'); }
    finally { setBusy(null); }
  };

  const contract = getOnboardingContract(application?.account_type);
  const locked = application?.status === 'rejected' || application?.risk_status === 'confirmed_fraud';
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 48px', color: '#0a2239', fontFamily: 'Arial, sans-serif', fontSize: 16, lineHeight: 1.5 }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 28 }}>My onboarding documents</h1>
      <p>View your uploaded files or replace a document that was uploaded by mistake. You do not need to register again.</p>
      {application && <p><strong>Application:</strong> {application.status.replace(/_/g, ' ')}. Replacing evidence does not approve your account.</p>}
      {loading && <p role="status">Loading your documents...</p>}
      {error && <p role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 14, borderRadius: 8, color: '#991b1b' }}>{error}</p>}
      {message && <p role="status" style={{ background: '#f0fdf4', padding: 14, borderRadius: 8, color: '#166534' }}>{message}</p>}
      {locked && <p role="alert">Platform Compliance must reopen this application before documents can be changed.</p>}
      {preview && <section aria-label="Secure document preview" style={{ background: '#eff6ff', padding: 16, borderRadius: 8, margin: '16px 0' }}>
        <strong>{preview.label} preview is ready.</strong>
        <p><a href={preview.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>Open secure preview in a new tab</a></p>
        <p style={{ fontSize: 14 }}>This private link expires after five minutes.</p>
        <button type="button" onClick={() => setPreview(null)} style={buttonStyle}>Close preview link</button>
      </section>}
      {!loading && contract?.documents.length === 0 && <p>This account type has no onboarding documents to replace.</p>}
      <div style={{ display: 'grid', gap: 16 }}>
        {(contract?.documents ?? []).map(doc => {
          const current = documents.find(entry => entry.docType === doc.type && entry.hasFile);
          return <section key={doc.type} aria-label={doc.label} style={{ border: target === doc.type ? '2px solid #2563eb' : '1px solid #cbd5e1', borderRadius: 10, padding: 18, background: '#fff' }}>
            <h2 style={{ fontSize: 19, margin: '0 0 6px' }}>{doc.label}</h2>
            <p style={{ margin: '4px 0 12px' }}>{current
              ? `Uploaded - ${['approved','verified'].includes(current.status) ? 'verified' : current.status === 'rejected' ? 'replacement required' : 'awaiting verification'}`
              : 'No document uploaded.'}</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {current && <button type="button" disabled={busy !== null} onClick={() => void openPreview(current,doc.label)} style={buttonStyle}>View current document</button>}
              <button type="button" disabled={busy !== null || locked} onClick={() => document.getElementById('replace-' + doc.type)?.click()}
                aria-label={(current ? 'Replace ' : 'Upload ') + doc.label}
                style={{ ...buttonStyle, background: '#1d4ed8', color: '#fff', cursor: locked ? 'not-allowed' : 'pointer' }}>
                {busy === doc.type ? 'Please wait...' : current ? 'Replace document' : 'Upload document'}
              </button>
              <input id={'replace-' + doc.type} type="file" hidden aria-label={'Choose file for ' + doc.label}
                accept="application/pdf,image/jpeg,image/png,image/webp" disabled={busy !== null || locked}
                onChange={event => {
                  const file=event.currentTarget.files?.[0]; event.currentTarget.value='';
                  if (file) { setSelection({ docType:doc.type,label:doc.label,file,replacement:Boolean(current) }); setError(''); setMessage(''); }
                }} />
            </div>
            {selection?.docType === doc.type && <div style={{ marginTop: 14, padding: 14, background: '#f8fafc', borderRadius: 8 }}>
              <p style={{ overflowWrap: 'anywhere' }}><strong>Selected:</strong> {selection.file.name}</p>
              <p>{selection.replacement ? 'This will replace the current document for review. The previous version is retained in the audit history.' : 'The uploaded file will be reviewed by Platform Compliance.'} The new file is not automatically approved.</p>
              <button type="button" disabled={busy !== null} onClick={() => void upload()} style={{ ...buttonStyle, background: '#1d4ed8', color: '#fff' }}>{selection.replacement ? 'Confirm replacement' : 'Confirm upload'}</button>{' '}
              <button type="button" disabled={busy !== null} onClick={() => setSelection(null)} style={buttonStyle}>Cancel</button>
            </div>}
          </section>;
        })}
      </div>
      <p style={{ marginTop: 20, color: '#475569', fontSize: 14 }}>PDF, JPG, PNG or WebP. Maximum 10 MB per file. Only your own application documents are shown.</p>
      <nav style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 24 }}>
        <Link href="/pending-approval">Application review status</Link>
        <Link href="/login">Back to sign in</Link>
      </nav>
    </main>
  );
}
