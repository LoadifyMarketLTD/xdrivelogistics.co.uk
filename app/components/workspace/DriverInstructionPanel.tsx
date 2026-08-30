'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState, Panel } from './WorkspaceUI';

type DriverInstruction = {
  id: string;
  instruction: string;
  createdAt: string | null;
  createdBy: string;
};

type InstructionState = {
  canAdd: boolean;
  reason: string | null;
  assignedDriver: boolean;
  instructions: DriverInstruction[];
};

const formatWhen = (value: string | null) => {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function DriverInstructionPanel({ jobId }: { jobId: string }) {
  const [state, setState] = useState<InstructionState | null>(null);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch(`/api/workspace/jobs/${encodeURIComponent(jobId)}/instructions`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as Partial<InstructionState> & { error?: string };
      if (response.status === 403 || response.status === 404) {
        setState(null);
        setError('');
        return;
      }
      if (!response.ok) throw new Error(payload.error || 'Driver instructions are unavailable.');
      setState({
        canAdd: payload.canAdd === true,
        reason: typeof payload.reason === 'string' ? payload.reason : null,
        assignedDriver: payload.assignedDriver === true,
        instructions: Array.isArray(payload.instructions) ? payload.instructions : [],
      });
    } catch (reason) {
      setState(null);
      setError(reason instanceof Error ? reason.message : 'Driver instructions are unavailable.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { void load(); }, [load]);

  const send = async () => {
    const clean = instruction.trim();
    if (!clean || sending) return;
    setSending(true);
    setMessage('');
    setError('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch(`/api/workspace/jobs/${encodeURIComponent(jobId)}/instructions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ instruction: clean }),
      });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        assignedDriver?: boolean;
        driverInboxNotified?: boolean;
      };
      if (!response.ok) throw new Error(payload.error || 'The Driver instruction could not be saved.');
      setInstruction('');
      setMessage(payload.assignedDriver
        ? payload.driverInboxNotified
          ? 'Instruction saved and added to the assigned Driver’s XDrive inbox.'
          : 'Instruction saved. It is attached to the job and visible to the assigned Driver.'
        : 'Instruction saved. It will be visible to the Driver when one is assigned to this job.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The Driver instruction could not be saved.');
    } finally {
      setSending(false);
    }
  };

  if (loading) return null;
  if (!state) return error ? <AlertBanner tone="warning">{error}</AlertBanner> : null;
  if (!state.canAdd && state.instructions.length === 0) return null;

  return (
    <Panel
      title="Driver instructions"
      description="Append-only operational updates for the awarded Driver. These instructions do not change the route, rate, cargo, timing, vehicle or awarded terms."
    >
      <div style={{ display: 'grid', gap: 8 }}>
        {message && <AlertBanner tone="success">{message}</AlertBanner>}
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}

        {state.instructions.length > 0 ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {state.instructions.map((item, index) => (
              <div key={item.id} className="workspace-detail-item">
                <strong>Instruction {index + 1}</strong>
                <div style={{ whiteSpace: 'pre-wrap' }}>{item.instruction}</div>
                <small>{item.createdBy} · {formatWhen(item.createdAt)}</small>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState compact title="No additional Driver instructions" description="Use this only when new operational information becomes available after award." />
        )}

        {state.canAdd ? (
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 8, display: 'grid', gap: 6 }}>
            <label style={{ display: 'grid', gap: 4, color: '#334155', fontSize: 11, fontWeight: 700 }}>
              Add new instruction
              <textarea
                value={instruction}
                maxLength={2000}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder="For example: Delivery gate is at the rear of the building. Call the site contact 15 minutes before arrival."
                style={{ width: '100%', minHeight: 72, border: '1px solid #cfd7e3', borderRadius: 4, padding: '7px 8px', fontSize: 12, boxSizing: 'border-box', resize: 'vertical', background: '#fff', color: '#172033' }}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <small style={{ color: '#64748b' }}>
                {state.assignedDriver
                  ? 'This is added to the permanent job history and shown to the assigned Driver.'
                  : 'This is added to the permanent job history and will be shown once a Driver is assigned.'}
              </small>
              <ActionButton tone="primary" disabled={sending || !instruction.trim()} onClick={() => void send()}>
                {sending ? 'Sending…' : 'Send instruction to Driver'}
              </ActionButton>
            </div>
          </div>
        ) : state.reason ? (
          <AlertBanner tone="warning">{state.reason}</AlertBanner>
        ) : null}
      </div>
    </Panel>
  );
}
