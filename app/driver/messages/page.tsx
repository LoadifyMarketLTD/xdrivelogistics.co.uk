'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from '../../components/workspace/WorkspaceUI';

type MessageDirection = 'inbound' | 'outbound';
type MessageRow = {
  id: string;
  body: string;
  createdAt: string | null;
  direction: MessageDirection;
  senderUserId: string | null;
  recipientUserId: string | null;
};

type ThreadContext = { kind: 'quote' | 'job'; conversationId: string; bidId: string | null; jobId: string; loadRef: string; routeLabel: string; status: string | null; jobStatus: string | null };
type MessageThread = {
  key: string;
  conversationId: string | null;
  counterpartUserId: string | null;
  counterpartName: string;
  counterpartCompanyId: string | null;
  counterpartCompanyName: string | null;
  context: ThreadContext | null;
  canReply: boolean;
  latestAt: string | null;
  latestBody: string;
  messages: MessageRow[];
};

type MessagesResponse = {
  threads?: MessageThread[];
  readStateAvailable?: boolean;
  contextPartial?: boolean;
  error?: string;
};

function fmtDateTime(value: string | null) {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function DriverMessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetConversation = searchParams.get('conversation');
  const targetBidId = searchParams.get('bidId');
  const targetJobId = searchParams.get('jobId');
  const targetCompanyId = searchParams.get('companyId');
  const hasContextTarget = Boolean(targetConversation || targetBidId || targetJobId || targetCompanyId);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [contextPartial, setContextPartial] = useState(false);
  const [contextTargetMissing, setContextTargetMissing] = useState(false);

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

      const response = await fetch('/api/driver/messages', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as MessagesResponse;
      if (!response.ok) throw new Error(payload.error || 'Messages could not be loaded.');

      const nextThreads = payload.threads ?? [];
      const contextualMatch = targetConversation
        ? nextThreads.find((thread) => thread.conversationId === targetConversation) ?? null
        : targetBidId
          ? nextThreads.find((thread) => thread.context?.bidId === targetBidId) ?? null
          : targetJobId
            ? nextThreads.find((thread) => thread.context?.jobId === targetJobId) ?? null
            : targetCompanyId
              ? nextThreads.find((thread) => thread.counterpartCompanyId === targetCompanyId) ?? null
              : null;
      setThreads(nextThreads);
      setContextPartial(payload.contextPartial === true);
      setContextTargetMissing(Boolean(hasContextTarget && !contextualMatch));
      setSelectedKey((current) => {
        if (preferredKey && nextThreads.some((thread) => thread.key === preferredKey)) return preferredKey;
        if (contextualMatch) return contextualMatch.key;
        if (hasContextTarget) return null;
        if (current && nextThreads.some((thread) => thread.key === current)) return current;
        return nextThreads[0]?.key ?? null;
      });
    } catch (reason) {
      setThreads([]);
      setSelectedKey(null);
      setError(reason instanceof Error ? reason.message : 'Messages could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [hasContextTarget, targetBidId, targetCompanyId, targetConversation, targetJobId]);

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

      const response = await fetch('/api/driver/messages', {
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

  const selectedJobHref = selected?.context?.jobId ? `/driver/jobs/${selected.context.jobId}` : null;

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Participant messages are separate from operational notifications. Messages are immutable once sent; the current schema does not store read/unread state."
        headerActions={<ActionButton tone="secondary" disabled={loading} onClick={() => void loadMessages()}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        {sendError && <AlertBanner tone="danger">{sendError}</AlertBanner>}
        {contextPartial && <AlertBanner tone="warning">Some message context could not be enriched. Participant message history remains available without inferred context.</AlertBanner>}
        {contextTargetMissing && <AlertBanner tone="warning">No verified conversation exists for the requested job, quote or member context. XDrive will not create an arbitrary recipient thread.</AlertBanner>}

        <div className="driver-board-layout driver-messages-board">
          <aside className="driver-filter-rail" aria-label="Message conversations">
            <div className="driver-filter-rail__header">Messages</div>
            <div className="driver-filter-rail__body">
              <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '16px' }}>
                Existing participant conversations. New arbitrary recipients are not exposed by the verified messaging contract.
              </div>
              {threads.map((thread) => (
                <button
                  key={thread.key}
                  type="button"
                  className="driver-account-link"
                  data-active={selectedKey === thread.key ? 'true' : 'false'}
                  onClick={() => { setSelectedKey(thread.key); setReply(''); setSendError(''); }}
                >
                  <span>
                    <strong>{thread.counterpartName}</strong>
                    <small>{thread.context ? `${thread.context.kind === 'quote' ? 'Quote' : 'Job'} · ${thread.context.loadRef}` : thread.counterpartCompanyName ?? 'Participant conversation'}</small>
                    <small>{thread.latestBody || 'Message'} · {fmtDateTime(thread.latestAt)}</small>
                  </span>
                  <span>{thread.messages.length}</span>
                </button>
              ))}
              <ActionButton tone="secondary" disabled={loading} onClick={() => void loadMessages()}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>
            </div>
          </aside>

          <main className="driver-board-main">
            <div className="driver-tab-strip" role="tablist" aria-label="Messaging workspace">
              <button type="button" data-active="true">Conversations <span>{threads.length}</span></button>
            </div>
            <div className="driver-board-summary">
              <span>{threads.length} conversation{threads.length === 1 ? '' : 's'} · no fabricated read-state</span>
              <StatusBadge value="Participant scoped" tone="green" />
            </div>

            {loading ? (
              <div className="driver-load-row"><EmptyState compact title="Loading messages…" /></div>
            ) : threads.length === 0 ? (
              <div className="driver-load-row">
                <EmptyState compact title="No messages yet" description="Existing participant conversations will appear here when real message records exist." />
              </div>
            ) : !selected ? (
              <div className="driver-load-row"><EmptyState compact title={contextTargetMissing ? 'No contextual conversation found' : 'Choose a conversation'} description={contextTargetMissing ? 'Continue from a verified quote or existing transport relationship; arbitrary recipient creation stays disabled.' : undefined} /></div>
            ) : (
              <section className="driver-row-details" aria-label={`Conversation with ${selected.counterpartName}`}>
                <div className="driver-detail-tabs">
                  <strong>{selected.counterpartName}{selected.counterpartCompanyName ? ` · ${selected.counterpartCompanyName}` : ''}</strong>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {selected.conversationId ? `Conversation ${selected.conversationId.slice(0, 8).toUpperCase()}` : 'Legacy message record'}
                  </span>
                </div>
                {selected.context && (
                  <div className="driver-load-row" data-state="context" style={{ marginTop: '8px' }}>
                    <div className="driver-load-row__meta">
                      <strong>{selected.context.kind === 'quote' ? 'Quote context' : 'Job context'} · {selected.context.loadRef}</strong>
                      <StatusBadge value={selected.context.jobStatus ?? selected.context.status ?? 'Context linked'} tone="blue" />
                      {selectedJobHref ? <ActionButton tone="secondary" onClick={() => router.push(selectedJobHref)}>Open job</ActionButton> : null}
                    </div>
                    <div style={{ paddingTop: '6px', fontSize: '12px', color: '#475569' }}>{selected.context.routeLabel}</div>
                  </div>
                )}

                <div style={{ display: 'grid', gap: '8px', padding: '10px 0' }}>
                  {selected.messages.map((message) => (
                    <article
                      key={message.id}
                      className="driver-load-row"
                      data-state={message.direction === 'outbound' ? 'sent' : 'received'}
                      style={{ marginLeft: message.direction === 'outbound' ? '8%' : 0, marginRight: message.direction === 'inbound' ? '8%' : 0 }}
                    >
                      <div className="driver-load-row__meta">
                        <strong>{message.direction === 'outbound' ? 'You' : selected.counterpartName}</strong>
                        <span>{fmtDateTime(message.createdAt)}</span>
                        <StatusBadge value={message.direction === 'outbound' ? 'Sent' : 'Received'} tone={message.direction === 'outbound' ? 'blue' : 'green'} />
                      </div>
                      <div style={{ padding: '8px 10px', fontSize: '13px', lineHeight: '19px', color: '#0f172a', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                        {message.body}
                      </div>
                    </article>
                  ))}
                </div>

                {selected.canReply ? (
                  <div className="driver-detail-grid" style={{ marginTop: '6px' }}>
                    <label className="driver-filter-field" style={{ gridColumn: '1 / -1' }}>
                      Reply
                      <textarea
                        value={reply}
                        maxLength={4000}
                        rows={4}
                        onChange={(event) => setReply(event.target.value)}
                        placeholder={`Reply to ${selected.counterpartName}`}
                      />
                    </label>
                    <div className="driver-row-actions" style={{ gridColumn: '1 / -1' }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{reply.length}/4000 · messages cannot be edited after sending</span>
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
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
