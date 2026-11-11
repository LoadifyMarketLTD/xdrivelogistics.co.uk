'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { readRouteAuthAccessToken } from '../../../lib/routeAuthCookie';
import { resolveWorkspaceRole } from '../../../lib/workspaceRole';
import { useAuth } from '../AuthContext';
import { MemberIdentityLink } from './MemberProfile';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from './WorkspaceUI';
import { usePrivateNetworkGroups } from './usePrivateNetworkGroups';

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

type SavedNetworkResponse = {
  items?: Array<{ companyId: string }>;
  error?: string;
};

type DirectorySort = 'Distance' | 'Member Name' | 'Delivery Reliability' | 'Payment Reliability';

const normalise = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

const VEHICLE_RANK: Record<string, number> = {
  'small van': 1, van: 1, swb: 2, 'swb van': 2, lwb: 3, 'lwb van': 3,
  xlwb: 4, 'xlwb van': 4, luton: 5, 'luton van': 5, 'luton tail lift': 5,
  '7.5t': 6, '7.5 tonne': 6, '18t': 7, '18 tonne': 7, '26t': 8, '26 tonne': 8, artic: 9, articulated: 9,
};

function vehicleRank(value: string | null | undefined) {
  const key = normalise(value).replaceAll('_', ' ');
  const exact = VEHICLE_RANK[key];
  if (exact != null) return exact;
  const match = Object.entries(VEHICLE_RANK).find(([name]) => key.includes(name));
  return match?.[1] ?? null;
}

function vehicleMatches(values: Array<string | null | undefined>, query: string, mode: 'minimum' | 'exact') {
  const needle = normalise(query).replaceAll('_', ' ');
  if (!needle) return true;
  const available = values.map((value) => normalise(value).replaceAll('_', ' ')).filter(Boolean);
  if (mode === 'exact') return available.some((value) => value === needle || value.includes(needle));
  const requiredRank = vehicleRank(needle);
  if (requiredRank == null) return available.some((value) => value.includes(needle));
  return available.some((value) => {
    const rank = vehicleRank(value);
    return rank != null && rank >= requiredRank;
  });
}

function sortDirectoryRecords<T extends DirectoryCompany | DirectoryDriver>(records: T[], sort: DirectorySort): T[] {
  return [...records].sort((a, b) => {
    if (sort === 'Member Name') {
      const nameA = 'name' in a ? a.name : a.displayName;
      const nameB = 'name' in b ? b.name : b.displayName;
      return nameA.localeCompare(nameB);
    }
    if (sort === 'Delivery Reliability') {
      return (b.deliveryReliability.score ?? -1) - (a.deliveryReliability.score ?? -1);
    }
    if (sort === 'Payment Reliability') {
      return (b.paymentReliability.score ?? -1) - (a.paymentReliability.score ?? -1);
    }
    return (a.distanceMiles ?? Number.POSITIVE_INFINITY) - (b.distanceMiles ?? Number.POSITIVE_INFINITY);
  });
}

