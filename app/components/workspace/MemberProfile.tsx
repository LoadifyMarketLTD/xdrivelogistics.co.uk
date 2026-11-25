'use client';
import { readRouteAuthAccessToken } from '../../../lib/routeAuthCookie';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import OwnerMemberProfile from './OwnerMemberProfile';
import { ActionButton, EmptyState, WorkspaceDialog, workspaceTheme } from './WorkspaceUI';

type SectionState = {
  state: 'unavailable' | 'restricted' | 'available';
  message: string;
  items?: string[];
};

export type DirectoryEvidence = { delivery:{score:number|null;evidenceCount:number;completedJobs:number}; payment:{score:number|null;evidenceCount:number;onTimePaid:number;latePaid:number;overdueOpen:number} };

export type MemberProfileResponse = {
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
    companyNumber?: string|null;
    vatNumber?: string|null;
    phone2?: string|null;
    contactName?: string|null;
    email?: string|null;
    email2?: string|null;
    website?: string|null;
    fleet?: string|null;
    operatorLicence?: string|null;
    paymentTerms?: string|null;
    billingAddress?: {line1?:string|null;line2?:string|null;town?:string|null;postcode?:string|null};
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

export type ProfileTab = 'details' | 'feedback' | 'users' | 'services' | 'charges' | 'booking' | 'documents' | 'payment' | 'complaints';

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
  if (section.state === 'available' && section.items?.length) {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ padding: '7px 9px', border: `1px solid ${workspaceTheme.border}`, borderRadius: 4, background: '#f8fafc', color: workspaceTheme.muted, fontSize: 11 }}>{section.message}</div>
        <div style={{ display: 'grid', gap: 5 }}>
          {section.items.map((item, index) => <div key={`${item}-${index}`} style={{ minHeight: 34, padding: '7px 9px', border: `1px solid ${workspaceTheme.border}`, borderRadius: 4, background: '#fff', color: workspaceTheme.text, fontSize: 12, lineHeight: '17px' }}>{item}</div>)}
        </div>
      </div>
    );
  }
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
  ownerDirectoryEvidence,
}: {
  companyId?: string | null;
  driverId?: string | null;
  children: ReactNode;
  title?: string;
  ownerDirectoryEvidence?: DirectoryEvidence;
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
      {open && <MemberProfileOverlay companyId={companyId} driverId={driverId} ownerDirectoryEvidence={ownerDirectoryEvidence} onClose={() => setOpen(false)} />}
    </>
  );
}

