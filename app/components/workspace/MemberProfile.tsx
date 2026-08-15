'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, EmptyState, workspaceTheme } from './WorkspaceUI';

type SectionState = {
  state: 'unavailable' | 'restricted' | 'available';
  message: string;
};

type MemberProfileResponse = {
  member: {
    companyId: string | null;
    driverId?: string | null;
    name: string;
    memberId: string | null;
    businessPhone: string | null;
    memberType: string;
    memberSince: string | null;
    status: string;
    availability?: string | null;
    vehicleType?: string | null;
  };
  sections: {
    feedback: SectionState;
    users: SectionState;
    specialistServices: SectionState;
    charges: SectionState;
    bookingFooter: SectionState;
    businessDocuments: SectionState;
  };
};

type ProfileTab = 'details' | 'feedback' | 'users' | 'services' | 'charges' | 'booking' | 'documents';

const TABS: Array<{ id: ProfileTab; label: string }> = [
  { id: 'details', label: 'Member Details' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'users', label: 'Users' },
  { id: 'services', label: 'Specialist Services' },
  { id: 'charges', label: 'Charges' },
  { id: 'booking', label: 'Booking Footer' },
  { id: 'documents', label: 'Business Documents' },
];

function memberSince(value: string | null) {
  if (!value) return 'Not supplied';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not supplied'
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function human(value: string | null | undefined) {
  return value ? value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not supplied';
}

function SectionMessage({ section }: { section: SectionState }) {
  return (
    <div style={{ minHeight: 116, display: 'grid', alignContent: 'center' }}>
      <EmptyState
        compact
        title={section.state === 'restricted' ? 'Restricted' : section.state === 'unavailable' ? 'Not available' : 'No records'}
        description={section.message}
      />
    </div>
  );
}

export function MemberIdentityLink({
  companyId,
  driverId,
  children,
  title,
}: {
  companyId?: string | null;
  driverId?: string | null;
  children: ReactNode;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!companyId && !driverId) return <>{children}</>;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={title ?? 'Open member profile'}
        style={{
          border: 0,
          padding: 0,
          margin: 0,
          background: 'transparent',
          color: workspaceTheme.blue,
          font: 'inherit',
          fontWeight: 700,
          textDecoration: 'underline',
          textDecorationThickness: '1px',
          textUnderlineOffset: '2px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {children}
      </button>
      {open && <MemberProfileOverlay companyId={companyId} driverId={driverId} onClose={() => setOpen(false)} />}
    </>
  );
}

export function MemberProfileOverlay({
  companyId,
  driverId,
  onClose,
}: {
  companyId?: string | null;
  driverId?: string | null;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<MemberProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<ProfileTab>('details');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const endpoint = companyId
        ? `/api/member-profile/${encodeURIComponent(companyId)}`
        : driverId
          ? `/api/member-profile/driver/${encodeURIComponent(driverId)}`
          : null;
      if (!endpoint) throw new Error('Member identity is unavailable.');
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as MemberProfileResponse & { error?: string };
      if (!response.ok || !payload.member) throw new Error(payload.error || 'Member profile could not be loaded.');
      setProfile(payload);
    } catch (reason) {
      setProfile(null);
      setError(reason instanceof Error ? reason.message : 'Member profile could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [companyId, driverId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [onClose]);

  const activeSection = useMemo(() => {
    if (!profile || tab === 'details') return null;
    if (tab === 'feedback') return profile.sections.feedback;
    if (tab === 'users') return profile.sections.users;
    if (tab === 'services') return profile.sections.specialistServices;
    if (tab === 'charges') return profile.sections.charges;
    if (tab === 'booking') return profile.sections.bookingFooter;
    return profile.sections.businessDocuments;
  }, [profile, tab]);

  const companyNumberLabel = profile?.member.companyId ? 'Company number' : 'Member ID';
  const detailRows = profile ? [
    ['Member', profile.member.name],
    [companyNumberLabel, profile.member.memberId ?? 'Not supplied'],
    ['Type', profile.member.memberType],
    ['Business phone', profile.member.businessPhone ?? 'Not supplied'],
    ['Member since', memberSince(profile.member.memberSince)],
    ['Account status', human(profile.member.status)],
    ...(profile.member.driverId ? [['Availability', human(profile.member.availability)], ['Vehicle', human(profile.member.vehicleType)]] : []),
  ] : [];

  return (
    <div
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200, display: 'grid', placeItems: 'center', padding: 16,
        background: 'rgba(15, 23, 42, 0.48)',
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Member profile"
        style={{
          width: 'min(960px, calc(100vw - 32px))', maxHeight: 'min(690px, calc(100vh - 32px))', display: 'grid',
          gridTemplateRows: 'auto auto minmax(0, 1fr) auto', overflow: 'hidden', border: `1px solid ${workspaceTheme.borderStrong}`,
          borderRadius: 4, background: workspaceTheme.surface, boxShadow: '0 16px 48px rgba(15, 23, 42, 0.22)',
        }}
      >
        <header style={{ minHeight: 42, padding: '7px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottom: `1px solid ${workspaceTheme.border}`, background: '#f4f6f8' }}>
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: 'block', color: workspaceTheme.text, fontSize: 13, lineHeight: '18px' }}>
              {profile?.member.name ?? (loading ? 'Loading member…' : 'Member profile')}
              {profile?.member.memberId && profile.member.companyId ? ` — Company no. ${profile.member.memberId}` : ''}
            </strong>
            <span style={{ display: 'block', color: workspaceTheme.muted, fontSize: 11, lineHeight: '14px' }}>
              {profile ? `${profile.member.memberType} · Member since ${memberSince(profile.member.memberSince)}` : 'XDrive member information'}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close member profile" style={{ width: 28, height: 28, border: 0, borderRadius: 4, background: 'transparent', color: workspaceTheme.muted, cursor: 'pointer', fontSize: 18, lineHeight: '28px' }}>×</button>
        </header>

        <div role="tablist" aria-label="Member profile sections" style={{ display: 'flex', overflowX: 'auto', borderBottom: `1px solid ${workspaceTheme.border}`, background: '#fff' }}>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              style={{
                minHeight: 30, padding: '0 10px', flex: '0 0 auto', border: 0, borderRight: `1px solid ${workspaceTheme.border}`,
                borderBottom: tab === item.id ? `2px solid ${workspaceTheme.blue}` : '2px solid transparent',
                background: tab === item.id ? '#eff6ff' : '#fff', color: tab === item.id ? workspaceTheme.navy : workspaceTheme.text,
                fontSize: 11, fontWeight: tab === item.id ? 700 : 600, cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ minHeight: 0, overflowY: 'auto', padding: 10 }}>
          {loading ? (
            <EmptyState compact title="Loading member profile…" />
          ) : error ? (
            <div style={{ padding: 9, border: '1px solid #fecaca', borderRadius: 4, background: '#fef2f2', color: '#b91c1c', fontSize: 12 }}>{error}</div>
          ) : profile && tab === 'details' ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', border: `1px solid ${workspaceTheme.border}`, borderRadius: 4, overflow: 'hidden' }}>
                {detailRows.map(([label, value]) => (
                  <div key={label} style={{ minHeight: 50, padding: '7px 9px', borderRight: `1px solid ${workspaceTheme.divider}`, borderBottom: `1px solid ${workspaceTheme.divider}` }}>
                    <span style={{ display: 'block', color: workspaceTheme.muted, fontSize: 10, lineHeight: '13px', textTransform: 'uppercase', fontWeight: 700 }}>{label}</span>
                    <strong style={{ display: 'block', marginTop: 2, color: workspaceTheme.text, fontSize: 12, lineHeight: '16px', fontWeight: 650 }}>{value}</strong>
                  </div>
                ))}
              </div>
              <div style={{ padding: 8, border: `1px solid ${workspaceTheme.border}`, borderRadius: 4, background: '#f8fafc', color: workspaceTheme.muted, fontSize: 11, lineHeight: '15px' }}>
                This profile shows business-facing member information only. Private addresses, personal contact details and internal compliance evidence are not published here.
              </div>
            </div>
          ) : profile && activeSection ? (
            <SectionMessage section={activeSection} />
          ) : null}
        </div>

        <footer style={{ minHeight: 42, padding: '5px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTop: `1px solid ${workspaceTheme.border}`, background: '#f4f6f8' }}>
          <span style={{ color: workspaceTheme.muted, fontSize: 10 }}>Business-facing member information only.</span>
          <span style={{ display: 'flex', gap: 6 }}>
            {profile?.member.businessPhone && <ActionButton tone="secondary" onClick={() => { window.location.href = `tel:${profile.member.businessPhone}`; }}>Call member</ActionButton>}
            <ActionButton tone="secondary" onClick={onClose}>Close</ActionButton>
          </span>
        </footer>
      </section>
    </div>
  );
}
