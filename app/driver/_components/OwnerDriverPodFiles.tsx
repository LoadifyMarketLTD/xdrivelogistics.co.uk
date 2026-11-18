'use client';

import { useEffect, useState } from 'react';

export default function OwnerDriverPodFiles({ jobId, photoPaths, authHeader }: { jobId: string; photoPaths: string[]; authHeader: () => Promise<string | null> }) {
  const pathKey = JSON.stringify([...new Set(photoPaths.filter(value => typeof value === 'string' && value.trim()))].slice(0,10));
  const [links, setLinks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const paths = JSON.parse(pathKey) as string[];
    setLinks([]);setError('');setLoading(true);
    void (async () => {
      if (!paths.length) {setError('No delivery photographs are linked to this POD.');setLoading(false);return;}
      try {
        const auth = await authHeader();
        if (!auth) throw Error('Your Driver session is unavailable.');
        const results = await Promise.all(paths.map(async path => {
          try {
            const query = new URLSearchParams({jobId,path});
            const response = await fetch('/api/pod/signed-url?' + query, { headers:{Authorization:auth}, cache:'no-store', signal:controller.signal });
            const payload = await response.json().catch(() => null) as {signedUrl?:string}|null;
            if (!response.ok || !payload?.signedUrl) return '';
            const url = new URL(payload.signedUrl);
            return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/storage/v1/object/sign/pod-photos/') ? url.toString() : '';
          } catch { return ''; }
        }));
        if (controller.signal.aborted) return;
        const allowed = results.filter(Boolean);
        setLinks(allowed);
        if (allowed.length !== paths.length) setError('Some POD photographs could not be opened. Close and reopen the POD to retry.');
      } catch {
        if (!controller.signal.aborted) setError('POD photographs could not be authorised. Close and reopen the POD to retry.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  },[authHeader,jobId,pathKey]);
  return <div className="driver-order-block"><strong>POD files</strong>
    {loading ? <span role="status">Loading secure POD photo links...</span> : links.map((url,index) => <a key={url} href={url} target="_blank" rel="noopener noreferrer">Delivery photo {index+1}</a>)}
    {!loading && error && <span role="status">{error}</span>}
  </div>;
}
