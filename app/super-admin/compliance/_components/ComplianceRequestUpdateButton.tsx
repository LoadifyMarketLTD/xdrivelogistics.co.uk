'use client';

import { useState } from 'react';

import { getAuthHeader } from '../../_lib/getAuthHeader';

type DocumentFamily = 'driver' | 'vehicle' | 'company' | 'identity';

type Props = {
  documentFamily: DocumentFamily;
  documentId: string;
  onUpdated?: () => void;
};

const buttonStyle = {
  minHeight: '40px',
  padding: '0 14px',
  borderRadius: '8px',
  border: '1px solid #E5E7EB',
  background: '#FFFFFF',
  color: '#1D57D8',
  fontFamily: 'Inter, Arial, sans-serif',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
} as const;

export default function ComplianceRequestUpdateButton({ documentFamily, documentId, onUpdated }: Props) {
  const [busy, setBusy] = useState(false);

  const requestUpdate = async () => {
    const reason = window.prompt('What must be updated or replaced on this document?')?.trim() ?? '';
    if (!reason) return;

    setBusy(true);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        window.alert('No active Platform Owner session.');
        return;
      }

      const response = await fetch('/api/super-admin/compliance/documents', {
        method: 'PATCH',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentFamily,
          id: documentId,
          action: 'request_update',
          reason,
        }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        window.alert(body.error ?? 'The update request could not be recorded.');
        return;
      }

      onUpdated?.();
    } catch {
      window.alert('The update request could not be recorded.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" disabled={busy} onClick={() => void requestUpdate()} style={{ ...buttonStyle, opacity: busy ? 0.6 : 1 }}>
      {busy ? 'Requesting…' : 'Request update'}
    </button>
  );
}
