'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

type StopContact = {
  address?: string | null;
  postcode?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
};
export type SecureCustomerLoadDetails = {
  ownerCompany?: { memberId?: string | null };
  route?: { pickup?: StopContact; delivery?: StopContact };
};

/** Owner-only details are requested from the authenticated, server-authorised job-sheet API. */
export function useCustomerSecureLoadDetails(jobId: string | null, enabled: boolean) {
  const [state, setState] = useState<{ id: string; data: SecureCustomerLoadDetails | null; loading: boolean }>({
    id: '', data: null, loading: false,
  });

  useEffect(() => {
    if (!enabled || !jobId) return;
    let active = true;
    const id = jobId;
    const load = async () => {
      setState({ id, data: null, loading: true });
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) throw new Error('No authorised session');
        const response = await fetch('/api/workspace/jobs/' + encodeURIComponent(id) + '/sheet', {
          headers: { Authorization: 'Bearer ' + token }, cache: 'no-store',
          signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) throw new Error('Job sheet not authorised or unavailable');
        const payload = await response.json() as { sheet?: SecureCustomerLoadDetails };
        if (!payload.sheet) throw new Error('Job sheet not available');
        if (active) setState({ id, data: payload.sheet, loading: false });
      } catch {
        if (active) setState({ id, data: null, loading: false });
      }
    };
    void load();
    return () => { active = false; };
  }, [enabled, jobId]);

  return enabled && jobId && state.id === jobId ? state : { id: jobId ?? '', data: null, loading: Boolean(enabled && jobId) };
}

export function formatAuthorisedStop(stop?: StopContact) {
  if (!stop) return '';
  return [
    [stop.address, stop.postcode].filter(Boolean).join(', '),
    [stop.contactName, stop.contactPhone].filter(Boolean).join(' / '),
  ].filter(Boolean).join(' | ');
}
