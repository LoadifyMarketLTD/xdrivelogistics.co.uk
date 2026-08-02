'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../AuthContext';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import {
  ActionCentreList,
  ActionButton,
  DateRangeSelector,
  OperationalToolbar,
  PageFrame,
  PageHeader,
  Panel,
  SavedViewSelector,
} from './WorkspaceUI';
import {
  getNotificationsRoute,
  type ActionCentreRole,
} from './actionCentreConfig';

type ActionCentreEvent = {
  id: string;
  event_type: string;
  entity_type: string | null;
  status: string;
  created_at: string;
  event_id: string | null;
  cta_href: string;
};

const isPendingStatus = (status: string) => {
  const value = status.toLowerCase();
  return value === 'pending' || value === 'queued' || value === 'in_progress';
};

export default function ActionCentrePage({ role }: { role: ActionCentreRole }) {
  const { user } = useAuth();
  const [savedView, setSavedView] = useState('all');
  const [dateRange, setDateRange] = useState('7d');
  const [rows, setRows] = useState<ActionCentreEvent[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadRows = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured) {
      setRows([]);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setRows([]);
        setError('Authentication required.');
        return;
      }

      const response = await fetch(`/api/workspace/action-centre?role=${encodeURIComponent(role)}&limit=100`, {
        method: 'GET',
        cache: 'no-store',
        headers: { Authorization: 'Bearer ' + token },
      });

      const payload = (await response.json().catch(() => ({}))) as {
        items?: ActionCentreEvent[];
        error?: string;
      };

      if (!response.ok) {
        setRows([]);
        setError(payload.error || 'Unable to load action centre.');
        return;
      }

      setRows(Array.isArray(payload.items) ? payload.items : []);
    } catch {
      setRows([]);
      setError('Unable to load action centre.');
    } finally {
      setLoading(false);
    }
  }, [role, user?.id]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const since = useMemo(() => {
    if (dateRange === '24h') return Date.now() - 24 * 60 * 60 * 1000;
    if (dateRange === '30d') return Date.now() - 30 * 24 * 60 * 60 * 1000;
    return Date.now() - 7 * 24 * 60 * 60 * 1000;
  }, [dateRange]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const inRange = new Date(row.created_at).getTime() >= since;
      if (!inRange) return false;
      if (savedView === 'open') return row.status !== 'sent' && row.status !== 'resolved';
      if (savedView === 'failed') return row.status === 'failed';
      return true;
    });
  }, [rows, savedView, since]);

  const actionItems = filteredRows.slice(0, 20).map((row) => ({
    id: row.id,
    title: row.event_type.replace(/_/g, ' '),
    description: row.entity_type ? `Entity: ${row.entity_type}` : 'Operational event',
    priority: row.status === 'failed' ? 'high' : isPendingStatus(row.status) ? 'medium' : 'low',
    status:
      row.status === 'failed'
        ? 'open'
        : isPendingStatus(row.status)
          ? 'in_progress'
          : 'resolved',
    dueLabel: row.status === 'failed' ? 'Requires retry' : undefined,
    entityLabel: row.event_id?.slice(0, 8).toUpperCase() ?? row.id.slice(0, 8).toUpperCase(),
    cta: { label: 'Open details', href: row.cta_href || getNotificationsRoute(role) },
  })) as Parameters<typeof ActionCentreList>[0]['items'];

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Workspace operations"
        title="Action Centre"
        description="Prioritised operational actions requiring review or acknowledgement."
      />
      <OperationalToolbar>
        <SavedViewSelector
          value={savedView}
          onChange={setSavedView}
          options={[
            { value: 'all', label: 'All events' },
            { value: 'open', label: 'Open actions' },
            { value: 'failed', label: 'Failed only' },
          ]}
        />
        <DateRangeSelector
          value={dateRange}
          onChange={setDateRange}
          options={[
            { value: '24h', label: 'Last 24h' },
            { value: '7d', label: 'Last 7 days' },
            { value: '30d', label: 'Last 30 days' },
          ]}
        />
      </OperationalToolbar>
      <Panel
        title="Action queue"
        description={`${filteredRows.length} item(s) in selected view.`}
        actions={
          <ActionButton tone="secondary" onClick={() => void loadRows()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh view'}
          </ActionButton>
        }
      >
        <ActionCentreList
          items={actionItems}
          empty={<div>{error || (loading ? 'Loading actions…' : 'No actions in this view')}</div>}
        />
      </Panel>
    </PageFrame>
  );
}