export function MemberProfileOverlay({
  companyId,
  driverId,
  ownerDirectoryEvidence,
  onClose,
}: {
  companyId?: string | null;
  driverId?: string | null;
  onClose: () => void;
  ownerDirectoryEvidence?: DirectoryEvidence;
}) {
  const [profile, setProfile] = useState<MemberProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<ProfileTab>('details');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const endpoint = companyId
        ? `/api/member-profile/${encodeURIComponent(companyId)}`
        : driverId
          ? `/api/member-profile/driver/${encodeURIComponent(driverId)}`
          : null;
      if (!endpoint) throw new Error('Member identity is unavailable.');
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store', signal: AbortSignal.timeout(12000),
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
    if(ownerDirectoryEvidence)return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [onClose,ownerDirectoryEvidence]);

  const activeSection = useMemo(() => {
    if (!profile || tab === 'details') return null;
    if (tab === 'feedback') return profile.sections.feedback;
    if (tab === 'payment' || tab === 'complaints') return null;
    if (tab === 'users') return profile.sections.users;
    if (tab === 'services') return profile.sections.specialistServices;
    if (tab === 'charges') return profile.sections.charges;
    if (tab === 'booking') return profile.sections.bookingFooter;
    return profile.sections.businessDocuments;
  }, [profile, tab]);

  const memberIdLabel = 'Member ID';
  const detailRows = profile ? [
    ['Member', profile.member.name],
    [memberIdLabel, profile.member.memberId ?? 'Not supplied'],
    ['Type', profile.member.memberType],
    ['Business phone', profile.member.businessPhone ?? 'Not supplied'],
    ['Member since', memberSince(profile.member.memberSince)],
    ['Account status', human(profile.member.status)],
    ...(ownerDirectoryEvidence && !profile.member.driverId ? [
      ['Company number',profile.member.companyNumber??'Not supplied'],['VAT number',profile.member.vatNumber??'Not supplied'],
      ['Business contact',profile.member.contactName??'Not published'],['Secondary phone',profile.member.phone2??'Not supplied'],
      ['Business email',profile.member.email??'Not published'],['Finance email',profile.member.email2??'Not published'],
      ['Website',profile.member.website??'Not published'],['Payment terms',profile.member.paymentTerms??'Not supplied'],
      ['Fleet',profile.member.fleet??'Not supplied'],['Operator licence',profile.member.operatorLicence??'Not supplied'],
      ['Business billing address',Object.values(profile.member.billingAddress??{}).filter(Boolean).join(', ')||'Not supplied']
    ] : []),
    ...(profile.member.driverId ? [['Availability', human(profile.member.availability)], ['Vehicle', human(profile.member.vehicleType)]] : []),
  ] : [];

  const _legacyDialog = (
    <WorkspaceDialog
      ariaLabel="Member profile"
      title={`${profile?.member.name ?? (loading ? 'Loading member…' : 'Member profile')}${profile?.member.memberId && profile.member.companyId ? ` — Member ID ${profile.member.memberId}` : ''}`}
      description={profile ? `${profile.member.memberType} · Member since ${memberSince(profile.member.memberSince)}` : 'XDrive member information'}
      width={960}
      maxHeight={690}
      onDismiss={onClose}
      headerActions={<button type="button" onClick={onClose} aria-label="Close member profile" style={{ width: 28, height: 28, border: 0, borderRadius: 4, background: 'transparent', color: workspaceTheme.muted, cursor: 'pointer', fontSize: 18, lineHeight: '28px' }}>×</button>}
      subheader={
        <div role="tablist" aria-label="Member profile sections" className="workspace-tab-strip" style={{ display: 'flex', overflowX: 'auto', margin: 0 }}>
          {(ownerDirectoryEvidence ? TABS.flatMap(item=>item.id==='feedback'?[{id:'feedback' as ProfileTab,label:'Delivery Feedback'},{id:'payment' as ProfileTab,label:'Payment Evidence'},{id:'complaints' as ProfileTab,label:'Complaints'}]:[item]) : TABS).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              data-active={tab === item.id ? 'true' : 'false'}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      }
      footerLeading="Business-facing member information only."
      actions={<>{profile?.member.businessPhone && <ActionButton tone="secondary" onClick={() => { window.location.href = `tel:${profile.member.businessPhone}`; }}>Call member</ActionButton>}<ActionButton tone="secondary" onClick={onClose}>Close</ActionButton></>}
    >
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
          ) : profile && ownerDirectoryEvidence && tab==='payment' ? (
            <SectionMessage section={{state:'available',message:'Payment reliability is derived from recorded invoice due dates and settlements. This is not a subjective payment-feedback rating.',items:[ownerDirectoryEvidence.payment.score==null?'Not enough evidence for a reliability score':'Payment reliability: '+ownerDirectoryEvidence.payment.score+'%', 'Evidence records: '+ownerDirectoryEvidence.payment.evidenceCount,'Paid on time: '+ownerDirectoryEvidence.payment.onTimePaid,'Paid late: '+ownerDirectoryEvidence.payment.latePaid,'Overdue open: '+ownerDirectoryEvidence.payment.overdueOpen]}}/>
          ) : profile && ownerDirectoryEvidence && tab==='complaints' ? (
            <EmptyState compact title="Complaint records not available" description="No authorised member-facing complaint register is connected. This does not mean that no complaints exist."/>
          ) : profile && activeSection ? (
            <div style={{display:'grid',gap:10}}>{ownerDirectoryEvidence&&tab==='feedback'&&<SectionMessage section={{state:'available',message:'Delivery reliability is separate from written job feedback.',items:[ownerDirectoryEvidence.delivery.score==null?'Not enough evidence for a reliability score':'Delivery reliability: '+ownerDirectoryEvidence.delivery.score+'%', 'Timed delivery evidence: '+ownerDirectoryEvidence.delivery.evidenceCount,'Completed jobs in evidence: '+ownerDirectoryEvidence.delivery.completedJobs]}}/>}<SectionMessage section={activeSection} /></div>
          ) : null}
    </WorkspaceDialog>
  );
  return <OwnerMemberProfile profile={profile} evidence={ownerDirectoryEvidence} loading={loading} error={error} tab={tab} onTab={setTab} onRetry={()=>void load()} onClose={onClose}/>;
}
