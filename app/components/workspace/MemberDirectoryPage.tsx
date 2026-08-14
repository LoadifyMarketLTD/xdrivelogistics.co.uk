'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { MemberIdentityLink } from './MemberProfile';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from './WorkspaceUI';

type DirectoryCompany = {
  companyId: string;
  name: string;
  memberId: string | null;
  businessPhone: string | null;
  memberType: string;
  memberSince: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
};

type DirectoryDriver = {
  driverId: string;
  displayName: string;
  companyId: string | null;
  companyName: string;
  memberId: string | null;
  memberType: string;
  businessPhone: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  availability: string | null;
  vehicleType: string | null;
};

type DirectoryResponse = {
  companies?: DirectoryCompany[];
  drivers?: DirectoryDriver[];
  partial?: boolean;
  privacy?: string;
  error?: string;
};

const normalise = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

export function MemberDirectoryPage({
  title = 'Directory',
  eyebrow = 'XDrive member network',
}: {
  title?: string;
  eyebrow?: string;
}) {
  const [companies, setCompanies] = useState<DirectoryCompany[]>([]);
  const [drivers, setDrivers] = useState<DirectoryDriver[]>([]);
  const [tab, setTab] = useState<'companies' | 'drivers'>('companies');
  const [member, setMember] = useState('');
  const [location, setLocation] = useState('');
  const [memberType, setMemberType] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [availability, setAvailability] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [partial, setPartial] = useState(false);
  const [privacy, setPrivacy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch('/api/directory', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as DirectoryResponse;
      if (!response.ok) throw new Error(payload.error || 'Directory could not be loaded.');
      setCompanies(payload.companies ?? []);
      setDrivers(payload.drivers ?? []);
      setPartial(payload.partial === true);
      setPrivacy(payload.privacy ?? '');
    } catch (reason) {
      setCompanies([]);
      setDrivers([]);
      setError(reason instanceof Error ? reason.message : 'Directory could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleCompanies = useMemo(() => {
    const memberNeedle = normalise(member);
    const locationNeedle = normalise(location);
    const typeNeedle = normalise(memberType);
    return companies.filter((company) => {
      const memberText = normalise(`${company.name} ${company.memberId ?? ''}`);
      const locationText = normalise(`${company.city ?? ''} ${company.postcode ?? ''} ${company.country ?? ''}`);
      return (!memberNeedle || memberText.includes(memberNeedle))
        && (!locationNeedle || locationText.includes(locationNeedle))
        && (!typeNeedle || normalise(company.memberType).includes(typeNeedle));
    });
  }, [companies, location, member, memberType]);

  const visibleDrivers = useMemo(() => {
    const memberNeedle = normalise(member);
    const locationNeedle = normalise(location);
    const vehicleNeedle = normalise(vehicle);
    const availabilityNeedle = normalise(availability);
    return drivers.filter((driver) => {
      const memberText = normalise(`${driver.displayName} ${driver.companyName} ${driver.memberId ?? ''}`);
      const locationText = normalise(`${driver.city ?? ''} ${driver.postcode ?? ''} ${driver.country ?? ''}`);
      return (!memberNeedle || memberText.includes(memberNeedle))
        && (!locationNeedle || locationText.includes(locationNeedle))
        && (!vehicleNeedle || normalise(driver.vehicleType).includes(vehicleNeedle))
        && (!availabilityNeedle || normalise(driver.availability) === availabilityNeedle);
    });
  }, [availability, drivers, location, member, vehicle]);

  const clear = () => {
    setMember('');
    setLocation('');
    setMemberType('');
    setVehicle('');
    setAvailability('');
  };

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}>
        <span><strong>{eyebrow}</strong> · {title}</span>
        <ActionButton tone="secondary" onClick={() => void load()}>Refresh</ActionButton>
      </div>
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {partial && <AlertBanner tone="warning">Part of the Directory enrichment is temporarily unavailable. Verified member records are still shown.</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Directory filters">
          <div className="workspace-filter-rail__header">Search Directory</div>
          <div className="workspace-filter-rail__body">
            <label>MEMBER NAME / ID<input value={member} onChange={(event) => setMember(event.target.value)} placeholder="Company, driver or member ID" /></label>
            <label>LOCATION<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Town / postcode / country" /></label>
            {tab === 'companies' ? (
              <label>MEMBER TYPE<input value={memberType} onChange={(event) => setMemberType(event.target.value)} placeholder="Carrier, broker, customer…" /></label>
            ) : (
              <>
                <label>VEHICLE TYPE<input value={vehicle} onChange={(event) => setVehicle(event.target.value)} placeholder="LWB, Luton, Artic…" /></label>
                <label>AVAILABILITY<select value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="">Any availability</option><option value="available">Available</option><option value="busy">Busy</option><option value="offline">Offline</option></select></label>
              </>
            )}
            <ActionButton tone="secondary" onClick={clear}>Clear</ActionButton>
            {privacy && <span style={{ color: '#64748b', fontSize: 10, lineHeight: '13px' }}>{privacy}</span>}
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="workspace-tab-strip" role="tablist" aria-label="Directory member types" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>
            <button type="button" data-active={tab === 'companies' ? 'true' : 'false'} onClick={() => setTab('companies')}>Companies {visibleCompanies.length}</button>
            <button type="button" data-active={tab === 'drivers' ? 'true' : 'false'} onClick={() => setTab('drivers')}>Drivers {visibleDrivers.length}</button>
          </div>
          <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}><span><strong>{tab === 'companies' ? visibleCompanies.length : visibleDrivers.length}</strong> matching member record(s)</span><span>Click a company identity for Member Profile</span></div>

          {loading ? (
            <div className="workspace-panel"><EmptyState compact title="Loading Directory…" /></div>
          ) : tab === 'companies' ? (
            <div className="workspace-record-list">
              {visibleCompanies.map((company) => (
                <article key={company.companyId} className="workspace-operational-row">
                  <div className="workspace-operational-row__top">
                    <div className="workspace-operational-cell"><div className="driver-cell-label">MEMBER</div><strong><MemberIdentityLink companyId={company.companyId}>{company.name}</MemberIdentityLink></strong><div className="driver-cell-secondary">{company.memberId ?? 'Member ID not supplied'}</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">LOCATION</div><strong>{[company.city, company.postcode].filter(Boolean).join(', ') || 'Not supplied'}</strong><div className="driver-cell-secondary">{company.country ?? 'Country not supplied'}</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">TYPE</div><strong>{company.memberType}</strong><div className="driver-cell-secondary">Business phone {company.businessPhone ?? 'not supplied'}</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">ACTION</div><ActionButton tone="secondary" onClick={() => { if (company.businessPhone) window.location.href = `tel:${company.businessPhone}`; }} disabled={!company.businessPhone}>Call member</ActionButton></div>
                  </div>
                </article>
              ))}
              {visibleCompanies.length === 0 && <div className="workspace-panel"><EmptyState title="No companies match these filters" /></div>}
            </div>
          ) : (
            <div className="workspace-record-list">
              {visibleDrivers.map((driver) => (
                <article key={driver.driverId} className="workspace-operational-row">
                  <div className="workspace-operational-row__top">
                    <div className="workspace-operational-cell"><div className="driver-cell-label">DRIVER / MEMBER</div><strong>{driver.displayName}</strong><div className="driver-cell-secondary">{driver.companyId ? <MemberIdentityLink companyId={driver.companyId}>{driver.companyName}</MemberIdentityLink> : driver.companyName}{driver.memberId ? ` · ${driver.memberId}` : ''}</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">LOCATION</div><strong>{[driver.city, driver.postcode].filter(Boolean).join(', ') || 'Not supplied'}</strong><div className="driver-cell-secondary">Broad member/company location only</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">VEHICLE</div><strong>{driver.vehicleType?.replace(/_/g, ' ') ?? 'Not supplied'}</strong><div className="driver-cell-secondary">No live coordinates exposed</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">AVAILABILITY</div><StatusBadge value={driver.availability ?? 'Not supplied'} tone={normalise(driver.availability) === 'available' ? 'green' : undefined} /></div>
                  </div>
                </article>
              ))}
              {visibleDrivers.length === 0 && <div className="workspace-panel"><EmptyState title="No drivers match these filters" /></div>}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