export function MemberDirectoryPage(_props: {
  title?: string;
  eyebrow?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const ownerDriver = resolveWorkspaceRole(user) === 'owner_driver';
  const [companies, setCompanies] = useState<DirectoryCompany[]>([]);
  const [drivers, setDrivers] = useState<DirectoryDriver[]>([]);
  const [member, setMember] = useState('');
  const [location, setLocation] = useState('');
  const [memberType, setMemberType] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [vehicleMatchMode, setVehicleMatchMode] = useState<'minimum' | 'exact'>('minimum');
  const [availability, setAvailability] = useState('');
  const [country, setCountry] = useState('');
  const [specialistService, setSpecialistService] = useState('');
  const [tailLiftOnly, setTailLiftOnly] = useState(false);
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
  const [directorySort, setDirectorySort] = useState<DirectorySort>('Distance');
  const [directoryPageSize, setDirectoryPageSize] = useState(25);
  const [directoryPage, setDirectoryPage] = useState(1);
  const [savedCompanyIds, setSavedCompanyIds] = useState<Set<string>>(new Set());
  const [savedOnly, setSavedOnly] = useState(false);
  const [savedNetworkLoading, setSavedNetworkLoading] = useState(false);
  const [savedNetworkError, setSavedNetworkError] = useState('');
  const privateGroups = usePrivateNetworkGroups(user?.companyId ?? null);
  const [newPrivateGroupName, setNewPrivateGroupName] = useState('');
  const [selectedPrivateGroupId, setSelectedPrivateGroupId] = useState('');
  const [privateGroupEditName, setPrivateGroupEditName] = useState('');
  const [privateGroupWorking, setPrivateGroupWorking] = useState(false);
  const [privateGroupActionError, setPrivateGroupActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = readRouteAuthAccessToken();
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

  const loadSavedNetwork = useCallback(async () => {
    if (!pathname.startsWith('/driver') || !ownerDriver) {
      setSavedCompanyIds(new Set());
      setSavedOnly(false);
      setSavedNetworkError('');
      return;
    }

    setSavedNetworkLoading(true);
    setSavedNetworkError('');
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch('/api/driver/watchlist', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as SavedNetworkResponse;
      if (!response.ok) throw new Error(payload.error || 'Saved Networks could not be loaded.');
      setSavedCompanyIds(new Set((payload.items ?? []).map((item) => item.companyId)));
    } catch (reason) {
      setSavedCompanyIds(new Set());
      setSavedNetworkError(reason instanceof Error ? reason.message : 'Saved Networks could not be loaded.');
    } finally {
      setSavedNetworkLoading(false);
    }
  }, [ownerDriver, pathname]);

  const toggleSavedCompany = async (companyId: string) => {
    if (!ownerDriver) return;
    const currentlySaved = savedCompanyIds.has(companyId);
    setSavedNetworkError('');
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch(
        currentlySaved ? `/api/driver/watchlist?companyId=${encodeURIComponent(companyId)}` : '/api/driver/watchlist',
        {
          method: currentlySaved ? 'DELETE' : 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            ...(currentlySaved ? {} : { 'Content-Type': 'application/json' }),
          },
          ...(currentlySaved ? {} : { body: JSON.stringify({ companyId }) }),
        },
      );
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Saved Network could not be updated.');
      setSavedCompanyIds((current) => {
        const next = new Set(current);
        if (currentlySaved) next.delete(companyId);
        else next.add(companyId);
        return next;
      });
    } catch (reason) {
      setSavedNetworkError(reason instanceof Error ? reason.message : 'Saved Network could not be updated.');
    }
  };

  const createPrivateGroup = async () => {
    const companyId = user?.companyId?.trim();
    const name = newPrivateGroupName.trim();
    if (!companyId || !name || !privateGroups.canManage) return;
    setPrivateGroupWorking(true);
    setPrivateGroupActionError('');
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch('/api/network/groups', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, name, allowLoadVisibility: true, allowAvailabilityVisibility: true }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Private Group could not be created.');
      setNewPrivateGroupName('');
      await privateGroups.refresh();
    } catch (reason) {
      setPrivateGroupActionError(reason instanceof Error ? reason.message : 'Private Group could not be created.');
    } finally {
      setPrivateGroupWorking(false);
    }
  };

  const renamePrivateGroup = async () => {
    const companyId = user?.companyId?.trim();
    const group = privateGroups.groups.find((item) => item.id === selectedPrivateGroupId);
    const name = privateGroupEditName.trim();
    if (!companyId || !group || !name || !privateGroups.canManage) return;
    setPrivateGroupWorking(true);
    setPrivateGroupActionError('');
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch('/api/network/groups', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, groupId: group.id, name }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Private Group could not be renamed.');
      await privateGroups.refresh();
      setPrivateGroupEditName(name);
    } catch (reason) {
      setPrivateGroupActionError(reason instanceof Error ? reason.message : 'Private Group could not be renamed.');
    } finally {
      setPrivateGroupWorking(false);
    }
  };

  const updatePrivateGroupPermission = async (
    field: 'allowLoadVisibility' | 'allowAvailabilityVisibility',
    value: boolean,
  ) => {
    const companyId = user?.companyId?.trim();
    const group = privateGroups.groups.find((item) => item.id === selectedPrivateGroupId);
    if (!companyId || !group || !privateGroups.canManage) return;
    setPrivateGroupWorking(true);
    setPrivateGroupActionError('');
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch('/api/network/groups', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, groupId: group.id, [field]: value }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Private Group permissions could not be updated.');
      await privateGroups.refresh();
    } catch (reason) {
      setPrivateGroupActionError(reason instanceof Error ? reason.message : 'Private Group permissions could not be updated.');
    } finally {
      setPrivateGroupWorking(false);
    }
  };

  const deletePrivateGroup = async () => {
    const companyId = user?.companyId?.trim();
    const group = privateGroups.groups.find((item) => item.id === selectedPrivateGroupId);
    if (!companyId || !group || !privateGroups.canManage) return;
    setPrivateGroupWorking(true);
    setPrivateGroupActionError('');
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const params = new URLSearchParams({ companyId, groupId: group.id });
      const response = await fetch(`/api/network/groups?${params.toString()}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Private Group could not be deleted.');
      setSelectedPrivateGroupId('');
      setPrivateGroupEditName('');
      await privateGroups.refresh();
    } catch (reason) {
      setPrivateGroupActionError(reason instanceof Error ? reason.message : 'Private Group could not be deleted.');
    } finally {
      setPrivateGroupWorking(false);
    }
  };

  const updatePrivateGroupMember = async (groupId: string, targetCompanyId: string, remove = false) => {
    const companyId = user?.companyId?.trim();
    if (!companyId || !groupId || !targetCompanyId || !privateGroups.canManage) return;
    setPrivateGroupWorking(true);
    setPrivateGroupActionError('');
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const url = remove
        ? `/api/network/groups/${encodeURIComponent(groupId)}/members?companyId=${encodeURIComponent(companyId)}&targetCompanyId=${encodeURIComponent(targetCompanyId)}`
        : `/api/network/groups/${encodeURIComponent(groupId)}/members`;
      const response = await fetch(url, {
        method: remove ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}`, ...(remove ? {} : { 'Content-Type': 'application/json' }) },
        ...(remove ? {} : { body: JSON.stringify({ companyId, targetCompanyId }) }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Private Group membership could not be updated.');
      await privateGroups.refresh();
    } catch (reason) {
      setPrivateGroupActionError(reason instanceof Error ? reason.message : 'Private Group membership could not be updated.');
    } finally {
      setPrivateGroupWorking(false);
    }
  };

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadSavedNetwork(); }, [loadSavedNetwork]);

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
      const serviceText = normalise((company.specialistServices ?? []).join(' '));
      return (!memberNeedle || memberText.includes(memberNeedle))
        && (!locationNeedle || locationText.includes(locationNeedle))
        && (!typeNeedle || normalise(company.memberType).includes(typeNeedle))
        && (!countryNeedle || normalise(company.country) === countryNeedle)
        && vehicleMatches(company.vehicleTypes ?? [], vehicleNeedle, vehicleMatchMode)
        && (!serviceNeedle || serviceText.includes(serviceNeedle))
        && (!tailLiftOnly || serviceText.includes('tail lift'))
        && (!deliveryThreshold || (company.deliveryReliability.score != null && company.deliveryReliability.score >= deliveryThreshold))
        && (!paymentThreshold || (company.paymentReliability.score != null && company.paymentReliability.score >= paymentThreshold))
        && (!savedOnly || savedCompanyIds.has(company.companyId));
    });
  }, [companies, country, deliveryMin, location, member, memberType, paymentMin, savedCompanyIds, savedOnly, specialistService, tailLiftOnly, vehicle, vehicleMatchMode]);

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
        && vehicleMatches([driver.vehicleType], vehicleNeedle, vehicleMatchMode)
        && (!availabilityNeedle || normalise(driver.availability) === availabilityNeedle)
        && (!serviceNeedle || serviceText.includes(serviceNeedle))
        && (!tailLiftOnly || driver.hasTailLift === true)
        && (!deliveryThreshold || (driver.deliveryReliability.score != null && driver.deliveryReliability.score >= deliveryThreshold))
        && (!paymentThreshold || (driver.paymentReliability.score != null && driver.paymentReliability.score >= paymentThreshold))
        && (!savedOnly || Boolean(driver.companyId && savedCompanyIds.has(driver.companyId)));
    });
  }, [availability, country, deliveryMin, drivers, location, member, paymentMin, savedCompanyIds, savedOnly, specialistService, tailLiftOnly, vehicle, vehicleMatchMode]);

  const sortedCompanies = useMemo(
    () => sortDirectoryRecords(visibleCompanies, directorySort),
    [directorySort, visibleCompanies],
  );
  const sortedDrivers = useMemo(
    () => sortDirectoryRecords(visibleDrivers, directorySort),
    [directorySort, visibleDrivers],
  );
  const directoryLastPage = Math.max(1, Math.ceil(Math.max(sortedCompanies.length, sortedDrivers.length) / directoryPageSize));
  const safeDirectoryPage = Math.min(directoryPage, directoryLastPage);
  const pageStart = (safeDirectoryPage - 1) * directoryPageSize;
  const displayedCompanies = sortedCompanies.slice(pageStart, pageStart + directoryPageSize);
  const displayedDrivers = sortedDrivers.slice(pageStart, pageStart + directoryPageSize);
  const totalRecords = sortedCompanies.length + sortedDrivers.length;
  const shownCount = displayedCompanies.length + displayedDrivers.length;
  const previousDirectoryPage = () => setDirectoryPage((current) => Math.max(1, current - 1));
  const nextDirectoryPage = () => setDirectoryPage((current) => Math.min(directoryLastPage, current + 1));

  const clear = () => {
    setMember('');
    setLocation('');
    setMemberType('');
    setVehicle('');
    setVehicleMatchMode('minimum');
    setAvailability('');
    setCountry('');
    setSpecialistService('');
    setTailLiftOnly(false);
    setDeliveryMin('');
    setPaymentMin('');
    setNearestLocation('');
    setNearestRadius('50');
    setNearestQuery({ near: '', radius: '50' });
    setSavedOnly(false);
    setDirectorySort('Distance');
    setDirectoryPage(1);
  };

  const selectedPrivateGroup = privateGroups.groups.find((group) => group.id === selectedPrivateGroupId) ?? null;
  const privateGroupPanel = user?.companyId ? (
    <div className="workspace-panel" style={{ marginBottom: 8, padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ color: '#0b2f6b' }}>Private Groups</strong>
        <select className="select" style={{ maxWidth: 260 }} value={selectedPrivateGroupId} onChange={(event) => { const nextId = event.target.value; setSelectedPrivateGroupId(nextId); setPrivateGroupEditName(privateGroups.groups.find((group) => group.id === nextId)?.name ?? ''); }}>
          <option value="">Choose group</option>
          {privateGroups.groups.map((group) => <option key={group.id} value={group.id}>{group.name} ({group.members.length})</option>)}
        </select>
        {privateGroups.canManage ? <><input className="input" style={{ maxWidth: 220 }} value={newPrivateGroupName} onChange={(event) => setNewPrivateGroupName(event.target.value)} placeholder="New group name" /><button type="button" className="rowbtn blue" disabled={privateGroupWorking || newPrivateGroupName.trim().length < 2} onClick={() => void createPrivateGroup()}>Create Group</button></> : null}
        {privateGroups.loading ? <span className="meta">Loading groups…</span> : null}
        {!pathname.startsWith('/driver') ? <button type="button" className="rowbtn" style={{ marginLeft: 'auto' }} onClick={() => void load()}>Refresh</button> : null}
      </div>
      {privateGroups.error ? <AlertBanner tone="warning">{privateGroups.error}</AlertBanner> : null}
      {privateGroupActionError ? <AlertBanner tone="warning">{privateGroupActionError}</AlertBanner> : null}
      {selectedPrivateGroup && privateGroups.canManage ? <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}><input className="input" style={{ maxWidth: 220 }} value={privateGroupEditName} onChange={(event) => setPrivateGroupEditName(event.target.value)} placeholder="Rename selected group" /><button type="button" className="rowbtn" disabled={privateGroupWorking || privateGroupEditName.trim().length < 2 || privateGroupEditName.trim() === selectedPrivateGroup.name} onClick={() => void renamePrivateGroup()}>Rename</button><button type="button" className="rowbtn" disabled={privateGroupWorking} onClick={() => void deletePrivateGroup()}>Delete Group</button><label className="check"><input type="checkbox" checked={selectedPrivateGroup.allowLoadVisibility} disabled={privateGroupWorking} onChange={(event) => void updatePrivateGroupPermission('allowLoadVisibility', event.target.checked)} />Loads</label><label className="check"><input type="checkbox" checked={selectedPrivateGroup.allowAvailabilityVisibility} disabled={privateGroupWorking} onChange={(event) => void updatePrivateGroupPermission('allowAvailabilityVisibility', event.target.checked)} />Availability</label></div> : null}
      {selectedPrivateGroup ? <div style={{ marginTop: 7, display: 'flex', gap: 5, flexWrap: 'wrap' }}>{selectedPrivateGroup.members.length ? selectedPrivateGroup.members.map((member) => <span key={member.companyId} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #dbe2ea', borderRadius: 999, padding: '3px 7px', background: '#f8fafc', fontSize: 14 }}>{member.companyName}{privateGroups.canManage ? <button type="button" aria-label={`Remove ${member.companyName} from group`} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontWeight: 800 }} onClick={() => void updatePrivateGroupMember(selectedPrivateGroup.id, member.companyId, true)}>×</button> : null}</span>) : <span className="meta">No companies in this group yet. Select a group, then use Add to Group on a Directory member.</span>}</div> : null}
    </div>
  ) : null;

  const capped = Boolean(truncation.companies || truncation.drivers || truncation.vehicleEnrichment || truncation.reputation);
  const capMessage = capped
    ? `Directory results may be incomplete because the current endpoint is capped at ${truncation.limits?.companies ?? 500} companies and ${truncation.limits?.drivers ?? 500} drivers${truncation.vehicleEnrichment ? `, with vehicle enrichment capped at ${truncation.limits?.vehicles ?? 1000} records` : ''}. Do not treat the visible list as the complete XDrive network.`
    : 'Part of the Directory enrichment is temporarily unavailable. Verified member records are still shown.';

  return (
    <div className="xdrive-directory-page">
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {savedNetworkError && <AlertBanner tone="danger">{savedNetworkError}</AlertBanner>}
      {partial && <AlertBanner tone="warning">{capMessage}</AlertBanner>}

      <div className="workspace-board-layout xdrive-directory-layout">
        <aside className="workspace-filter-rail" aria-label="Directory filters">
          <div className="workspace-filter-rail__header">Search Directory</div>
          <div className="workspace-filter-rail__body">
            <ActionButton tone="success" onClick={() => setNearestQuery({ near: nearestLocation.trim(), radius: nearestRadius })}>Find My Nearest</ActionButton>
            <label>COUNTRY<select value={country} onChange={(event) => setCountry(event.target.value)}><option value="">Any country</option>{countries.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label>MEMBER NAME / ID<input value={member} onChange={(event) => setMember(event.target.value)} placeholder="Company, driver or XDrive ID" /></label>
            <label>LOCATION<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Town / postcode / country" /></label>
            <label>NEAREST POSTCODE<input value={nearestLocation} onChange={(event) => setNearestLocation(event.target.value)} placeholder="Postcode / outcode, e.g. BB1" /></label>
            <label>RADIUS SEARCH<select value={nearestRadius} onChange={(event) => setNearestRadius(event.target.value)}>{['10','20','30','50','100','200','300'].map((value) => <option key={value} value={value}>{value} miles</option>)}</select></label>
            <label>VEHICLE SIZE / TYPE<input value={vehicle} onChange={(event) => setVehicle(event.target.value)} placeholder="SWB, LWB, Luton, Artic…" /></label>
            <div className="xdrive-directory-vehicle-match" role="group" aria-label="Vehicle size matching">
              <label><input type="radio" name="directory-vehicle-match" checked={vehicleMatchMode === 'minimum'} onChange={() => setVehicleMatchMode('minimum')} /> Minimum</label>
              <label><input type="radio" name="directory-vehicle-match" checked={vehicleMatchMode === 'exact'} onChange={() => setVehicleMatchMode('exact')} /> Exact</label>
            </div>
            <label>MEMBER TYPE<input value={memberType} onChange={(event) => setMemberType(event.target.value)} placeholder="Carrier, broker, customer…" /></label>
            <label>SPECIALIST SERVICE<select value={specialistService} onChange={(event) => setSpecialistService(event.target.value)}><option value="">Any service</option>{specialistServices.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="xdrive-directory-check"><input type="checkbox" checked={tailLiftOnly} onChange={(event) => setTailLiftOnly(event.target.checked)} /> Tail Lift</label>
            <label>DELIVERY RELIABILITY<select value={deliveryMin} onChange={(event) => setDeliveryMin(event.target.value)}><option value="">Any verified score</option><option value="80">80%+</option><option value="90">90%+</option><option value="95">95%+</option></select></label>
            <label>PAYMENT RELIABILITY<select value={paymentMin} onChange={(event) => setPaymentMin(event.target.value)}><option value="">Any verified score</option><option value="80">80%+</option><option value="90">90%+</option><option value="95">95%+</option></select></label>
            <label>AVAILABILITY<select value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="">Any availability</option><option value="available">Available</option><option value="busy">Busy</option><option value="offline">Offline</option></select></label>
            {ownerDriver ? <ActionButton tone={savedOnly ? 'success' : 'secondary'} disabled={savedNetworkLoading} onClick={() => setSavedOnly((current) => !current)}>{savedNetworkLoading ? 'Loading Saved…' : `Saved Networks (${savedCompanyIds.size})`}</ActionButton> : null}
            <div className="xdrive-directory-filter-actions">
              <ActionButton tone="success" onClick={() => setNearestQuery({ near: nearestLocation.trim(), radius: nearestRadius })}>Search</ActionButton>
              <ActionButton tone="secondary" onClick={clear}>Clear</ActionButton>
            </div>
            {reputationNote && <span className="xdrive-directory-helper-copy">{reputationNote}</span>}
            {privacy && <span className="xdrive-directory-helper-copy">{privacy}</span>}
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="workspace-record-meta xdrive-directory-toolbar">
            <span><strong>{totalRecords}</strong> matching loaded record(s)</span>
            <label>Sort By <select className="select" aria-label="Sort directory results" value={directorySort} onChange={(event) => { setDirectorySort(event.target.value as DirectorySort); setDirectoryPage(1); }}><option>Distance</option><option>Member Name</option><option>Delivery Reliability</option><option>Payment Reliability</option></select></label>
            <span className="xdrive-directory-toolbar__note">Companies and drivers are separated below.</span>
            <label className="xdrive-directory-page-size">Items per Page <select value={directoryPageSize} onChange={(event) => { const next = Number(event.target.value); setDirectoryPageSize(next); setDirectoryPage(1); }}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label>
            <span>{totalRecords ? `Page ${safeDirectoryPage} of ${directoryLastPage} / ${shownCount} shown / ${totalRecords} matching` : '0 results'}</span>
            <ActionButton tone="secondary" onClick={previousDirectoryPage} disabled={safeDirectoryPage <= 1}>Previous</ActionButton>
            <ActionButton tone="secondary" onClick={nextDirectoryPage} disabled={safeDirectoryPage >= directoryLastPage}>Next</ActionButton>
          </div>

          {loading ? (
            <div className="workspace-panel"><EmptyState compact title="Loading Directory…" /></div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              <div className="workspace-record-meta"><strong>COMPANIES</strong><span>{visibleCompanies.length}</span></div>
              <div className="workspace-record-list">
              {displayedCompanies.map((company) => (
                <article key={company.companyId} className="workspace-operational-row">
                  <div className="workspace-operational-row__top">
                    <div className="workspace-operational-cell"><div className="driver-cell-label">MEMBER</div><strong><MemberIdentityLink companyId={company.companyId}>{company.name}</MemberIdentityLink></strong><div className="driver-cell-secondary">{company.memberId ? `Member ID ${company.memberId}` : 'Member ID not supplied'}</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">LOCATION</div><strong>{[company.city, company.postcode].filter(Boolean).join(', ') || 'Not supplied'}</strong><div className="driver-cell-secondary">{company.country ?? 'Country not supplied'}{company.distanceMiles != null ? ` · ${company.distanceMiles.toFixed(1)} mi from search` : ''}</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">TYPE / CAPABILITY</div><strong>{company.memberType}</strong><div className="driver-cell-secondary">{company.vehicleTypes?.length ? company.vehicleTypes.map((value) => value.replace(/_/g, ' ')).join(', ') : 'Fleet capability not supplied'}{company.specialistServices?.length ? ` · ${company.specialistServices.join(', ')}` : ''}{company.maxPallets != null ? ` · up to ${company.maxPallets} pallets` : ''}</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">DELIVERY / PAYMENT RELIABILITY</div><strong>Delivery {company.deliveryReliability.score == null ? 'Not enough evidence' : `${company.deliveryReliability.score}%`}</strong><div className="driver-cell-secondary">{company.deliveryReliability.evidenceCount} timed delivery record(s) · Payment {company.paymentReliability.score == null ? 'Not enough evidence' : `${company.paymentReliability.score}%`} from {company.paymentReliability.evidenceCount} due/settlement record(s){company.paymentReliability.overdueOpen ? ` · ${company.paymentReliability.overdueOpen} overdue open` : ''}</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">ACTION</div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><ActionButton tone="secondary" onClick={() => { if (company.businessPhone) window.location.href = `tel:${company.businessPhone}`; }} disabled={!company.businessPhone}>Call member</ActionButton>{messagesRoute ? <ActionButton tone="secondary" onClick={() => openMemberMessages(company.companyId)}>Messages</ActionButton> : null}{ownerDriver ? <ActionButton tone="secondary" onClick={() => void toggleSavedCompany(company.companyId)}>{savedCompanyIds.has(company.companyId) ? 'Remove Saved' : 'Save Network'}</ActionButton> : null}{canBookCompany(company) ? <ActionButton tone="success" onClick={() => openDirectBooking(company.companyId)}>Book Direct</ActionButton> : null}{privateGroups.canManage && selectedPrivateGroupId && company.companyId !== user?.companyId && !selectedPrivateGroup?.members.some((member) => member.companyId === company.companyId) ? <ActionButton tone="secondary" disabled={privateGroupWorking} onClick={() => void updatePrivateGroupMember(selectedPrivateGroupId, company.companyId)}>Add to Group</ActionButton> : null}</div></div>
                  </div>
                </article>
              ))}
              {visibleCompanies.length === 0 && <div className="workspace-panel"><EmptyState compact title="No companies match these loaded records" /></div>}
              </div>
              <div className="workspace-record-meta"><strong>DRIVERS</strong><span>{visibleDrivers.length}</span></div>
              <div className="workspace-record-list">
              {displayedDrivers.map((driver) => (
                <article key={driver.driverId} className="workspace-operational-row">
                  <div className="workspace-operational-row__top">
                    <div className="workspace-operational-cell"><div className="driver-cell-label">DRIVER / MEMBER</div><strong>{driver.displayName}</strong><div className="driver-cell-secondary">{driver.companyId ? <MemberIdentityLink companyId={driver.companyId}>{driver.companyName}</MemberIdentityLink> : driver.companyName}{driver.memberId ? ` · Member ID ${driver.memberId}` : ''}</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">LOCATION</div><strong>{[driver.city, driver.postcode].filter(Boolean).join(', ') || 'Not supplied'}</strong><div className="driver-cell-secondary">Broad member/company location only{driver.distanceMiles != null ? ` · ${driver.distanceMiles.toFixed(1)} mi from search` : ''}</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">VEHICLE / CAPABILITY</div><strong>{driver.vehicleType?.replace(/_/g, ' ') ?? 'Not supplied'}</strong><div className="driver-cell-secondary">{driver.hasTailLift ? 'Tail lift · ' : ''}{driver.palletsCapacity != null ? `${driver.palletsCapacity} pallets · ` : ''}{driver.specialistServices?.length ? driver.specialistServices.join(', ') : 'No specialist service declared'} · no live coordinates exposed</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">COMPANY RELIABILITY</div><strong>Delivery {driver.deliveryReliability.score == null ? 'Not enough evidence' : `${driver.deliveryReliability.score}%`}</strong><div className="driver-cell-secondary">Payment {driver.paymentReliability.score == null ? 'Not enough evidence' : `${driver.paymentReliability.score}%`} · evidence is company-level and truth-derived</div></div>
                    <div className="workspace-operational-cell"><div className="driver-cell-label">AVAILABILITY / ACTION</div><StatusBadge value={driver.availability ?? 'Not supplied'} tone={normalise(driver.availability) === 'available' ? 'green' : undefined} />{driver.companyId && messagesRoute ? <div style={{ marginTop: 6 }}><ActionButton tone="secondary" onClick={() => openMemberMessages(driver.companyId as string)}>Messages</ActionButton></div> : null}{driver.companyId && canBookCompany(companies.find((company) => company.companyId === driver.companyId)) ? <div style={{ marginTop: 6 }}><ActionButton tone="success" onClick={() => openDirectBooking(driver.companyId as string)}>Book Direct</ActionButton></div> : null}{driver.companyId && privateGroups.canManage && selectedPrivateGroupId && driver.companyId !== user?.companyId && !selectedPrivateGroup?.members.some((member) => member.companyId === driver.companyId) ? <div style={{ marginTop: 6 }}><ActionButton tone="secondary" disabled={privateGroupWorking} onClick={() => void updatePrivateGroupMember(selectedPrivateGroupId, driver.companyId as string)}>Add to Group</ActionButton></div> : null}</div>
                  </div>
                </article>
              ))}
              {visibleDrivers.length === 0 && <div className="workspace-panel"><EmptyState compact title="No drivers match these loaded records" /></div>}
              </div>
              <div className="workspace-record-meta xdrive-directory-pagination">
                <span>{totalRecords ? `Page ${safeDirectoryPage} of ${directoryLastPage} / ${shownCount} shown` : '0 results'}</span>
                <ActionButton tone="secondary" onClick={previousDirectoryPage} disabled={safeDirectoryPage <= 1}>Previous</ActionButton>
                <ActionButton tone="secondary" onClick={nextDirectoryPage} disabled={safeDirectoryPage >= directoryLastPage}>Next</ActionButton>
              </div>
            </div>
          )}
        </main>
      </div>
      {privateGroupPanel}
    </div>
  );
}
