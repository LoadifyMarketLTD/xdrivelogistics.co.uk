'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export type BidderIdentity = {
  bidId: string;
  companyId: string | null;
  driverId: string | null;
  companyName: string | null;
  personName: string | null;
  companyType: string | null;
  displayName: string;
};

export function useBidderIdentities(bids: readonly { id: string }[]) {
  const [identities, setIdentities] = useState<Map<string, BidderIdentity>>(new Map());
  const [error, setError] = useState('');
  const bidKey = useMemo(() => bids.map((bid) => bid.id).sort().join('|'), [bids]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!bidKey) {
        setIdentities(new Map());
        setError('');
        return;
      }
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        if (!cancelled) setError('Member identities are unavailable until the session is refreshed.');
        return;
      }
      const response = await fetch('/api/workspace/bids/identities', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as { identities?: BidderIdentity[]; error?: string };
      if (cancelled) return;
      if (!response.ok) {
        setError(payload.error ?? 'Member identities could not be resolved.');
        return;
      }
      setIdentities(new Map((payload.identities ?? []).map((identity) => [identity.bidId, identity])));
      setError('');
    };
    void load();
    return () => { cancelled = true; };
  }, [bidKey]);

  return { identities, error };
}
