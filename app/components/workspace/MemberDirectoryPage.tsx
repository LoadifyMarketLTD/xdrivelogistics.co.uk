'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { DirectoryMemberMessenger } from './DirectoryMemberMessenger';
import { MemberIdentityLink, MemberProfileOverlay } from './MemberProfile';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from './WorkspaceUI';

type DeliveryReliability = { score: number | null; evidenceCount: number; completedJobs: number };
type PaymentReliability = { score: number | null; evidenceCount: number; onTimePaid: number; latePaid: number; overdueOpen: number };

type DirectoryCompany = {
  companyId: string;
  name: string;
  memberId: string | null;
  businessPhone: string | null;
  businessEmail: string | null;
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
  distanceMiles?: number | null;
};

type DirectoryDriver = {
  driverId: string;
  displayName: string;
  companyId: string | null;
  companyName: string;
  memberId: string | null;
  memberType: string;
  businessPhone: string | null;
  businessEmail: string | null;
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
  distanceMiles?: number | null;
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
  nearestSearch?: { near?: string | null; radiusMiles?: number; resolved?: boolean | null };
  error?: string;
};

const normalise = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

const DIRECTORY_VEHICLE_RANK: Record<string, number> = {
  motorcycle: 1,
  car: 2,
  smallvan: 3,
  swb: 3,
  mwb: 4,
  lwb: 5,
  xlwb: 6,
  luton: 7,
  '7.5t': 8,
  '18t': 9,
  '26t': 10,
  artic: 11,
};

const normaliseVehicle = (value: string | null | undefined) =>
  normalise(value).replace(/[^a-z0-9.]/g, '');

const vehicleCapabilityMatches = (
  advertised: string | null | undefined,
  requested: string,
  mode: 'minimum' | 'exact',
) => {
  if (!requested.trim()) return true;
  const requestedKey = normaliseVehicle(requested);
  const advertisedKey = normaliseVehicle(advertised);
  if (!requestedKey || !advertisedKey) return false;
  if (mode === 'exact') return advertisedKey.includes(requestedKey) || requestedKey.includes(advertisedKey);
  const requestedRank = DIRECTORY_VEHICLE_RANK[requestedKey];
  const advertisedRank = DIRECTORY_VEHICLE_RANK[advertisedKey];
  if (requestedRank != null && advertisedRank != null) return advertisedRank >= requestedRank;
  return advertisedKey.includes(requestedKey) || requestedKey.includes(advertisedKey);
};

