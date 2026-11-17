import { useState } from 'react';
import { renewSession, type LiveSession } from './liveApi';

type Props = {
  jobId: string;
  session: LiveSession;
  onSession: (next: LiveSession) => void;
};

/** Download only a completed, server-verified POD. No invoice creation or mutation. */
export default function OfficialPodDownload({ jobId, session, onSession }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function download() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const fresh = await renewSession(session);
      onSession(fresh);
      const base = import.meta.env.PROD ? '/api/workspace/jobs/' : '/xdrive-api/workspace/jobs/';
      const response = await fetch(base + encodeURIComponent(jobId) + '/pod/pdf', {
        headers: { Authorization: 'Bearer ' + fresh.token },
        cache: 'no-store',
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(details.error || 'Official POD is not ready (' + response.status + ').');
      }
      if (!(response.headers.get('content-type') || '').includes('application/pdf')) {
        throw new Error('XDrive did not return an official POD PDF.');
      }
      const file = await response.blob();
      if (file.size < 1000) throw new Error('Official POD is incomplete. Nothing was downloaded.');
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'XDrive-' + jobId + '-POD.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to download official POD.');
    } finally {
      setBusy(false);
    }
  }
  return <div className="rv-pod-download">
    <button type="button" className="rv-outline rv-wide" disabled={busy}
      onClick={() => void download()}>
      {busy ? 'Downloading signed POD...' : 'Download Official Signed POD (A4)'}
    </button>
    {error && <div className="rv-error" role="alert">{error}</div>}
  </div>;
}
