'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import type {
  SharedUiContextSnapshot,
  SharedUiMembershipOption,
} from '../../../lib/sharedUiContext';
import type { BusinessWorkspace } from '../../../lib/businessWorkspace';
import { WORKSPACE_LABEL } from '../../../lib/businessWorkspace';
import { useAuth } from '../AuthContext';
import { workspaceTheme } from './WorkspaceUI';

type NavigationTarget = {
  id: string;
  label: string;
  href: string;
};

type ContextResponse = SharedUiContextSnapshot & {
  staleSelectionCleared?: boolean;
  landingRoute?: string;
};

const knownLandingRoute = (value: unknown): value is string =>
  typeof value === 'string' &&
  ['/driver', '/customer', '/broker', '/admin'].some(
    (prefix) => value === prefix || value.startsWith(`${prefix}/`),
  );

export default function SharedContextControls({
  navigation,
}: {
  navigation: readonly NavigationTarget[];
}) {
  const router = useRouter();
  const { refreshUserContext } = useAuth();
  const [context, setContext] = useState<ContextResponse | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState<BusinessWorkspace | ''>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/api/auth/context', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const body = (await response.json().catch(() => null)) as
          | (ContextResponse & { error?: string })
          | null;

        if (!response.ok || !body) {
          throw new Error(body?.error || 'Unable to load workspace context.');
        }

        if (cancelled) return;
        setContext(body);
        setSelectedCompanyId(body.current?.companyId ?? '');
        setSelectedWorkspace(body.current?.activeWorkspace ?? '');
        setError('');
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load workspace context.',
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedMembership = useMemo<SharedUiMembershipOption | null>(
    () =>
      context?.memberships.find(
        (membership) => membership.companyId === selectedCompanyId,
      ) ?? null,
    [context?.memberships, selectedCompanyId],
  );

  const filteredNavigation = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return [];
    return navigation
      .filter(
        (item) =>
          item.label.toLowerCase().includes(normalized) ||
          item.href.toLowerCase().includes(normalized),
      )
      .slice(0, 8);
  }, [navigation, search]);

  const switchContext = async (
    companyId: string,
    workspace: BusinessWorkspace,
  ) => {
    if (!companyId || isSwitching) return;

    setIsSwitching(true);
    setError('');
    try {
      const response = await fetch('/api/auth/context', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, workspace }),
      });
      const body = (await response.json().catch(() => null)) as
        | (ContextResponse & { error?: string })
        | null;

      if (!response.ok || !body) {
        throw new Error(body?.error || 'Unable to switch workspace context.');
      }
      if (!knownLandingRoute(body.landingRoute)) {
        throw new Error('The server returned an invalid workspace route.');
      }

      const refreshResult = await refreshUserContext();
      if (!refreshResult.success) {
        throw new Error(
          refreshResult.error || 'Unable to refresh the selected workspace context.',
        );
      }

      setContext(body);
      router.replace(body.landingRoute);
      router.refresh();
    } catch (switchError) {
      setError(
        switchError instanceof Error
          ? switchError.message
          : 'Unable to switch workspace context.',
      );
      setIsSwitching(false);
    }
  };

  const onCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
    const membership = context?.memberships.find(
      (item) => item.companyId === companyId,
    );
    const workspaces = membership?.enabledWorkspaces ?? [];

    if (workspaces.length === 1 && workspaces[0]) {
      setSelectedWorkspace(workspaces[0]);
      void switchContext(companyId, workspaces[0]);
      return;
    }

    setSelectedWorkspace('');
  };

  const showCompanySwitcher = (context?.memberships.length ?? 0) > 1;
  const showWorkspaceSwitcher =
    Boolean(selectedMembership) &&
    selectedMembership!.enabledWorkspaces.length > 1;

  const controlStyle = {
    height: '34px',
    border: `1px solid ${workspaceTheme.border}`,
    borderRadius: '8px',
    background: '#fff',
    color: workspaceTheme.text,
    fontSize: '0.66rem',
    fontWeight: 750,
    padding: '0 0.55rem',
    minWidth: '0',
  } as const;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '0.35rem',
        flexWrap: 'wrap',
        minWidth: 0,
      }}
      aria-label="Workspace context controls"
    >
      {!isLoading && showCompanySwitcher && (
        <label style={{ display: 'grid', gap: '0.12rem' }}>
          <span style={{ fontSize: '0.52rem', color: workspaceTheme.muted, fontWeight: 800 }}>
            Organisation
          </span>
          <select
            aria-label="Select organisation"
            value={selectedCompanyId}
            disabled={isSwitching}
            onChange={(event) => onCompanyChange(event.target.value)}
            style={{ ...controlStyle, maxWidth: '190px' }}
          >
            <option value="">Select organisation</option>
            {context?.memberships.map((membership) => (
              <option key={membership.membershipId} value={membership.companyId}>
                {membership.companyName}
              </option>
            ))}
          </select>
        </label>
      )}

      {!isLoading && showWorkspaceSwitcher && selectedMembership && (
        <label style={{ display: 'grid', gap: '0.12rem' }}>
          <span style={{ fontSize: '0.52rem', color: workspaceTheme.muted, fontWeight: 800 }}>
            Workspace
          </span>
          <select
            aria-label="Select workspace"
            value={selectedWorkspace}
            disabled={isSwitching || !selectedCompanyId}
            onChange={(event) => {
              const workspace = event.target.value as BusinessWorkspace;
              setSelectedWorkspace(workspace);
              void switchContext(selectedCompanyId, workspace);
            }}
            style={{ ...controlStyle, maxWidth: '160px' }}
          >
            <option value="">Select workspace</option>
            {selectedMembership.enabledWorkspaces.map((workspace) => (
              <option key={workspace} value={workspace}>
                {WORKSPACE_LABEL[workspace]}
              </option>
            ))}
          </select>
        </label>
      )}

      <div style={{ position: 'relative', minWidth: 0 }}>
        <input
          type="search"
          aria-label="Search authorised navigation"
          placeholder="Search navigation"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && filteredNavigation[0]) {
              event.preventDefault();
              router.push(filteredNavigation[0].href);
              setSearch('');
            }
            if (event.key === 'Escape') setSearch('');
          }}
          style={{ ...controlStyle, width: 'clamp(135px, 18vw, 220px)' }}
        />
        {search.trim() && (
          <div
            role="listbox"
            aria-label="Authorised navigation results"
            style={{
              position: 'absolute',
              top: 'calc(100% + 0.3rem)',
              right: 0,
              width: 'min(320px, 82vw)',
              maxHeight: '300px',
              overflowY: 'auto',
              background: '#fff',
              border: `1px solid ${workspaceTheme.border}`,
              borderRadius: '10px',
              boxShadow: '0 14px 32px rgba(15,23,42,0.16)',
              zIndex: 120,
            }}
          >
            {filteredNavigation.length > 0 ? (
              filteredNavigation.map((item) => (
                <button
                  key={`${item.id}-${item.href}`}
                  type="button"
                  role="option"
                  onClick={() => {
                    router.push(item.href);
                    setSearch('');
                  }}
                  style={{
                    width: '100%',
                    border: 0,
                    borderBottom: `1px solid ${workspaceTheme.border}`,
                    background: '#fff',
                    color: workspaceTheme.text,
                    padding: '0.65rem 0.75rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 850 }}>{item.label}</div>
                  <div style={{ marginTop: '0.12rem', fontSize: '0.58rem', color: workspaceTheme.muted }}>
                    {item.href}
                  </div>
                </button>
              ))
            ) : (
              <div style={{ padding: '0.75rem', fontSize: '0.68rem', color: workspaceTheme.muted }}>
                No authorised navigation result.
              </div>
            )}
          </div>
        )}
      </div>

      {isSwitching && (
        <span role="status" style={{ fontSize: '0.6rem', color: workspaceTheme.muted }}>
          Switching…
        </span>
      )}
      {error && (
        <span role="alert" title={error} style={{ maxWidth: '190px', fontSize: '0.58rem', color: workspaceTheme.red }}>
          {error}
        </span>
      )}
    </div>
  );
}
