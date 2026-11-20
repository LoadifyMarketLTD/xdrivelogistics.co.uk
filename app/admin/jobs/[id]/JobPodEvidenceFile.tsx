'use client';

import { useEffect, useState } from 'react';
import { inlineEvidenceImage, isPodStorageReference } from '../../../../lib/pod/jobEvidenceReferences';
import { readRouteAuthHeader } from '../../../../lib/routeAuthCookie';

type EvidenceState = { status: 'loading' | 'ready' | 'unavailable'; url?: string };
const evidenceActionStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  minHeight: 44, padding: '8px 12px', maxWidth: '100%', border: '1px solid #cbd5e1',
  borderRadius: 6, background: '#fff', color: '#0E3FA9', font: 'inherit',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none',
} as const;

export default function JobPodEvidenceFile({jobId, reference, label, document = false}: {
  jobId: string; reference: string; label: string; document?: boolean;
}) {
  const inline = inlineEvidenceImage(reference);
  const [state, setState] = useState<EvidenceState>({ status: 'loading' });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (inline) return;
    const controller = new AbortController();
    const auth = readRouteAuthHeader();
    if (!auth || !isPodStorageReference(reference)) {
      setState({status:'unavailable'});
      return () => controller.abort();
    }
    setState({status:'loading'});
    // A stalled signing request must never leave a job evidence card loading forever.
    const timeout = window.setTimeout(() => {
      if (controller.signal.aborted) return;
      controller.abort();
      setState({status:'unavailable'});
    }, 15_000);
    const params = new URLSearchParams({jobId, path:reference});
    void (async () => {
      try {
        const response = await fetch('/api/pod/signed-url?' + params.toString(), {
          headers:{Authorization:auth}, cache:'no-store', signal:controller.signal,
        });
        const payload = await response.json() as {signedUrl?:unknown};
        if (!controller.signal.aborted) {
          setState(response.ok && typeof payload.signedUrl === 'string' && /^https:\/\//i.test(payload.signedUrl)
            ? {status:'ready',url:payload.signedUrl} : {status:'unavailable'});
        }
      } catch {
        if (!controller.signal.aborted) setState({status:'unavailable'});
      } finally {
        window.clearTimeout(timeout);
      }
    })();
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [jobId, reference, retry, inline]);

  const image = inline ? reference : state.status === 'ready' ? state.url : undefined;
  const unavailable = state.status === 'unavailable';
  return (
    <div style={{minWidth:0,border:'1px solid #e5e7eb',borderRadius:8,overflow:'hidden',background:'#f9fafb',padding:8}}>
      <div style={{fontSize:12,fontWeight:600,color:'#374151',marginBottom:8}}>{label}</div>
      {image && !unavailable && (!document || inline) ? (
        <img src={image} alt={label} onError={() => setState({status:'unavailable'})}
          style={{display:'block',width:'100%',maxHeight:320,objectFit:'contain',background:'#fff',borderRadius:4}} />
      ) : document && state.status === 'ready' && state.url ? (
        <a href={state.url} target="_blank" rel="noopener noreferrer" style={evidenceActionStyle}>Open document</a>
      ) : (
        <div role="status" style={{fontSize:13,color:'#4b5563',padding:'12px 4px'}}>
          {unavailable ? 'Evidence file unavailable.' : 'Loading secure evidence...'}
        </div>
      )}
      {!inline && unavailable && isPodStorageReference(reference) && <button type="button" onClick={() => setRetry(n=>n+1)} style={{...evidenceActionStyle,marginTop:8}}>Retry</button>}
      {!inline && document && state.status === 'ready' && <button type="button" onClick={() => setRetry(n=>n+1)} style={{...evidenceActionStyle,marginTop:8}}>Refresh secure link</button>}
    </div>
  );
}
