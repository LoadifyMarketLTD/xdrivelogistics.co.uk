'use client';

import { useEffect, useMemo, useState } from 'react';

import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../AuthContext';
import { workspaceTheme } from './WorkspaceUI';

type WorkspaceOption = {
  membershipId: string;
  companyId: string;
  companyName: string;
  companyType: string | null;
  membershipRole: string;
};

type WorkspacesResponse = {
  activeCompanyId: string | null;
  workspaces: WorkspaceOption[];
  error?: string;
};

type SwitchResponse = {
  success?: boolean;
  route?: string;
  error?: string;
};

const formatRole = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

export default function WorkspaceCompanySwitcher() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(user?.companyId ?? null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        if (!cancelled) {
          setError('Workspace session is unavailable.');
          setLoading(false);
        }
        return;
      }

      const response = await fetch('/api/auth/workspaces', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as WorkspacesResponse;
      if (cancelled) return;

      if (!response.ok) {
        setError(payload.error ?? 'Unable to load company workspaces.');
        setLoading(false);
        return;
      }

      setWorkspaces(payload.workspaces ?? []);
      setActiveCompanyId(payload.activeCompanyId ?? user.companyId ?? null);
      setLoading(false);
    };

    void load();
    return () => { cancelled = true; };
  }, [user?.companyId, user?.id]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.companyId === activeCompanyId) ?? null,
    [activeCompanyId, workspaces]
  );

  const switchWorkspace = async (companyId: string) => {
    if (!companyId || companyId === activeCompanyId || switching) return;

    setSwitching(true);
    setError('');
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setError('Workspace session is unavailable.');
      setSwitching(false);
      return;
    }

    const response = await fetch('/api/auth/workspaces', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ companyId }),
    });
    const payload = (await response.json().catch(() => ({}))) as SwitchResponse;

    if (!response.ok || !payload.success) {
      setError(payload.error ?? 'Unable to switch workspace.');
      setSwitching(false);
      return;
    }

    setActiveCompanyId(companyId);
    window.location.assign(payload.route ?? '/');
  };

  if (loading || workspaces.length <= 1) return null;

  return (
    <div style={{ marginTop: '0.65rem' }}>
      <label
        htmlFor="xdrive-workspace-switcher"
        style={{
          display: 'block',
          color: workspaceTheme.muted,
          fontSize: '0.61rem',
          fontWeight: 850,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: '0.28rem',
        }}
      >
        Active company & role
      </label>
      <select
        id="xdrive-workspace-switcher"
        value={activeCompanyId ?? ''}
        disabled={switching}
        onChange={(event) => void switchWorkspace(event.target.value)}
        style={{
          width: '100%',
          border: `1px solid ${error ? '#fecaca' : workspaceTheme.border}`,
          borderRadius: '8px',
          background: '#fff',
          color: workspaceTheme.text,
          padding: '0.48rem 0.55rem',
          fontSize: '0.7rem',
          fontWeight: 750,
          cursor: switching ? 'wait' : 'pointer',
        }}
      >
        {workspaces.map((workspace) => (
          <option key={workspace.membershipId} value={workspace.companyId}>
            {workspace.companyName} — {formatRole(workspace.membershipRole)}
          </option>
        ))}
      </select>
      <div style={{ marginTop: '0.28rem', color: error ? workspaceTheme.red : workspaceTheme.muted, fontSize: '0.62rem', lineHeight: 1.35 }}>
        {error || (switching ? 'Switching workspace…' : activeWorkspace ? `${formatRole(activeWorkspace.membershipRole)} access` : '')}
      </div>
    </div>
  );
}