const DIRECTORY_CAPABILITIES = ['Livery', 'Hiab', 'Trailer', 'Moffett', 'Electric Vehicle'] as const;

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
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [bodyType, setBodyType] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [vehicleMatch, setVehicleMatch] = useState<'minimum' | 'exact'>('minimum');
  const [availability, setAvailability] = useState('');
  const [country, setCountry] = useState('');
  const [specialistService, setSpecialistService] = useState('');
  const [tailLiftOnly, setTailLiftOnly] = useState(false);
  const [capabilityFilters, setCapabilityFilters] = useState<string[]>([]);
  const [profileCompanyId, setProfileCompanyId] = useState<string | null>(null);
  const [messageTarget, setMessageTarget] = useState<{ companyId: string; name: string } | null>(null);
  const [deliveryMin, setDeliveryMin] = useState('');
  const [paymentMin, setPaymentMin] = useState('');
  const [nearestLocation, setNearestLocation] = useState('');
  const [nearestRadius, setNearestRadius] = useState('50');
  const [nearestQuery, setNearestQuery] = useState({ near: '', radius: '50' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [partial, setPartial] = useState(false);
  const [truncation, setTruncation] = useState<DirectoryTruncation>({});
  const [privacy, setPrivacy] = useState('');
  const [reputationNote, setReputationNote] = useState('');
  const [sortBy, setSortBy] = useState<'distance' | 'name' | 'delivery' | 'payment'>('distance');
  const [companyPage, setCompanyPage] = useState(1);
  const [driverPage, setDriverPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const params = new URLSearchParams();
      if (nearestQuery.near.trim()) params.set('near', nearestQuery.near.trim());
      params.set('radiusMiles', nearestQuery.radius);
      const response = await fetch(`/api/directory?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
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
  }, [nearestQuery.near, nearestQuery.radius]);

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

  const bodyTypes = useMemo(
    () => specialistServices.filter((value) => ['curtainside', 'flatbed', 'refrigerated', 'temperature controlled'].includes(normalise(value))),
    [specialistServices],
  );

  const directBookingRoute = pathname.startsWith('/broker')
    ? '/broker/post-load'
    : pathname.startsWith('/customer')
      ? '/customer/post-load'
      : pathname.startsWith('/driver')
        ? '/driver/post-load'
        : pathname.startsWith('/admin')
          ? '/admin/post-load'
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
  const canBookCompany = (company: DirectoryCompany | null | undefined) => {
    if (!directBookingRoute || !company) return false;
    const type = normalise(company.memberType);
    if (type.includes('customer') || type.includes('shipper') || type.includes('broker')) return false;
    return company.vehicleTypes.length > 0
      || ['carrier / fleet', 'owner driver', 'standard', 'sole trader'].some((value) => type.includes(value));
  };
  const openDirectBooking = (companyId: string) => {
    if (!directBookingRoute) return;
    router.push(`${directBookingRoute}?directCarrier=${encodeURIComponent(companyId)}`);
  };
  const openMemberMessages = (companyId: string, companyName: string) => {
    if (pathname.startsWith('/driver')) {
      setMessageTarget({ companyId, name: companyName });
      return;
    }
    if (!messagesRoute) return;
    router.push(`${messagesRoute}?companyId=${encodeURIComponent(companyId)}`);
  };

  const visibleCompanies = useMemo(() => {
    const memberNeedle = normalise(member);
    const locationNeedle = normalise(location);
    const typeNeedle = normalise(memberType);
    const phoneNeedle = normalise(phone);
    const emailNeedle = normalise(email);
    const bodyNeedle = normalise(bodyType);
    const countryNeedle = normalise(country);
    const serviceNeedle = normalise(specialistService);
    const capabilityNeedles = capabilityFilters.map(normalise);
    const deliveryThreshold = Number(deliveryMin || 0);
    const paymentThreshold = Number(paymentMin || 0);
    return companies.filter((company) => {
      const memberText = normalise(`${company.name} ${company.memberId ?? ''}`);
      const locationText = normalise(`${company.city ?? ''} ${company.postcode ?? ''} ${company.country ?? ''}`);
      const serviceText = normalise((company.specialistServices ?? []).join(' '));
      return (!memberNeedle || memberText.includes(memberNeedle))
        && (!locationNeedle || locationText.includes(locationNeedle))
        && (!typeNeedle || normalise(company.memberType).includes(typeNeedle))
        && (!phoneNeedle || normalise(company.businessPhone).includes(phoneNeedle))
        && (!emailNeedle || normalise(company.businessEmail).includes(emailNeedle))
        && (!bodyNeedle || serviceText.includes(bodyNeedle))
        && (!countryNeedle || normalise(company.country) === countryNeedle)
        && (!vehicle.trim() || company.vehicleTypes.some((value) => vehicleCapabilityMatches(value, vehicle, vehicleMatch)))
        && (!serviceNeedle || serviceText.includes(serviceNeedle))
        && (!tailLiftOnly || serviceText.includes('tail lift'))
        && capabilityNeedles.every((needle) => serviceText.includes(needle))
        && (!deliveryThreshold || (company.deliveryReliability.score != null && company.deliveryReliability.score >= deliveryThreshold))
        && (!paymentThreshold || (company.paymentReliability.score != null && company.paymentReliability.score >= paymentThreshold));
    });
  }, [bodyType, capabilityFilters, companies, country, deliveryMin, email, location, member, memberType, paymentMin, phone, specialistService, tailLiftOnly, vehicle, vehicleMatch]);

  const visibleDrivers = useMemo(() => {
    const memberNeedle = normalise(member);
    const locationNeedle = normalise(location);
    const availabilityNeedle = normalise(availability);
    const phoneNeedle = normalise(phone);
    const emailNeedle = normalise(email);
    const bodyNeedle = normalise(bodyType);
    const countryNeedle = normalise(country);
    const serviceNeedle = normalise(specialistService);
    const capabilityNeedles = capabilityFilters.map(normalise);
    const deliveryThreshold = Number(deliveryMin || 0);
    const paymentThreshold = Number(paymentMin || 0);
    return drivers.filter((driver) => {
      const memberText = normalise(`${driver.displayName} ${driver.companyName} ${driver.memberId ?? ''}`);
      const locationText = normalise(`${driver.city ?? ''} ${driver.postcode ?? ''} ${driver.country ?? ''}`);
      const serviceText = normalise((driver.specialistServices ?? []).join(' '));
      return (!memberNeedle || memberText.includes(memberNeedle))
        && (!locationNeedle || locationText.includes(locationNeedle))
        && (!phoneNeedle || normalise(driver.businessPhone).includes(phoneNeedle))
        && (!emailNeedle || normalise(driver.businessEmail).includes(emailNeedle))
        && (!bodyNeedle || serviceText.includes(bodyNeedle))
        && (!countryNeedle || normalise(driver.country) === countryNeedle)
        && vehicleCapabilityMatches(driver.vehicleType, vehicle, vehicleMatch)
        && (!availabilityNeedle || normalise(driver.availability) === availabilityNeedle)
        && (!serviceNeedle || serviceText.includes(serviceNeedle))
        && (!tailLiftOnly || driver.hasTailLift === true)
        && capabilityNeedles.every((needle) => serviceText.includes(needle))
        && (!deliveryThreshold || (driver.deliveryReliability.score != null && driver.deliveryReliability.score >= deliveryThreshold))
        && (!paymentThreshold || (driver.paymentReliability.score != null && driver.paymentReliability.score >= paymentThreshold));
    });
  }, [availability, bodyType, capabilityFilters, country, deliveryMin, drivers, email, location, member, paymentMin, phone, specialistService, tailLiftOnly, vehicle, vehicleMatch]);

  const clear = () => {
    setMember('');
    setLocation('');
    setMemberType('');
    setPhone('');
    setEmail('');
    setBodyType('');
    setVehicle('');
    setVehicleMatch('minimum');
    setAvailability('');
    setCountry('');
    setSpecialistService('');
    setTailLiftOnly(false);
    setCapabilityFilters([]);
    setDeliveryMin('');
    setPaymentMin('');
    setNearestLocation('');
    setNearestRadius('50');
    setNearestQuery({ near: '', radius: '50' });
  };

  const sortCompanies = useMemo(() => [...visibleCompanies].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'delivery') return (b.deliveryReliability.score ?? -1) - (a.deliveryReliability.score ?? -1);
    if (sortBy === 'payment') return (b.paymentReliability.score ?? -1) - (a.paymentReliability.score ?? -1);
    return (a.distanceMiles ?? Number.POSITIVE_INFINITY) - (b.distanceMiles ?? Number.POSITIVE_INFINITY);
  }), [sortBy, visibleCompanies]);
  const sortDrivers = useMemo(() => [...visibleDrivers].sort((a, b) => {
    if (sortBy === 'name') return a.displayName.localeCompare(b.displayName);
    if (sortBy === 'delivery') return (b.deliveryReliability.score ?? -1) - (a.deliveryReliability.score ?? -1);
    if (sortBy === 'payment') return (b.paymentReliability.score ?? -1) - (a.paymentReliability.score ?? -1);
    return (a.distanceMiles ?? Number.POSITIVE_INFINITY) - (b.distanceMiles ?? Number.POSITIVE_INFINITY);
  }), [sortBy, visibleDrivers]);
  const driverDirectoryPageSize = 5;
  const companyTotalPages = Math.max(1, Math.ceil(sortCompanies.length / driverDirectoryPageSize));
  const driverTotalPages = Math.max(1, Math.ceil(sortDrivers.length / driverDirectoryPageSize));
  const safeCompanyPage = Math.min(companyPage, companyTotalPages);
  const safeDriverPage = Math.min(driverPage, driverTotalPages);
  const driverDirectoryCompanies = sortCompanies.slice((safeCompanyPage - 1) * driverDirectoryPageSize, safeCompanyPage * driverDirectoryPageSize);
  const driverDirectoryDrivers = sortDrivers.slice((safeDriverPage - 1) * driverDirectoryPageSize, safeDriverPage * driverDirectoryPageSize);
  useEffect(() => {
    setCompanyPage(1);
    setDriverPage(1);
  }, [tab, sortBy, member, location, memberType, phone, email, bodyType, vehicle, vehicleMatch, availability, country, specialistService, tailLiftOnly, capabilityFilters, deliveryMin, paymentMin, nearestQuery]);

  const capped = Boolean(truncation.companies || truncation.drivers || truncation.vehicleEnrichment || truncation.reputation);
  const capMessage = capped
    ? `Directory results may be incomplete because the current endpoint is capped at ${truncation.limits?.companies ?? 500} companies and ${truncation.limits?.drivers ?? 500} drivers${truncation.vehicleEnrichment ? `, with vehicle enrichment capped at ${truncation.limits?.vehicles ?? 1000} records` : ''}. Do not treat the visible list as the complete XDrive network.`
    : 'Part of the Directory enrichment is temporarily unavailable. Verified member records are still shown.';

  if (pathname.startsWith('/driver')) {
    return (
      <section className="page driver-directory-prototype-page">
        <div className="subbar">
          <span className="crumb">Workspace &nbsp;/&nbsp; <b>Directory</b></span>
          <div className="sub-actions">
            <button type="button" className="btn" onClick={clear}>Clear</button>
            <button type="button" className="btn primary" onClick={() => setNearestQuery({ near: nearestLocation.trim(), radius: nearestRadius })}>Find Nearest</button>
          </div>
        </div>
        <div className="pagebody">
          <aside className="left">
            <div className="left-title">Search</div>
            <button type="button" className="directory-nearest" onClick={() => setNearestQuery({ near: nearestLocation.trim(), radius: nearestRadius })}>Find Nearest</button>
            <div className="filter"><span className="label">Country</span><select className="select" value={country} onChange={(event) => setCountry(event.target.value)}><option value="">Any country</option>{countries.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
            <div className="filter"><span className="label">Member Name / ID</span><input className="input" value={member} onChange={(event) => setMember(event.target.value)} placeholder="Name or XD member ID" /></div>
            <div className="filter"><span className="label">Location / Radius</span><div className="row2"><input className="input" value={nearestLocation} onChange={(event) => setNearestLocation(event.target.value)} placeholder="Town / postcode" /><select className="select" value={nearestRadius} onChange={(event) => setNearestRadius(event.target.value)}>{['10','20','30','50','100','200','300'].map((value) => <option key={value} value={value}>{value} miles</option>)}</select></div></div>
            <div className="filter"><span className="label">Vehicle Size</span><div className="directory-vehicle-match"><label className="check"><input type="radio" name="directory-vehicle-match" checked={vehicleMatch === 'minimum'} onChange={() => setVehicleMatch('minimum')} />Minimum</label><label className="check"><input type="radio" name="directory-vehicle-match" checked={vehicleMatch === 'exact'} onChange={() => setVehicleMatch('exact')} />Exact</label></div><input className="input" value={vehicle} onChange={(event) => setVehicle(event.target.value)} placeholder="Any vehicle" /></div>
            <div className="filter"><span className="label">Body Type</span><select className="select" value={bodyType} onChange={(event) => setBodyType(event.target.value)}><option value="">Any body type</option>{bodyTypes.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
            <div className="filter"><span className="label">Phone</span><input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Business phone" /></div>
            <div className="filter"><span className="label">Email</span><input className="input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Business email" /></div>
            <div className="filter"><span className="label">Member Type</span><input className="input" value={memberType} onChange={(event) => setMemberType(event.target.value)} placeholder="Carrier / Owner Driver / Broker" /></div>
            <div className="filter"><span className="label">Specialist Services</span><select className="select" value={specialistService} onChange={(event) => setSpecialistService(event.target.value)}><option value="">Any service</option>{specialistServices.map((value) => <option key={value} value={value}>{value}</option>)}</select><label className="check"><input type="checkbox" checked={tailLiftOnly} onChange={(event) => setTailLiftOnly(event.target.checked)} />Tail Lift</label>{DIRECTORY_CAPABILITIES.map((capability) => <label key={capability} className="check"><input type="checkbox" checked={capabilityFilters.includes(capability)} onChange={(event) => setCapabilityFilters((current) => event.target.checked ? [...current, capability] : current.filter((value) => value !== capability))} />{capability}</label>)}</div>
            <div className="filter"><span className="label">Reliability</span><div className="row2"><select className="select" value={deliveryMin} onChange={(event) => setDeliveryMin(event.target.value)}><option value="">Any delivery score</option><option value="80">80%+</option><option value="90">90%+</option><option value="95">95%+</option></select><select className="select" value={paymentMin} onChange={(event) => setPaymentMin(event.target.value)}><option value="">Any payment score</option><option value="80">80%+</option><option value="90">90%+</option><option value="95">95%+</option></select></div></div>
            <div className="filter"><span className="label">Availability</span><select className="select" value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="">Any availability</option><option value="available">Available</option><option value="busy">Busy</option><option value="offline">Offline</option></select></div>
          </aside>
          <main className="main">
            <div className="head"><div><h1>Directory</h1><p>Search the XDrive member network by identity, location, capability, vehicle and performance</p></div></div>
            {error && <AlertBanner tone="danger">{error}</AlertBanner>}
            {partial && <AlertBanner tone="warning">{capMessage}</AlertBanner>}
            <div className="directory-hero">
              <div><b>XDrive Member Network</b><span>Companies and drivers · capability · trust · reliability</span></div>
              <div className="dir-hero-actions"><button type="button" className="btn" onClick={() => void load()}>Refresh</button><button type="button" className="btn primary" onClick={() => setNearestQuery({ near: nearestLocation.trim(), radius: nearestRadius })}>Search</button></div>
            </div>
            <div className="dir-tabs">
              <div className="dir-sort">Sort By: <select className="select" value={sortBy} onChange={(event) => setSortBy(event.target.value as 'distance' | 'name' | 'delivery' | 'payment')}><option value="distance">Location / Distance</option><option value="name">Member Name</option><option value="delivery">Delivery Reliability</option><option value="payment">Payment Reliability</option></select></div>
            </div>
            {loading ? <div className="workspace-panel"><EmptyState compact title="Loading Directory…" /></div> : (
              <>
                <div className="dir-summary"><strong>COMPANIES</strong><span>{sortCompanies.length} matching member(s)</span><span className="spacer">Click a company identity for Member Profile</span></div>
                <div className="tablewrap">
                  <table className="dir-table" style={{ minWidth: 1280 }}>
                    <thead><tr><th>Member</th><th>Location</th><th>Member Type</th><th>Vehicle / Capability</th><th>Delivery / Tracking</th><th>Payment / Last Seen</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {driverDirectoryCompanies.map((company) => (
                        <tr key={company.companyId} className="dir-row">
                          <td><button type="button" className="dir-member-link"><b><MemberIdentityLink companyId={company.companyId}>{company.name}</MemberIdentityLink></b><span className="meta">{company.memberId ?? 'Member ID not supplied'}</span></button></td>
                          <td>{[company.city, company.postcode].filter(Boolean).join(' ') || 'Not supplied'}<span className="meta">{company.country ?? 'Country not supplied'}{company.distanceMiles != null ? ` · ${company.distanceMiles.toFixed(1)} mi` : ''}</span></td>
                          <td>{company.memberType}</td>
                          <td>{company.vehicleTypes?.length ? company.vehicleTypes.map((value) => value.replace(/_/g, ' ')).join(', ') : 'Not supplied'}<span className="meta">{company.specialistServices?.length ? company.specialistServices.join(', ') : 'No specialist service declared'}</span></td>
                          <td>{company.deliveryReliability.score == null ? 'Not enough evidence' : `${company.deliveryReliability.score}%`}<span className="meta">{company.deliveryReliability.evidenceCount} timed delivery record(s)</span></td>
                          <td>{company.paymentReliability.score == null ? 'Not enough evidence' : `${company.paymentReliability.score}%`}<span className="meta">{company.paymentReliability.evidenceCount} due/settlement record(s)</span></td>
                          <td><StatusBadge value="Not advertised" /></td>
                          <td><button type="button" className="rowbtn blue" onClick={() => setProfileCompanyId(company.companyId)}>Profile</button>{messagesRoute && <button type="button" className="rowbtn" onClick={() => openMemberMessages(company.companyId, company.name)}>Chat</button>}{canBookCompany(company) && <button type="button" className="rowbtn" onClick={() => openDirectBooking(company.companyId)}>Book</button>}</td>
                        </tr>
                      ))}
                      {driverDirectoryCompanies.length === 0 && <tr><td colSpan={8}><EmptyState compact title="No companies match these filters" /></td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="footer"><span>{sortCompanies.length ? `${(safeCompanyPage - 1) * driverDirectoryPageSize + 1}-${Math.min(safeCompanyPage * driverDirectoryPageSize, sortCompanies.length)} of ${sortCompanies.length}` : '0 of 0'}</span><div className="right"><button type="button" className="rowbtn" disabled={safeCompanyPage <= 1} onClick={() => setCompanyPage((current) => Math.max(1, current - 1))}>Previous</button><button type="button" className="rowbtn blue">{safeCompanyPage}</button><button type="button" className="rowbtn" disabled={safeCompanyPage >= companyTotalPages} onClick={() => setCompanyPage((current) => Math.min(companyTotalPages, current + 1))}>Next</button></div></div>

                <div className="dir-summary" style={{ marginTop: 10 }}><strong>DRIVERS</strong><span>{sortDrivers.length} matching driver(s)</span></div>
                <div className="tablewrap">
                  <table className="dir-table" style={{ minWidth: 1280 }}>
                    <thead><tr><th>Driver / Member</th><th>Location</th><th>Member Type</th><th>Vehicle / Capability</th><th>Delivery / Tracking</th><th>Payment / Last Seen</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {driverDirectoryDrivers.map((driver) => (
                        <tr key={driver.driverId} className="dir-row">
                          <td><b>{driver.displayName}</b><span className="meta">{driver.memberId ?? driver.companyName}</span></td>
                          <td>{[driver.city, driver.postcode].filter(Boolean).join(' ') || 'Not supplied'}<span className="meta">{driver.country ?? 'Country not supplied'}{driver.distanceMiles != null ? ` · ${driver.distanceMiles.toFixed(1)} mi` : ''}</span></td>
                          <td>{driver.memberType}</td>
                          <td>{driver.vehicleType?.replace(/_/g, ' ') ?? 'Not supplied'}<span className="meta">{driver.hasTailLift ? 'Tail Lift · ' : ''}{driver.specialistServices?.length ? driver.specialistServices.join(', ') : 'No specialist service declared'}</span></td>
                          <td>{driver.deliveryReliability.score == null ? 'Not enough evidence' : `${driver.deliveryReliability.score}%`}<span className="meta">Company-level delivery evidence</span></td>
                          <td>{driver.paymentReliability.score == null ? 'Not enough evidence' : `${driver.paymentReliability.score}%`}<span className="meta">Company-level payment evidence</span></td>
                          <td><StatusBadge value={driver.availability ?? 'Not supplied'} tone={normalise(driver.availability) === 'available' ? 'green' : undefined} /></td>
                          <td>{driver.companyId && <button type="button" className="rowbtn blue" onClick={() => setProfileCompanyId(driver.companyId)}>Profile</button>}{driver.companyId && messagesRoute && <button type="button" className="rowbtn" onClick={() => openMemberMessages(driver.companyId as string, driver.companyName)}>Chat</button>}{driver.companyId && canBookCompany(companies.find((company) => company.companyId === driver.companyId)) && <button type="button" className="rowbtn" onClick={() => openDirectBooking(driver.companyId as string)}>Book</button>}</td>
                        </tr>
                      ))}
                      {driverDirectoryDrivers.length === 0 && <tr><td colSpan={8}><EmptyState compact title="No drivers match these filters" /></td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="footer"><span>{sortDrivers.length ? `${(safeDriverPage - 1) * driverDirectoryPageSize + 1}-${Math.min(safeDriverPage * driverDirectoryPageSize, sortDrivers.length)} of ${sortDrivers.length}` : '0 of 0'}</span><div className="right"><button type="button" className="rowbtn" disabled={safeDriverPage <= 1} onClick={() => setDriverPage((current) => Math.max(1, current - 1))}>Previous</button><button type="button" className="rowbtn blue">{safeDriverPage}</button><button type="button" className="rowbtn" disabled={safeDriverPage >= driverTotalPages} onClick={() => setDriverPage((current) => Math.min(driverTotalPages, current + 1))}>Next</button></div></div>
              </>
            )}
            {reputationNote && <div className="footer">{reputationNote}</div>}
            {privacy && <div className="footer">{privacy}</div>}
          </main>
        </div>
        {profileCompanyId && <MemberProfileOverlay companyId={profileCompanyId} onClose={() => setProfileCompanyId(null)} />}
        {messageTarget && <DirectoryMemberMessenger companyId={messageTarget.companyId} companyName={messageTarget.name} onClose={() => setMessageTarget(null)} />}
      </section>
    );
  }

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
            <label>MEMBER / XDRIVE ID<input value={member} onChange={(event) => setMember(event.target.value)} placeholder="Company, driver or XDrive member ID" /></label>
            <label>LOCATION<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Town / postcode / country" /></label>
            <label>FIND MY NEAREST<input value={nearestLocation} onChange={(event) => setNearestLocation(event.target.value)} placeholder="Postcode / outcode, e.g. BB1" /></label>
            <label>RADIUS<select value={nearestRadius} onChange={(event) => setNearestRadius(event.target.value)}>{['10','20','30','50','100','200','300'].map((value) => <option key={value} value={value}>{value} miles</option>)}</select></label>
            <label>COUNTRY<select value={country} onChange={(event) => setCountry(event.target.value)}><option value="">Any country</option>{countries.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            {tab === 'companies' ? <label>MEMBER TYPE<input value={memberType} onChange={(event) => setMemberType(event.target.value)} placeholder="Carrier, broker, customer…" /></label> : null}
            <label>VEHICLE TYPE<input value={vehicle} onChange={(event) => setVehicle(event.target.value)} placeholder="LWB, Luton, Artic…" /></label>
            <label>SPECIALIST SERVICE<select value={specialistService} onChange={(event) => setSpecialistService(event.target.value)}><option value="">Any service</option>{specialistServices.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={tailLiftOnly} onChange={(event) => setTailLiftOnly(event.target.checked)} /> TAIL LIFT CAPABILITY</label>
            <label>DELIVERY RELIABILITY<select value={deliveryMin} onChange={(event) => setDeliveryMin(event.target.value)}><option value="">Any verified score</option><option value="80">80%+</option><option value="90">90%+</option><option value="95">95%+</option></select></label>
            <label>PAYMENT RELIABILITY<select value={paymentMin} onChange={(event) => setPaymentMin(event.target.value)}><option value="">Any verified score</option><option value="80">80%+</option><option value="90">90%+</option><option value="95">95%+</option></select></label>
            {tab === 'drivers' ? <label>AVAILABILITY<select value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="">Any availability</option><option value="available">Available</option><option value="busy">Busy</option><option value="offline">Offline</option></select></label> : null}
            <ActionButton tone="success" onClick={() => setNearestQuery({ near: nearestLocation.trim(), radius: nearestRadius })}>Find My Nearest</ActionButton>
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
                    <div className="workspace-operational-cell"><div className="driver-cell-label">MEMBER</div><strong><MemberIdentityLink companyId={company.companyId}>{company.name}</MemberIdentityLink></strong><div className="driver-cell-secondary">{company.memberId ? `Member ID ${company.memberId}` : 'Member ID not supplied'}</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">LOCATION</div><strong>{[company.city, company.postcode].filter(Boolean).join(', ') || 'Not supplied'}</strong><div className="driver-cell-secondary">{company.country ?? 'Country not supplied'}{company.distanceMiles != null ? ` · ${company.distanceMiles.toFixed(1)} mi from search` : ''}</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">TYPE / CAPABILITY</div><strong>{company.memberType}</strong><div className="driver-cell-secondary">{company.vehicleTypes?.length ? company.vehicleTypes.map((value) => value.replace(/_/g, ' ')).join(', ') : 'Fleet capability not supplied'}{company.specialistServices?.length ? ` · ${company.specialistServices.join(', ')}` : ''}{company.maxPallets != null ? ` · up to ${company.maxPallets} pallets` : ''}</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">DELIVERY / PAYMENT RELIABILITY</div><strong>Delivery {company.deliveryReliability.score == null ? 'Not enough evidence' : `${company.deliveryReliability.score}%`}</strong><div className="driver-cell-secondary">{company.deliveryReliability.evidenceCount} timed delivery record(s) · Payment {company.paymentReliability.score == null ? 'Not enough evidence' : `${company.paymentReliability.score}%`} from {company.paymentReliability.evidenceCount} due/settlement record(s){company.paymentReliability.overdueOpen ? ` · ${company.paymentReliability.overdueOpen} overdue open` : ''}</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">ACTION</div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><ActionButton tone="secondary" onClick={() => { if (company.businessPhone) window.location.href = `tel:${company.businessPhone}`; }} disabled={!company.businessPhone}>Call member</ActionButton>{messagesRoute ? <ActionButton tone="secondary" onClick={() => openMemberMessages(company.companyId, company.name)}>Messages</ActionButton> : null}{canBookCompany(company) ? <ActionButton tone="success" onClick={() => openDirectBooking(company.companyId)}>Book Direct</ActionButton> : null}</div></div>
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
                    <div className="workspace-operational-cell"><div className="driver-cell-label">DRIVER / MEMBER</div><strong>{driver.displayName}</strong><div className="driver-cell-secondary">{driver.companyId ? <MemberIdentityLink companyId={driver.companyId}>{driver.companyName}</MemberIdentityLink> : driver.companyName}{driver.memberId ? ` · Member ID ${driver.memberId}` : ''}</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">LOCATION</div><strong>{[driver.city, driver.postcode].filter(Boolean).join(', ') || 'Not supplied'}</strong><div className="driver-cell-secondary">Broad member/company location only{driver.distanceMiles != null ? ` · ${driver.distanceMiles.toFixed(1)} mi from search` : ''}</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">VEHICLE / CAPABILITY</div><strong>{driver.vehicleType?.replace(/_/g, ' ') ?? 'Not supplied'}</strong><div className="driver-cell-secondary">{driver.hasTailLift ? 'Tail lift · ' : ''}{driver.palletsCapacity != null ? `${driver.palletsCapacity} pallets · ` : ''}{driver.specialistServices?.length ? driver.specialistServices.join(', ') : 'No specialist service declared'} · no live coordinates exposed</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">COMPANY RELIABILITY</div><strong>Delivery {driver.deliveryReliability.score == null ? 'Not enough evidence' : `${driver.deliveryReliability.score}%`}</strong><div className="driver-cell-secondary">Payment {driver.paymentReliability.score == null ? 'Not enough evidence' : `${driver.paymentReliability.score}%`} · evidence is company-level and truth-derived</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">AVAILABILITY / ACTION</div><StatusBadge value={driver.availability ?? 'Not supplied'} tone={normalise(driver.availability) === 'available' ? 'green' : undefined} />{driver.companyId && messagesRoute ? <div style={{ marginTop: 6 }}><ActionButton tone="secondary" onClick={() => openMemberMessages(driver.companyId as string, driver.companyName)}>Messages</ActionButton></div> : null}{driver.companyId && canBookCompany(companies.find((company) => company.companyId === driver.companyId)) ? <div style={{ marginTop: 6 }}><ActionButton tone="success" onClick={() => openDirectBooking(driver.companyId as string)}>Book Direct</ActionButton></div> : null}</div>
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
