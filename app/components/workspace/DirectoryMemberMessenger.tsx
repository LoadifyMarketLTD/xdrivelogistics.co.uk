'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState } from './WorkspaceUI';

type MessageRow = {
  id: string;
  body: string;
  createdAt: string | null;
  direction: 'inbound' | 'outbound';
};

type MessageThread = {
  key: string;
  conversationId: string | null;
  counterpartCompanyId: string | null;
  counterpartName: string;
  counterpartCompanyName: string | null;
  canReply: boolean;
  messages: MessageRow[];
};

type MessagesResponse = { threads?: MessageThread[]; error?: string };

function fmt(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
}
export function DirectoryMemberMessenger({
  companyId,
  companyName,
  onClose,
}: {
  companyId: string;
  companyName: string;
  onClose: () => void;
}) {
  const [thread, setThread] = useState<MessageThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      const response = await fetch('/api/driver/messages', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as MessagesResponse;
      if (!response.ok) throw new Error(payload.error || 'Messages could not be loaded.');
      const match = (payload.threads ?? []).find((item) => item.counterpartCompanyId === companyId) ?? null;
      setThread(match);
    } catch (reason) {
      setThread(null);
      setError(reason instanceof Error ? reason.message : 'Messages could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [companyId]);
  useEffect(() => { void load(); }, [load]);

  const title = useMemo(
    () => thread?.counterpartCompanyName || thread?.counterpartName || companyName,
    [companyName, thread],
  );

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      const response = await fetch('/api/driver/messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(thread?.conversationId
          ? { conversationId: thread.conversationId, body }
          : { companyId, body }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Message could not be sent.');
      setDraft('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  };
  return (
    <div
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(15,23,42,.44)' }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Freight Messenger with ${title}`}
        style={{
          position: 'absolute', top: 12, right: 12, bottom: 12, width: 'min(590px, calc(100vw - 32px))',
          display: 'grid', gridTemplateRows: 'auto minmax(0,1fr) auto', background: '#fff',
          border: '1px solid #cbd5e1', boxShadow: '0 18px 48px rgba(15,23,42,.25)',
        }}
      >
        <header style={{ minHeight: 76, padding: '14px 18px', textAlign: 'center', borderBottom: '1px solid #dbe3ec', position: 'relative' }}>
          <strong style={{ display: 'block', fontSize: 16, color: '#0f172a' }}>Freight Messenger</strong>
          <span style={{ display: 'block', marginTop: 6, fontSize: 14, fontWeight: 700 }}>{title}</span>
          <button type="button" aria-label="Close messenger" onClick={onClose} style={{ position: 'absolute', right: 12, top: 10, border: 0, background: 'transparent', fontSize: 22, cursor: 'pointer' }}>×</button>
        </header>

        <div style={{ minHeight: 0, overflowY: 'auto', padding: 16 }}>
          {error && <AlertBanner tone="danger">{error}</AlertBanner>}
          {loading ? <EmptyState compact title="Loading conversation…" /> : thread?.messages.length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {thread.messages.map((message) => (
                <article
                  key={message.id}
                  style={{
                    justifySelf: message.direction === 'outbound' ? 'end' : 'start',
                    maxWidth: '82%', padding: '9px 11px', border: '1px solid #dbe3ec',
                    borderRadius: 8, background: message.direction === 'outbound' ? '#eff6ff' : '#f8fafc',
                  }}
                >
                  <div style={{ fontSize: 12, lineHeight: '18px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.body}</div>
                  <small style={{ display: 'block', marginTop: 4, color: '#64748b' }}>{fmt(message.createdAt)}</small>
                </article>
              ))}
            </div>
          ) : (
            <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center' }}>
              <EmptyState compact title="Send a message to start the conversation" />
            </div>
          )}
        </div>

        <footer style={{ padding: 12, borderTop: '1px solid #dbe3ec', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
          <textarea
            value={draft}
            rows={2}
            maxLength={4000}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Send a message"
            style={{ width: '100%', resize: 'none', border: '1px solid #cbd5e1', borderRadius: 20, padding: '9px 13px', font: 'inherit' }}
          />
          <ActionButton tone="primary" disabled={!draft.trim() || sending || Boolean(thread && !thread.canReply)} onClick={() => void send()}>
            {sending ? 'Sending…' : 'Send'}
          </ActionButton>
        </footer>
      </aside>
    </div>
  );
}
