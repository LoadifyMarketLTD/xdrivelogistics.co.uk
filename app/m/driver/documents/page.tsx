'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { readRouteAuthAccessToken } from '../../../../lib/routeAuthCookie';
import DriverDocumentUpload from './DriverDocumentUpload';

type Document = {
  id: string; doc_type?: string; status?: string; expiry_date?: string | null;
  rejection_reason?: string | null; is_vehicle_document: boolean;
};
type Resources = {
  documents?: Document[];
  partial?: string[];
  vehicle?: { reg_plate?: string | null } | null;
  driver?: { driver_type?: string | null } | null;
};
const documentLabels: Record<string, string> = {
  driving_licence: 'Driving licence',
  proof_of_address: 'Proof of address',
  right_to_work: 'Right to work',
  cpc: 'Driver CPC',
  visa_document: 'Visa / immigration document',
  mot: 'MOT',
  insurance: 'Insurance',
};
export default function MobileDriverDocumentsPage() {
  const [data, setData] = useState<Resources | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [opening, setOpening] = useState('');
  const [link, setLink] = useState<{ id: string; url: string; expiresAt: number } | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setData(null); setLink(null); setNotice('');
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Please sign in to see your documents.');
      const response = await fetch('/api/driver/web/resources', {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Documents could not be loaded.');
      setData(result.resources ?? null); setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load documents.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);
  const openDocument = async (document: Document) => {
    setOpening(document.id); setLink(null); setError('');
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Please sign in again.');
      const response = await fetch(`/api/driver/web/documents/${encodeURIComponent(document.id)}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.signedUrl !== 'string')
        throw new Error(result.error || 'The document could not be opened.');
      const url = new URL(result.signedUrl);
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost'))
        throw new Error('The document URL is not secure.');
      setLink({ id: document.id, url: url.toString(), expiresAt: Date.now() + 285000 });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The document could not be opened.');
    } finally { setOpening(''); }
  };
  const docs = data?.documents ?? [];
  return <section className="xd-mobile-list">
    <header><Link className="xd-mobile-back" href="/m/driver/more">More</Link>
      <h1>Documents</h1><p>Driver and assigned vehicle compliance records</p></header>
    {loading ? <p role="status">Loading documents...</p> : null}
    {error ? <div role="alert" className="xd-mobile-error"><p>{error}</p>
      <button type="button" onClick={() => void refresh()}>Retry</button></div> : null}
    {notice ? <p role="status" className="xd-mobile-success">{notice}</p> : null}
    {!loading && data ? <>
      {data.partial?.some(name => name === 'driver_documents' || name === 'vehicle_documents')
        ? <p role="alert">Some documents could not be loaded. Retry to refresh.</p> : null}
      {!docs.length ? <p>No documents uploaded yet.</p> : null}
      {docs.map(doc => <article key={`${doc.is_vehicle_document}-${doc.id}`} className="xd-mobile-card">
        <div className="xd-mobile-card__top"><strong>{documentLabels[doc.doc_type ?? ''] ?? (doc.doc_type || 'Document')}</strong>
          <span className="xd-mobile-pill">{doc.status || 'pending'}</span></div>
        <p>{doc.is_vehicle_document ? 'Assigned vehicle' : 'Driver document'}</p>
        {doc.expiry_date ? <p>Expires: {doc.expiry_date}</p> : null}
        {doc.rejection_reason ? <p className="xd-mobile-error">{doc.rejection_reason}</p> : null}
        <div className="xd-mobile-actions"><button type="button" disabled={opening === doc.id}
          onClick={() => void openDocument(doc)}>{opening === doc.id ? 'Opening...' : 'Get secure link'}</button>
          {link?.id === doc.id ? <a href={link.url} target="_blank" rel="noopener noreferrer"
            onClick={event => { if (Date.now() > link.expiresAt) { event.preventDefault(); setLink(null); setError('Link expired. Request a new link.'); } }}>
            Open document</a> : null}</div>
      </article>)}
      <DriverDocumentUpload hasAssignedVehicle={Boolean(data.vehicle)}
        ownerDriver={data.driver?.driver_type?.trim().toLowerCase() === 'owner_driver'}
        onUploaded={async () => { await refresh(); setNotice('Document uploaded for review.'); }} />
    </> : null}
  </section>;
}
