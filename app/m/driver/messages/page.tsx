'use client';
import { useCallback, useEffect, useState } from 'react';
import { readRouteAuthAccessToken } from '../../../../lib/routeAuthCookie';
type Message = { id: string; body: string; direction: string; createdAt: string | null };
type Thread = { key: string; conversationId: string | null; counterpartName: string; canReply: boolean; latestBody: string; messages: Message[] };
export default function MobileMessagesPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const refresh = useCallback(async () => {
    const token = readRouteAuthAccessToken();
    if (!token) { setError('Sign in required'); setLoading(false); return; }
    try {
      const response = await fetch('/api/driver/messages', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Messages unavailable');
      setThreads(data.threads ?? []); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Messages unavailable'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const current = threads.find(thread => thread.key === selected);
  async function send() {
    const token = readRouteAuthAccessToken();
    if (!token || !current?.canReply || !current.conversationId || !reply.trim()) return;
    setSending(true); setError('');
    try {
      const response = await fetch('/api/driver/messages', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: current.conversationId, body: reply.trim() }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Message not sent');
      setReply(''); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Message not sent'); }
    finally { setSending(false); }
  }
  return <section className="xd-mobile-list"><header><h1>Messages</h1><p>Driver conversations</p></header>
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">Loading messages...</p>}
    {!loading && !current && threads.map(thread => <article className="xd-mobile-card" key={thread.key}><button type="button" onClick={() => setSelected(thread.key)}>{thread.counterpartName}</button><p>{thread.latestBody}</p></article>)}
    {!loading && threads.length === 0 && !error && <p>No conversations yet.</p>}
    {current && <article className="xd-mobile-card"><button type="button" onClick={() => setSelected(null)}>Back to conversations</button><h2>{current.counterpartName}</h2>
      {current.messages.map(message => <p key={message.id}><strong>{message.direction === 'outbound' ? 'You' : 'Them'}:</strong> {message.body}</p>)}
      {current.canReply && <><label>Reply<textarea maxLength={4000} value={reply} onChange={event => setReply(event.target.value)}/></label><button type="button" disabled={sending || !reply.trim()} onClick={() => void send()}>{sending ? 'Sending...' : 'Send'}</button></>}
    </article>}
  </section>;
}
