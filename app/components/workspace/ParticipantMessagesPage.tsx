'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from './WorkspaceUI';

type MessageDirection = 'inbound' | 'outbound';
type MessageRow = {
  id: string;
  body: string;
  createdAt: string | null;
  direction: MessageDirection;
  senderUserId: string | null;
  recipientUserId: string | null;
};

type MessageThread = {
  key: string;
  conversationId: string | null;
  counterpartUserId: string | null;
  counterpartName: string;
  canReply: boolean;
  latestAt: string | null;
  latestBody: string;
  messages: MessageRow[];
};

type MessagesResponse = {
  threads?: MessageThread[];
  readStateAvailable?: boolean;
  arbitraryRecipientCreationAvailable?: boolean;
  error?: string;
};

function fmtDateTime(value: string | null) {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function ParticipantMessagesPage({
  eyebrow,
  title = 'Messages',
  description,
}: {
  eyebrow: string;
  title?: string;
  description: string;
}) {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const loadMessages = useCallback(async (preferredKey?: string | null) => {
    if (!isSupabaseConfigured) {
      setThreads([]);
      setLoading(false);
      setError('Messages are unavailable because authentication is not configured.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) throw new Error('Your session has expired. Please sign in again.');

      const response = await fetch('/api/workspace/messages', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as MessagesResponse;
      if (!response.ok) throw new Error(payload.error || 'Messages could not be loaded.');

      const nextThreads = payload.threads ?? [];
      setThreads(nextThreads);
      setSelectedKey((current) => {
        const target = preferredKey ?? current;
        if (target && nextThreads.some((thread) => thread.key === target)) return target;
        return nextThreads[0]?.key ?? null;
      });
    } catch (reason) {
      setThreads([]);
      setSelectedKey(null);
      setError(reason instanceof Error ? reason.message : 'Messages could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadMessages(); }, [loadMessages]);

  const selected = useMemo(
    () => threads.find((thread) => thread.key === selectedKey) ?? null,
    [selectedKey, threads],
  );

  const sendReply = async () => {
    if (!selected?.conversationId || !selected.canReply || !reply.trim() || sending) return;
    setSending(true);
    setSendError('');
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) throw new Error('Your session has expired. Please sign in again.');

      const response = await fetch('/api/workspace/messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversationId: selected.conversationId, body: reply.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Message could not be sent.');

      const keepKey = selected.key;
      setReply('');
      await loadMessages(keepKey);
    } catch (reason) {
      setSendError(reason instanceof Error ? reason.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={<ActionButton tone="secondary" disabled={loading} onClick={() => void loadMessages()}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>}
      />

      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {sendError && <AlertBanner tone="danger">{sendError}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Message conversations">
          <div className="workspace-filter-rail__header">Conversations</div>
          <div className="workspace-filter-rail__body">
            <div style={{ fontSize: 11, color: '#64748b', lineHeight: '16px' }}>
              Existing participant conversations only. XDrive does not expose arbitrary recipient lookup from this surface.
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              {threads.map((thread) => (
                <button
                  key={thread.key}
                  type="button"
                  onClick={() => { setSelectedKey(thread.key); setReply(''); setSendError(''); }}
                  style={{
                    minHeight: 44,
                    padding: '6px 8px',
                    border: selectedKey === thread.key ? '1px solid #1d57d8' : '1px solid #e2e8f0',
                    borderRadius: 4,
                    background: selectedKey === thread.key ? '#eff6ff' : '#fff',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <strong style={{ display: 'block', fontSize: 12, lineHeight: '16px', color: '#0f172a' }}>{thread.counterpartName}</strong>
                  <span style={{ display: 'block', marginTop: 2, fontSize: 10, lineHeight: '14px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {thread.latestBody || 'Message'} · {fmtDateTime(thread.latestAt)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="workspace-tab-strip" role="tablist" aria-label="Messaging workspace" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>
            <button type="button" data-active="true">Conversations {threads.length}</button>
          </div>
          <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}>
            <span>{threads.length} conversation{threads.length === 1 ? '' : 's'} · no fabricated read-state</span>
            <StatusBadge value="Participant scoped" tone="green" />
          </div>

          {loading ? (
            <div className="workspace-panel"><EmptyState compact title="Loading messages…" /></div>
          ) : threads.length === 0 ? (
            <div className="workspace-panel"><EmptyState title="No messages yet" description="Verified participant conversations will appear here when real message records exist." /></div>
          ) : !selected ? (
            <div className="workspace-panel"><EmptyState compact title="Choose a conversation" /></div>
          ) : (
            <section className="workspace-panel" aria-label={`Conversation with ${selected.counterpartName}`}>
              <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}>
                <strong>{selected.counterpartName}</strong>
                <span>{selected.conversationId ? `Conversation ${selected.conversationId.slice(0, 8).toUpperCase()}` : 'Legacy message record'}</span>
              </div>

              <div style={{ display: 'grid', gap: 8, paddingTop: 8 }}>
                {selected.messages.map((message) => (
                  <article
                    key={message.id}
                    className="workspace-operational-row"
                    data-state={message.direction === 'outbound' ? 'sent' : 'received'}
                    style={{ marginLeft: message.direction === 'outbound' ? '8%' : 0, marginRight: message.direction === 'inbound' ? '8%' : 0 }}
                  >
                    <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}>
                      <strong>{message.direction === 'outbound' ? 'You' : selected.counterpartName}</strong>
                      <span>{fmtDateTime(message.createdAt)}</span>
                      <StatusBadge value={message.direction === 'outbound' ? 'Sent' : 'Received'} tone={message.direction === 'outbound' ? 'blue' : 'green'} />
                    </div>
                    <div style={{ padding: '8px 10px', fontSize: 13, lineHeight: '19px', color: '#0f172a', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {message.body}
                    </div>
                  </article>
                ))}
              </div>

              {selected.canReply ? (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0', display: 'grid', gap: 6 }}>
                  <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 700, color: '#475569' }}>
                    REPLY
                    <textarea
                      value={reply}
                      maxLength={4000}
                      rows={4}
                      onChange={(event) => setReply(event.target.value)}
                      placeholder={`Reply to ${selected.counterpartName}`}
                      style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4, font: 'inherit', resize: 'vertical' }}
                    />
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 10, color: '#64748b' }}>{reply.length}/4000 · messages are immutable once sent</span>
                    <ActionButton tone="primary" disabled={sending || !reply.trim()} onClick={() => void sendReply()}>{sending ? 'Sending…' : 'Send Reply'}</ActionButton>
                  </div>
                </div>
              ) : (
                <AlertBanner tone="warning">
                  Reply is unavailable for this historical record because no single verified conversation counterpart is stored. The record remains visible and unchanged.
                </AlertBanner>
              )}
            </section>
          )}
        </main>
      </div>
    </PageFrame>
  );
}
