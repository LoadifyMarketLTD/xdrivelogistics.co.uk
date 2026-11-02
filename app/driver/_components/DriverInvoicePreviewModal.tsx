'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { ActionButton } from '../../components/workspace/WorkspaceUI';

export default function DriverInvoicePreviewModal({
  invoiceId,
  invoiceNumber,
  onClose,
}: {
  invoiceId: string | null;
  invoiceNumber?: string | null;
  onClose: () => void;
}) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    const loadPreview = async () => {
      if (!invoiceId) {
        setPdfUrl(null);
        setError('');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      setPdfUrl(null);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error('Your session has expired. Sign in again.');
        const response = await fetch(`/api/driver/finance/invoices/${encodeURIComponent(invoiceId)}/preview`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({})) as { error?: string };
          throw new Error(payload.error || 'Invoice preview could not be generated.');
        }
        const blob = await response.blob();
        if (!blob.size || !blob.type.includes('pdf')) throw new Error('The invoice preview response is not a valid PDF.');
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setPdfUrl(objectUrl);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Invoice preview could not be generated.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadPreview();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [invoiceId]);

  if (!invoiceId) return null;

  return (
    <div className="driver-invoice-preview-backdrop" role="presentation">
      <section className="driver-invoice-preview" role="dialog" aria-modal="true" aria-labelledby="driver-invoice-preview-title">
        <header className="driver-invoice-preview__header">
          <strong id="driver-invoice-preview-title">Invoice preview{invoiceNumber ? ` · ${invoiceNumber}` : ''}</strong>
          <ActionButton tone="secondary" onClick={onClose}>Return to Diary</ActionButton>
        </header>
        <div className="driver-invoice-preview__body">
          {loading && <div className="driver-invoice-preview__state" role="status">Generating secure invoice preview…</div>}
          {error && <div className="driver-invoice-preview__state driver-invoice-preview__state--error" role="alert">{error}</div>}
          {pdfUrl && <iframe src={pdfUrl} title={invoiceNumber ? `Invoice ${invoiceNumber}` : 'Invoice preview'} />}
        </div>
      </section>
    </div>
  );
}
