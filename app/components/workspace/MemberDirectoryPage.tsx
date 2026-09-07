'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { MemberIdentityLink } from './MemberProfile';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from './WorkspaceUI';

type DeliveryReliability = { score: number | null; evidenceCount: number; completedJobs: number };
type PaymentReliability = { score: number | null; evidenceCount: number; onTimePaid: number; latePaid: number; overdueOpen: number };

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
  vehicleTypes: string[];
  specialistServices: string[];
  maxPallets: number | null;
  deliveryReliability: DeliveryReliability;
  paymentReliability: PaymentReliability;
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
  hasTailLift: boolean;
  palletsCapacity: number | null;
  specialistServices: string[];
  deliveryReliability: DeliveryReliability;
  paymentReliability: PaymentReliability;
};

type DirectoryTruncation = {
  companies?: boolean;
  drivers?: boolean;
  vehicleEnrichment?: boolean;
  reputation?: boolean;
  limits?: { companies?: number; drivers?: number; vehicles?: number; reputationJobs?: number; reputationInvoices?: number };
};

type DirectoryResponse = {
  companies?: DirectoryCompany[];
  drivers?: DirectoryDriver[];
  partial?: boolean;
  truncation?: DirectoryTruncation;
  privacy?: string;
  reputation?: string;
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
  const router = useRouter();
  const pathname = usePathname();
  const [companies, setCompanies] = useState<DirectoryCompany[]>([]);
  const [drivers, setDrivers] = useState<DirectoryDriver[]>([]);
  const [tab, setTab] = useState<'companies' | 'drivers'>('companies');
  const [member, setMember] = useState('');
  const [location, setLocation] = useState('');
  const [memberType, setMemberType] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [availability, setAvailability] = useState('');
  const [country, setCountry] = useState('');
  const [specialistService, setSpecialistService] = useState('');
  const [tailLiftOnly, setTailLiftOnly] = useState(false);
  const [deliveryMin, setDeliveryMin] = useState('');
  const [paymentMin, setPaymentMin] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [partial, setPartial] = useState(false);
  const [truncation, setTruncation] = useState<DirectoryTruncation>({});
  const [privacy, setPrivacy] = useState('');
  const [reputationNote, setReputationNote] = useState('');

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
      setTruncation(payload.truncation ?? {});
      setPrivacy(payload.privacy ?? '');
      setReputationNote(payload.reputation ?? '');
    } catch (reason) {
      setCompanies([]);
      setDrivers([]);
      setPartial(false);
      setTruncation({});
      setError(reason instanceof Error ? reason.message : 'Directory could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const countries = useMemo(() => Array.from(new Set(
    companies.concat(drivers.map((driver) => ({ country: driver.country } as DirectoryCompany)))
      .map((record) => record.country)
      .filter((value): value is string => Boolean(value?.trim())),
  )).sort(), [companies, drivers]);

  const specialistServices = useMemo(() => Array.from(new Set([
    ...companies.flatMap((company) => company.specialistServices ?? []),
    ...drivers.flatMap((driver) => driver.specialistServices ?? []),
  ])).sort(), [companies, drivers]);

  const directBookingRoute = pathname.startsWith('/broker')
    ? '/broker/post-load'
    : pathname.startsWith('/customer')
      ? '/customer/post-load'
      : null;
  const messagesRoute = pathname.startsWith('/broker')
    ? '/broker/messages'
    : pathname.startsWith('/customer')
      ? '/customer/messages'
      : pathname.startsWith('/driver')
        ? '/driver/messages'
        : pathname.startsWith('/admin')
          ? '/admin/messages'
          : null;
  const canBookCompany = (company: DirectoryCompany | null | undefined) => Boolean(
    directBookingRoute
    && company
    && ['carrier / fleet', 'owner driver'].includes(normalise(company.memberType)),
  );
  const openDirectBooking = (companyId: string) => {
    if (!directBookingRoute) return;
    router.push(`${directBookingRoute}?directCarrier=${encodeURIComponent(companyId)}`);
  };
  const openMemberMessages = (companyId: string) => {
    if (!messagesRoute) return;
    router.push(`${messagesRoute}?companyId=${encodeURIComponent(companyId)}`);
  };

  const visibleCompanies = useMemo(() => {
    const memberNeedle = normalise(member);
    const locationNeedle = normalise(location);
    const typeNeedle = normalise(memberType);
    const vehicleNeedle = normalise(vehicle);
    const countryNeedle = normalise(country);
    const serviceNeedle = normalise(specialistService);
    const deliveryThreshold = Number(deliveryMin || 0);
    const paymentThreshold = Number(paymentMin || 0);
    return companies.filter((company) => {
      const memberText = normalise(`${company.name} ${company.memberId ?? ''}`);
      const locationText = normalise(`${company.city ?? ''} ${company.postcode ?? ''} ${company.country ?? ''}`);
      const vehicleText = normalise((company.vehicleTypes ?? []).join(' '));
      const serviceText = normalise((company.specialistServices ?? []).join(' '));
      return (!memberNeedle || memberText.includes(memberNeedle))
        && (!locationNeedle || locationText.includes(locationNeedle))
        && (!typeNeedle || normalise(company.memberType).includes(typeNeedle))
        && (!countryNeedle || normalise(company.country) === countryNeedle)
        && (!vehicleNeedle || vehicleText.includes(vehicleNeedle))
        && (!serviceNeedle || serviceText.includes(serviceNeedle))
        && (!tailLiftOnly || serviceText.includes('tail lift'))
        && (!deliveryThreshold || (company.deliveryReliability.score != null && company.deliveryReliability.score >= deliveryThreshold))
        && (!paymentThreshold || (company.paymentReliability.score != null && company.paymentReliability.score >= paymentThreshold));
    });
  }, [companies, country, deliveryMin, location, member, memberType, paymentMin, specialistService, tailLiftOnly, vehicle]);

  const visibleDrivers = useMemo(() => {
    const memberNeedle = normalise(member);
    const locationNeedle = normalise(location);
    const vehicleNeedle = normalise(vehicle);
    const availabilityNeedle = normalise(availability);
    const countryNeedle = normalise(country);
    const serviceNeedle = normalise(specialistService);
    const deliveryThreshold = Number(deliveryMin || 0);
    const paymentThreshold = Number(paymentMin || 0);
    return drivers.filter((driver) => {
      const memberText = normalise(`${driver.displayName} ${driver.companyName} ${driver.memberId ?? ''}`);
      const locationText = normalise(`${driver.city ?? ''} ${driver.postcode ?? ''} ${driver.country ?? ''}`);
      const serviceText = normalise((driver.specialistServices ?? []).join(' '));
      return (!memberNeedle || memberText.includes(memberNeedle))
        && (!locationNeedle || locationText.includes(locationNeedle))
        && (!countryNeedle || normalise(driver.country) === countryNeedle)
        && (!vehicleNeedle || normalise(driver.vehicleType).includes(vehicleNeedle))
        && (!availabilityNeedle || normalise(driver.availability) === availabilityNeedle)
        && (!serviceNeedle || serviceText.includes(serviceNeedle))
        && (!tailLiftOnly || driver.hasTailLift === true)
        && (!deliveryThreshold || (driver.deliveryReliability.score != null && driver.deliveryReliability.score >= deliveryThreshold))
        && (!paymentThreshold || (driver.paymentReliability.score != null && driver.paymentReliability.score >= paymentThreshold));
    });
  }, [availability, country, deliveryMin, drivers, location, member, paymentMin, specialistService, tailLiftOnly, vehicle]);

  const clear = () => {
    setMember('');
    setLocation('');
    setMemberType('');
    setVehicle('');
    setAvailability('');
    setCountry('');
    setSpecialistService('');
    setTailLiftOnly(false);
    setDeliveryMin('');
    setPaymentMin('');
  };

  const capped = Boolean(truncation.companies || truncation.drivers || truncation.vehicleEnrichment || truncation.reputation);
  const capMessage = capped
    ? `Directory results may be incomplete because the current endpoint is capped at ${truncation.limits?.companies ?? 500} companies and ${truncation.limits?.drivers ?? 500} drivers${truncation.vehicleEnrichment ? `, with vehicle enrichment capped at ${truncation.limits?.vehicles ?? 1000} records` : ''}. Do not treat the visible list as the complete XDrive network.`
    : 'Part of the Directory enrichment is temporarily unavailable. Verified member records are still shown.';

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}>
        <span><strong>{eyebrow}</strong> · {title}</span>
        <ActionButton tone="secondary" onClick={() => void load()}>Refresh</ActionButton>
      </div>
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {partial && <AlertBanner tone="warning">{capMessage}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Directory filters">
          <div className="workspace-filter-rail__header">Search Directory</div>
          <div className="workspace-filter-rail__body">
            <label>MEMBER / COMPANY NUMBER<input value={member} onChange={(event) => setMember(event.target.value)} placeholder="Company, driver or company number" /></label>
            <label>LOCATION<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Town / postcode / country" /></label>
            <label>COUNTRY<select value={country} onChange={(event) => setCountry(event.target.value)}><option value="">Any country</option>{countries.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            {tab === 'companies' ? <label>MEMBER TYPE<input value={memberType} onChange={(event) => setMemberType(event.target.value)} placeholder="Carrier, broker, customer…" /></label> : null}
            <label>VEHICLE TYPE<input value={vehicle} onChange={(event) => setVehicle(event.target.value)} placeholder="LWB, Luton, Artic…" /></label>
            <label>SPECIALIST SERVICE<select value={specialistService} onChange={(event) => setSpecialistService(event.target.value)}><option value="">Any service</option>{specialistServices.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={tailLiftOnly} onChange={(event) => setTailLiftOnly(event.target.checked)} /> TAIL LIFT CAPABILITY</label>
            <label>DELIVERY RELIABILITY<select value={deliveryMin} onChange={(event) => setDeliveryMin(event.target.value)}><option value="">Any verified score</option><option value="80">80%+</option><option value="90">90%+</option><option value="95">95%+</option></select></label>
            <label>PAYMENT RELIABILITY<select value={paymentMin} onChange={(event) => setPaymentMin(event.target.value)}><option value="">Any verified score</option><option value="80">80%+</option><option value="90">90%+</option><option value="95">95%+</option></select></label>
            {tab === 'drivers' ? <label>AVAILABILITY<select value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="">Any availability</option><option value="available">Available</option><option value="busy">Busy</option><option value="offline">Offline</option></select></label> : null}
            <ActionButton tone="secondary" onClick={clear}>Clear</ActionButton>
            {reputationNote && <span style={{ color: '#475569', fontSize: 10, lineHeight: '13px' }}>{reputationNote}</span>}
            {privacy && <span style={{ color: '#64748b', fontSize: 10, lineHeight: '13px' }}>{privacy}</span>}
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="workspace-tab-strip" role="tablist" aria-label="Directory member types" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>
            <button type="button" data-active={tab === 'companies' ? 'true' : 'false'} onClick={() => setTab('companies')}>Companies {visibleCompanies.length}</button>
            <button type="button" data-active={tab === 'drivers' ? 'true' : 'false'} onClick={() => setTab('drivers')}>Drivers {visibleDrivers.length}</button>
          </div>
          <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}><span><strong>{tab === 'companies' ? visibleCompanies.length : visibleDrivers.length}</strong> matching loaded record(s)</span><span>Click a company identity for Member Profile</span></div>

          {loading ? (
            <div className="workspace-panel"><EmptyState compact title="Loading Directory…" /></div>
          ) : tab === 'companies' ? (
            <div className="workspace-record-list">
              {visibleCompanies.map((company) => (
                <article key={company.companyId} className="workspace-operational-row">
                  <div className="workspace-operational-row__top">
                    <div className="workspace-operational-cell"><div className="driver-cell-label">MEMBER</div><strong><MemberIdentityLink companyId={company.companyId}>{company.name}</MemberIdentityLink></strong><div className="driver-cell-secondary">{company.memberId ? `Company no. ${company.memberId}` : 'Company number not supplied'}</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">LOCATION</div><strong>{[company.city, company.postcode].filter(Boolean).join(', ') || 'Not supplied'}</strong><div className="driver-cell-secondary">{company.country ?? 'Country not supplied'}</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">TYPE / CAPABILITY</div><strong>{company.memberType}</strong><div className="driver-cell-secondary">{company.vehicleTypes?.length ? company.vehicleTypes.map((value) => value.replace(/_/g, ' ')).join(', ') : 'Fleet capability not supplied'}{company.specialistServices?.length ? ` · ${company.specialistServices.join(', ')}` : ''}{company.maxPallets != null ? ` · up to ${company.maxPallets} pallets` : ''}</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">DELIVERY / PAYMENT RELIABILITY</div><strong>Delivery {company.deliveryReliability.score == null ? 'Not enough evidence' : `${company.deliveryReliability.score}%`}</strong><div className="driver-cell-secondary">{company.deliveryReliability.evidenceCount} timed delivery record(s) · Payment {company.paymentReliability.score == null ? 'Not enough evidence' : `${company.paymentReliability.score}%`} from {company.paymentReliability.evidenceCount} due/settlement record(s){company.paymentReliability.overdueOpen ? ` · ${company.paymentReliability.overdueOpen} overdue open` : ''}</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">ACTION</div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><ActionButton tone="secondary" onClick={() => { if (company.businessPhone) window.location.href = `tel:${company.businessPhone}`; }} disabled={!company.businessPhone}>Call member</ActionButton>{messagesRoute ? <ActionButton tone="secondary" onClick={() => openMemberMessages(company.companyId)}>Messages</ActionButton> : null}{canBookCompany(company) ? <ActionButton tone="success" onClick={() => openDirectBooking(company.companyId)}>Book Direct</ActionButton> : null}</div></div>
                  </div>
                </article>
              ))}
              {visibleCompanies.length === 0 && <div className="workspace-panel"><EmptyState title="No companies match these loaded records" /></div>}
            </div>
          ) : (
            <div className="workspace-record-list">
              {visibleDrivers.map((driver) => (
                <article key={driver.driverId} className="workspace-operational-row">
                  <div className="workspace-operational-row__top">
                    <div className="workspace-operational-cell"><div className="driver-cell-label">DRIVER / MEMBER</div><strong>{driver.displayName}</strong><div className="driver-cell-secondary">{driver.companyId ? <MemberIdentityLink companyId={driver.companyId}>{driver.companyName}</MemberIdentityLink> : driver.companyName}{driver.memberId ? ` · Company no. ${driver.memberId}` : ''}</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">LOCATION</div><strong>{[driver.city, driver.postcode].filter(Boolean).join(', ') || 'Not supplied'}</strong><div className="driver-cell-secondary">Broad member/company location only</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">VEHICLE / CAPABILITY</div><strong>{driver.vehicleType?.replace(/_/g, ' ') ?? 'Not supplied'}</strong><div className="driver-cell-secondary">{driver.hasTailLift ? 'Tail lift · ' : ''}{driver.palletsCapacity != null ? `${driver.palletsCapacity} pallets · ` : ''}{driver.specialistServices?.length ? driver.specialistServices.join(', ') : 'No specialist service declared'} · no live coordinates exposed</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">COMPANY RELIABILITY</div><strong>Delivery {driver.deliveryReliability.score == null ? 'Not enough evidence' : `${driver.deliveryReliability.score}%`}</strong><div className="driver-cell-secondary">Payment {driver.paymentReliability.score == null ? 'Not enough evidence' : `${driver.paymentReliability.score}%`} · evidence is company-level and truth-derived</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">AVAILABILITY / ACTION</div><StatusBadge value={driver.availability ?? 'Not supplied'} tone={normalise(driver.availability) === 'available' ? 'green' : undefined} />{driver.companyId && messagesRoute ? <div style={{ marginTop: 6 }}><ActionButton tone="secondary" onClick={() => openMemberMessages(driver.companyId as string)}>Messages</ActionButton></div> : null}{driver.companyId && canBookCompany(companies.find((company) => company.companyId === driver.companyId)) ? <div style={{ marginTop: 6 }}><ActionButton tone="success" onClick={() => openDirectBooking(driver.companyId as string)}>Book Direct</ActionButton></div> : null}</div>
                  </div>
                </article>
              ))}
              {visibleDrivers.length === 0 && <div className="workspace-panel"><EmptyState title="No drivers match these loaded records" /></div>}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
