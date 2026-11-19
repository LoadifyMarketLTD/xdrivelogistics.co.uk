'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ApprovedMessagesBoard from '../../components/workspace/ApprovedMessagesBoard';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import DriverIntegratedNav from '../_components/DriverIntegratedNav';
import { isSupabaseConfigured } from '../../../lib/supabaseClient';
import { readRouteAuthAccessToken } from '../../../lib/routeAuthCookie';
import { useAuth } from '../../components/AuthContext';
import { resolveWorkspaceRole } from '../../../lib/workspaceRole';
import '../xdrive-owner-actions-messages.css';
import { AlertBanner } from '../../components/workspace/WorkspaceUI';

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
  counterpartCategory?: 'customer' | 'driver' | 'company' | null;
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

export default function DriverMessagesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isOwnerDriver = resolveWorkspaceRole(user) === 'owner_driver';
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
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');

      const response = await fetch('/api/driver/messages', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store', signal: AbortSignal.timeout(15000),
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
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');

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
      <DriverWorkspaceShell hideHeader>
        {!isOwnerDriver && <DriverIntegratedNav label="Action Centre tools" items={[{ href: '/driver/action-centre', label: 'Actions' }, { href: '/driver/messages', label: 'Messages' }]} />}
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        {sendError && <AlertBanner tone="danger">{sendError}</AlertBanner>}
        {contextPartial && <AlertBanner tone="warning">Some message context could not be enriched. Participant message history remains available without inferred context.</AlertBanner>}
        {contextTargetMissing && <AlertBanner tone="warning">No verified conversation exists for the requested job, quote or member context. XDrive will not create an arbitrary recipient thread.</AlertBanner>}

        <div className="driver-messages-board">
          <ApprovedMessagesBoard threads={threads} selected={selected} loading={loading} error={error} reply={reply} sending={sending} selectedJobHref={selectedJobHref} onSelect={key=>{setSelectedKey(key);setReply('');setSendError('')}} onReply={setReply} onSend={()=>void sendReply()} onRefresh={()=>void loadMessages()} onJob={()=>{if(selectedJobHref)router.push(selectedJobHref)}} legacyLabel="Legacy message record" immutableLabel="messages cannot be edited after sending" scopeLabel="Participant scoped" sendLabel="Send Reply" readStateLabel="no fabricated read-state" missingContext={contextTargetMissing} openJobLabel="Open job" missingContextLabel="arbitrary recipient creation stays disabled"/>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
