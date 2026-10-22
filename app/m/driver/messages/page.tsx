'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { readRouteAuthAccessToken } from '../../../../lib/routeAuthCookie';

type InboxMessage = {
  id: string;
  title?: string | null;
  body?: string | null;
  type?: string | null;
  read_at?: string | null;
  created_at?: string | null;
};

export default function DriverMessagesPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [partial, setPartial] = useState(false);
  const [updatingId, setUpdatingId] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessages([]);
    setPartial(false);
    setError('');
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Sign in to read your driver messages.');
      const response = await fetch('/api/driver/web/resources', {
        cache: 'no-store', headers: { Authorization: 'Bearer ' + token },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.resources) throw new Error(result.error || 'Messages could not be loaded.');
      const incomplete = result.resources.partial?.includes('notifications') === true;
      setPartial(incomplete);
      setMessages(incomplete ? [] : result.resources.notifications || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Messages could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const markRead = async (id: string) => {
    if (updatingId) return;
    setUpdatingId(id);
    setError('');
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Your session expired. Sign in again.');
      const response = await fetch('/api/driver/web/resources', {
        method: 'POST', cache: 'no-store',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_notification_read', notificationId: id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) throw new Error(result.error || 'Message could not be marked as read.');
      setMessages(previous => previous.map(message =>
        message.id === id ? { ...message, read_at: new Date().toISOString() } : message));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Message could not be updated.');
    } finally {
      setUpdatingId('');
    }
  };

  return <section className="xd-mobile-list">
    <header>
      <Link className="xd-mobile-back" href="/m/driver/more">More</Link>
      <h1>Messages</h1>
      <p>Driver notifications and booking instructions from your account inbox.</p>
    </header>
    {loading ? <p role="status">Loading messages...</p> : null}
    {error ? <div className="xd-mobile-error" role="alert"><p>{error}</p>
      {!messages.length ? <button type="button" onClick={() => void refresh()}>Retry</button> : null}
    </div> : null}
    {partial ? <p className="xd-mobile-error" role="alert">Your inbox is temporarily unavailable. Messages may be missing.</p> : null}
    {!loading && !error && !partial && messages.length === 0 ? <p>No messages yet.</p> : null}
    {!loading && !partial && messages.map(message => <article className="xd-mobile-card" key={message.id}>
      <div className="xd-mobile-card__top">
        <strong>{message.title || 'Driver notification'}</strong>
        <span className="xd-mobile-pill">{message.read_at ? 'Read' : 'Unread'}</span>
      </div>
      {message.created_at ? <p className="xd-mobile-muted">
        {new Date(message.created_at).toLocaleString('en-GB')}
      </p> : null}
      <p className="xd-mobile-note">{message.body || 'No additional details provided.'}</p>
      {!message.read_at ? <div className="xd-mobile-actions">
        <button type="button" disabled={Boolean(updatingId)}
          onClick={() => void markRead(message.id)}>{updatingId === message.id ? 'Saving...' : 'Mark as read'}</button>
      </div> : null}
    </article>)}
  </section>;
}
