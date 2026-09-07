'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
  arbitraryRecipientCreationAvailable?: boolean;
  contextPartial?: boolean;
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
  const router = useRouter();
  const pathname = usePathname();
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

      const response = await fetch('/api/workspace/messages', {
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

  const selectedJobHref = selected?.context?.jobId
    ? pathname.startsWith('/customer')
      ? `/customer/jobs/${selected.context.jobId}`
      : pathname.startsWith('/admin')
        ? `/admin/jobs/${selected.context.jobId}`
        : pathname.startsWith('/broker')
          ? `/broker/diary?jobId=${selected.context.jobId}`
          : null
    : null;

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
      {contextPartial && <AlertBanner tone="warning">Some message context could not be enriched. Participant-scoped message history remains available and no context is inferred.</AlertBanner>}
      {contextTargetMissing && <AlertBanner tone="warning">No verified conversation exists for the requested job, quote or member context. XDrive will not create an arbitrary recipient thread without a proven transport relationship.</AlertBanner>}

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
                  <span style={{ display: 'block', fontSize: 10, lineHeight: '14px', color: '#475569' }}>{thread.context ? `${thread.context.kind === 'quote' ? 'Quote' : 'Job'} · ${thread.context.loadRef}` : thread.counterpartCompanyName ?? 'Participant conversation'}</span>
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
            <div className="workspace-panel"><EmptyState compact title={contextTargetMissing ? 'No contextual conversation found' : 'Choose a conversation'} description={contextTargetMissing ? 'Start or continue messaging from a verified quote or existing transport relationship; arbitrary recipient creation stays disabled.' : undefined} /></div>
          ) : (
            <section className="workspace-panel" aria-label={`Conversation with ${selected.counterpartName}`}>
              <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}>
                <strong>{selected.counterpartName}{selected.counterpartCompanyName ? ` · ${selected.counterpartCompanyName}` : ''}</strong>
                <span>{selected.conversationId ? `Conversation ${selected.conversationId.slice(0, 8).toUpperCase()}` : 'Legacy message record'}</span>
              </div>
              {selected.context && (
                <div className="workspace-operational-row" data-state="context" style={{ marginTop: 8 }}>
                  <div className="workspace-record-meta" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <span><strong>{selected.context.kind === 'quote' ? 'Quote context' : 'Job context'} · {selected.context.loadRef}</strong></span>
                    <StatusBadge value={selected.context.jobStatus ?? selected.context.status ?? 'Context linked'} tone="blue" />
                    {selectedJobHref ? <ActionButton tone="secondary" onClick={() => router.push(selectedJobHref)}>Open job</ActionButton> : null}
                  </div>
                  <div style={{ paddingTop: 6, fontSize: 12, color: '#475569' }}>{selected.context.routeLabel}</div>
                </div>
              )}

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
