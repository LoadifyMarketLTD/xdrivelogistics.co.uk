'use client';

import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../../../lib/supabaseClient';

export type PrivateNetworkGroupMember = {
  companyId: string;
  companyName: string;
  memberId: string | null;
  companyType: string | null;
  createdAt: string | null;
};

export type PrivateNetworkGroup = {
  id: string;
  name: string;
  description: string | null;
  allowLoadVisibility: boolean;
  allowAvailabilityVisibility: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  members: PrivateNetworkGroupMember[];
};

export function usePrivateNetworkGroups(companyId: string | null | undefined) {
  const [groups, setGroups] = useState<PrivateNetworkGroup[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(Boolean(companyId));
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!companyId) {
      setGroups([]);
      setCanManage(false);
      setLoading(false);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch(`/api/network/groups?companyId=${encodeURIComponent(companyId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as {
        groups?: PrivateNetworkGroup[];
        canManage?: boolean;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || 'Private Groups could not be loaded.');
      setGroups(payload.groups ?? []);
      setCanManage(payload.canManage === true);
    } catch (reason) {
      setGroups([]);
      setCanManage(false);
      setError(reason instanceof Error ? reason.message : 'Private Groups could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { groups, canManage, loading, error, refresh };
};
