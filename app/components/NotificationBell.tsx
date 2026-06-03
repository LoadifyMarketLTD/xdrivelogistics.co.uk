'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import { resolveActiveCompanyId } from '../../lib/activeCompany';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

type NotificationEventRow = {
  id: string;
  event_type: 'job_assigned' | 'bid_accepted' | 'pod_uploaded' | string;
  entity_id: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'sent' | 'failed' | 'skipped' | string;
  created_at: string;
  processed_at: string | null;
};

const SUPPORTED_EVENT_TYPES = ['job_assigned', 'bid_accepted', 'pod_uploaded'];

const formatRelativeTime = (iso: string) => {
  const timestamp = new Date(iso).getTime();
  const deltaMs = Date.now() - timestamp;
  const deltaMinutes = Math.max(1, Math.floor(deltaMs / 60_000));

  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours}h ago`;

  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays}d ago`;
};

const getNotificationTitle = (event: NotificationEventRow) => {
  switch (event.event_type) {
    case 'job_assigned':
      return 'Job assigned';
    case 'bid_accepted':
      return 'Bid accepted';
    case 'pod_uploaded':
      return 'POD uploaded';
    default:
      return 'Notification';
  }
};

const getNotificationSummary = (event: NotificationEventRow) => {
  const pickup = typeof event.payload.pickup_location === 'string' ? event.payload.pickup_location : null;
  const delivery = typeof event.payload.delivery_location === 'string' ? event.payload.delivery_location : null;

  switch (event.event_type) {
    case 'job_assigned':
      return `${pickup ?? 'TBC'} → ${delivery ?? 'TBC'}`;
    case 'bid_accepted': {
      const bidAmount =
        typeof event.payload.bid_price_gbp === 'number'
          ? event.payload.bid_price_gbp
          : typeof event.payload.amount === 'number'
            ? event.payload.amount
            : typeof event.payload.bid_amount === 'number'
              ? event.payload.bid_amount
              : null;
      return bidAmount == null ? 'A carrier bid has been accepted.' : `Accepted amount: £${bidAmount.toFixed(2)}`;
    }
    case 'pod_uploaded':
      return `${pickup ?? 'Pickup'} → ${delivery ?? 'Delivery'} marked delivered.`;
    default:
      return 'Open notification details.';
  }
};

const getNotificationHref = (event: NotificationEventRow) => {
  const jobId = typeof event.payload.job_id === 'string' ? event.payload.job_id : null;
  if ((event.event_type === 'job_assigned' || event.event_type === 'pod_uploaded') && jobId) {
    return `/admin/jobs/${jobId}`;
  }
  if (event.event_type === 'bid_accepted') {
    return '/admin/bids';
  }
  return '/admin';
};

const getStatusColor = (status: string) => {
  if (status === 'failed') return '#dc2626';
  if (status === 'pending') return '#d97706';
  if (status === 'skipped') return '#6b7280';
  return '#16a34a';
};

export default function NotificationBell() {
  const router = useRouter();
  const { user, hasSupabaseSession } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [events, setEvents] = useState<NotificationEventRow[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const resolveCompany = async () => {
      if (!hasSupabaseSession || !user?.id) {
        if (!cancelled) setCompanyId(null);
        return;
      }

      if (user.companyId) {
        if (!cancelled) setCompanyId(user.companyId);
        return;
      }

      const resolvedCompanyId = await resolveActiveCompanyId({
        userId: user.id,
        fallbackCompanyId: null,
      });

      if (!cancelled) setCompanyId(resolvedCompanyId);
    };

    void resolveCompany();

    return () => {
      cancelled = true;
    };
  }, [hasSupabaseSession, user?.companyId, user?.id]);

  const storageKey = useMemo(
    () => (user?.id && companyId ? `xdrive:notification-last-seen:${user.id}:${companyId}` : null),
    [companyId, user?.id]
  );

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') {
      setLastSeenAt(null);
      return;
    }
    setLastSeenAt(window.localStorage.getItem(storageKey));
  }, [storageKey]);

  const fetchNotifications = useCallback(async () => {
    if (!isSupabaseConfigured || !companyId) {
      setEvents([]);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from('notification_events')
      .select('id, event_type, entity_id, payload, status, created_at, processed_at')
      .eq('company_id', companyId)
      .in('event_type', SUPPORTED_EVENT_TYPES)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Failed to load notifications:', error.message);
      setEvents([]);
      setIsLoading(false);
      return;
    }

    setEvents((data ?? []) as NotificationEventRow[]);
    setIsLoading(false);
  }, [companyId]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!isSupabaseConfigured || !companyId) return;

    const channel = supabase
      .channel(`notification-events-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_events',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          void fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId, fetchNotifications]);

  useEffect(() => {
    if (!isOpen || !storageKey || typeof window === 'undefined') return;

    const latestSeenValue = events[0]?.created_at ?? new Date().toISOString();
    window.localStorage.setItem(storageKey, latestSeenValue);
    setLastSeenAt(latestSeenValue);
  }, [events, isOpen, storageKey]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = useMemo(() => {
    if (!lastSeenAt) return events.length;
    const threshold = new Date(lastSeenAt).getTime();
    return events.filter((event) => new Date(event.created_at).getTime() > threshold).length;
  }, [events, lastSeenAt]);

  if (!hasSupabaseSession || !user) return null;

  return (
    <div
      ref={rootRef}
      style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 1100,
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open notifications"
        style={{
          position: 'relative',
          width: '3rem',
          height: '3rem',
          borderRadius: '999px',
          border: '1px solid rgba(15, 23, 42, 0.12)',
          background: 'rgba(255, 255, 255, 0.95)',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.15)',
          cursor: 'pointer',
          fontSize: '1.2rem',
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-0.15rem',
              right: '-0.15rem',
              minWidth: '1.2rem',
              height: '1.2rem',
              padding: '0 0.25rem',
              borderRadius: '999px',
              background: '#dc2626',
              color: '#fff',
              fontSize: '0.72rem',
              fontWeight: 700,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            marginTop: '0.75rem',
            width: 'min(92vw, 360px)',
            maxHeight: '70vh',
            overflowY: 'auto',
            background: '#fff',
            borderRadius: '14px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
          }}
        >
          <div
            style={{
              padding: '1rem',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>Notifications</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>job_assigned, bid_accepted, pod_uploaded</div>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 600 }}>
              {unreadCount} unread
            </span>
          </div>

          {isLoading ? (
            <div style={{ padding: '1rem', color: '#6b7280' }}>Loading notifications…</div>
          ) : events.length === 0 ? (
            <div style={{ padding: '1rem', color: '#6b7280' }}>No notification events yet.</div>
          ) : (
            <div style={{ display: 'grid' }}>
              {events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    router.push(getNotificationHref(event));
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '0.9rem 1rem',
                    border: 'none',
                    borderBottom: '1px solid #f1f5f9',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{getNotificationTitle(event)}</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{formatRelativeTime(event.created_at)}</span>
                  </div>
                  <div style={{ marginTop: '0.25rem', color: '#475569', fontSize: '0.84rem', lineHeight: 1.45 }}>
                    {getNotificationSummary(event)}
                  </div>
                  <div style={{ marginTop: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {new Date(event.created_at).toLocaleString('en-GB')}
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: getStatusColor(event.status) }}>
                      {event.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
