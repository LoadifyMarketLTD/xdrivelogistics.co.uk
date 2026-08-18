'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import { fleetQueueStage } from '../../../../lib/jobs/workspaceJobStage';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from '../../../components/workspace/WorkspaceUI';

const money = (value: number | null | undefined, currency = 'GBP') =>
  typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value)
    : 'Not supplied';

const when = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';

const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();

const driverLabel = (driver: { display_name: string | null; email?: string | null } | undefined) =>
  driver?.display_name ?? driver?.email ?? 'Driver';

// Presentation-only account-state signal. Full eligibility is authoritative on
// the server and includes identity/onboarding/current personal documents plus
// active canonical vehicle and current vehicle compliance.
const isDriverAccountActive = (driver: { status: string | null } | undefined) =>
  normalise(driver?.status) === 'active';

const vehicleLabel = (vehicle: { reg_plate: string | null; type: string | null; make?: string | null; model?: string | null } | undefined) => {
  if (!vehicle) return 'Vehicle';
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
  return vehicle.reg_plate || makeModel || (vehicle.type ?? 'Vehicle').replace(/_/g, ' ');
};

const expiryAttention = (value: string | null | undefined) => {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return !Number.isNaN(timestamp) && timestamp <= Date.now() + 30 * 86_400_000;
};

export default function FleetAssignmentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const data = useCompanyWorkspaceData();
  const deepJobId = searchParams.get('job');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(deepJobId);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const jobs = useMemo(
    () => data.jobs.filter((job) =>
      job.awarded_carrier_company_id === data.companyId
      && fleetQueueStage(job) === 'unallocated'
    ),
    [data.companyId, data.jobs],
  );

  const driverById = useMemo(() => new Map(data.drivers.map((driver) => [driver.id, driver])), [data.drivers]);

  const latestLocationByDriver = useMemo(() => {
    const map = new Map<string, (typeof data.locations)[number]>();
    for (const location of data.locations) {
      const current = map.get(location.driver_id);
      const currentTime = current?.recorded_at ?? current?.updated_at ?? '';
      const nextTime = location.recorded_at ?? location.updated_at ?? '';
      if (!current || nextTime > currentTime) map.set(location.driver_id, location);
    }
    return map;
  }, [data.locations]);

  const acceptedBidByJob = useMemo(() => {
    const map = new Map<string, (typeof data.bids)[number]>();
    for (const bid of data.bids) {
      if (bid.company_id !== data.companyId || normalise(bid.status) !== 'accepted') continue;
      if (!map.has(bid.job_id)) map.set(bid.job_id, bid);
    }
    return map;
  }, [data.bids, data.companyId]);

  useEffect(() => {
    const requested = deepJobId && jobs.some((job) => job.id === deepJobId) ? deepJobId : null;
    if (requested) {
      setSelectedJobId(requested);
      return;
    }
    if (!selectedJobId || !jobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(jobs[0]?.id ?? null);
    }
  }, [deepJobId, jobs, selectedJobId]);

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;
  const acceptedBid = selectedJob ? acceptedBidByJob.get(selectedJob.id) : undefined;
  const quotedDriverId = acceptedBid?.bidder_driver_id && driverById.has(acceptedBid.bidder_driver_id)
    ? acceptedBid.bidder_driver_id
    : null;
  const quotedDriver = quotedDriverId ? driverById.get(quotedDriverId) : undefined;

  // A quoted driver is historical commercial context, not a current allocation
  // recommendation. This client dataset cannot prove canonical operational
  // eligibility, so changing jobs always clears the selection and requires the
  // Fleet operator to choose deliberately. The server remains authoritative.
  useEffect(() => {
    setSelectedDriverId('');
  }, [selectedJob?.id]);

  const selectedDriver = selectedDriverId ? driverById.get(selectedDriverId) : undefined;
  const selectedLocation = selectedDriverId ? latestLocationByDriver.get(selectedDriverId) : undefined;

  // This client dataset proves assignment relationships only. It does not expose
  // vehicle.status, so zero/multiple rows are advisory signals rather than an
  // eligibility verdict. The server resolver selects exactly one ACTIVE assigned
  // vehicle or rejects allocation fail-closed.
  const assignedVehicles = selectedDriverId
    ? data.vehicles.filter((vehicle) => vehicle.assigned_driver_id === selectedDriverId)
    : [];
  const vehicleCandidate = assignedVehicles.length === 1 ? assignedVehicles[0] : undefined;
  const vehicleBindingState = !selectedDriverId
    ? 'No driver selected'
    : assignedVehicles.length === 0
      ? 'No assigned vehicle visible in current Fleet dataset'
      : assignedVehicles.length > 1
        ? `${assignedVehicles.length} assigned vehicles visible · server resolves active canonical vehicle`
        : vehicleLabel(vehicleCandidate);

  const driverDocuments = selectedDriverId
    ? data.driverDocuments.filter((document) => document.driver_id === selectedDriverId)
    : [];
  const driverComplianceAttention = driverDocuments.length === 0 || driverDocuments.some((document) =>
    ['rejected', 'expired'].includes(normalise(document.status)) || expiryAttention(document.expiry_date)
  );

  const vehicleDocuments = vehicleCandidate
    ? data.vehicleDocuments.filter((document) => document.vehicle_id === vehicleCandidate.id)
    : [];
  const vehicleComplianceAttention = Boolean(vehicleCandidate) && (
    vehicleDocuments.length === 0 || vehicleDocuments.some((document) =>
      ['rejected', 'expired'].includes(normalise(document.status)) || expiryAttention(document.expiry_date)
    )
  );

  const vehicleTypeMatch = !selectedJob || !vehicleCandidate
    ? null
    : normalise(selectedJob.vehicle_type) === normalise(vehicleCandidate.type);

  const overlappingJobs = selectedJob && selectedDriverId
    ? data.jobs.filter((job) => {
      if (job.id === selectedJob.id || job.assigned_driver_id !== selectedDriverId) return false;
      const status = normalise(job.current_status ?? job.status);
      if (['completed', 'delivered', 'cancelled', 'paid', 'invoiced'].includes(status)) return false;
      if (!job.pickup_datetime || !selectedJob.pickup_datetime) return false;
      const otherStart = new Date(job.pickup_datetime).getTime();
      const otherEnd = new Date(job.delivery_datetime ?? job.pickup_datetime).getTime();
      const targetStart = new Date(selectedJob.pickup_datetime).getTime();
      const targetEnd = new Date(selectedJob.delivery_datetime ?? selectedJob.pickup_datetime).getTime();
      if ([otherStart, otherEnd, targetStart, targetEnd].some(Number.isNaN)) return false;
      return otherStart <= targetEnd && targetStart <= otherEnd;
    })
    : [];

  const driverAccountActive = isDriverAccountActive(selectedDriver);

  const allocate = async () => {
    if (!selectedJob || !selectedDriverId || !driverAccountActive) {
      setError('Select an active driver before allocation. Full driver and vehicle eligibility is revalidated by the server.');
      return;
    }
    setWorking(true);
    setError('');
    setNotice('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Session expired.');
      const response = await fetch(`/api/admin/jobs/${selectedJob.id}/assign-driver`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: selectedDriverId,
          expectedDriverId: selectedJob.assigned_driver_id ?? null,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Driver and vehicle allocation failed.');
      setNotice(`Job allocated to ${driverLabel(selectedDriver)}. The canonical active vehicle was persisted by the server.`);
      await data.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Driver and vehicle allocation failed.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet allocation"
        title="Won / Received — Unallocated"
        description="Company-level awards and incomplete driver/vehicle allocations remain here until an authorised fleet operator selects the executing driver. XDrive then revalidates the driver and persists that driver's canonical active vehicle atomically."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/fleet')}>Fleet Dashboard</ActionButton>}
      />

      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {notice && <AlertBanner tone="success">{notice}</AlertBanner>}

      <Panel title="Allocation queue" description="Only jobs awarded to this carrier company that still require canonical driver + vehicle allocation are shown.">
        <DataTable
          columns={['Won for', 'Route', 'Pickup', 'Required vehicle', 'Quoted by', 'Agreed quote', 'Action']}
          rows={jobs.map((job) => {
            const bid = acceptedBidByJob.get(job.id);
            const bidderDriver = bid?.bidder_driver_id ? driverById.get(bid.bidder_driver_id) : undefined;
            const quote = bid ? Number(bid.bid_price_gbp ?? bid.amount ?? 0) : null;
            return [
              bid?.companies?.name ?? 'This carrier company',
              <strong key="route">{job.pickup_postcode ?? job.pickup_location ?? 'Collection'} → {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}</strong>,
              when(job.pickup_datetime),
              (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
              bidderDriver
                ? `${driverLabel(bidderDriver)} · historical bidder${isDriverAccountActive(bidderDriver) ? '' : ' · account not active'}`
                : bid?.bidder_driver_id ? 'Quoted driver not in current roster' : 'Company-level quote',
              quote && quote > 0 ? money(quote, bid?.currency ?? 'GBP') : 'Not supplied',
              <ActionButton key="action" tone="success" onClick={() => setSelectedJobId(job.id)}>Allocate</ActionButton>,
            ];
          })}
          empty={<EmptyState title="No won jobs awaiting allocation" description="Carrier awards that still require canonical driver + vehicle allocation will appear here." />}
        />
      </Panel>

      {selectedJob && (
        <Panel
          title={`Allocate ${selectedJob.pickup_postcode ?? selectedJob.pickup_location ?? 'Collection'} → ${selectedJob.delivery_postcode ?? selectedJob.delivery_location ?? 'Delivery'}`}
          description="Select the executing driver. Browser data is advisory; the canonical endpoint is the authority for current onboarding, personal compliance, active canonical vehicle and vehicle compliance before persisting driver + vehicle."
        >
          <div className="workspace-detail-grid">
            <div className="workspace-detail-item"><strong>Carrier award</strong><div>{acceptedBid?.companies?.name ?? 'This carrier company'}</div></div>
            <div className="workspace-detail-item"><strong>Quoted by</strong><div>{quotedDriver ? `${driverLabel(quotedDriver)} · historical bidder only${isDriverAccountActive(quotedDriver) ? '' : ' · account not active'}` : acceptedBid?.bidder_driver_id ? 'Quoted driver not in current roster' : 'Company-level quote'}</div></div>
            <div className="workspace-detail-item"><strong>Accepted quote</strong><div>{acceptedBid ? money(Number(acceptedBid.bid_price_gbp ?? acceptedBid.amount ?? 0), acceptedBid.currency ?? 'GBP') : 'Not supplied'}</div></div>
            <div className="workspace-detail-item"><strong>Required vehicle</strong><div>{(selectedJob.vehicle_type ?? 'Not specified').replace(/_/g, ' ')}</div></div>
            <div className="workspace-detail-item"><strong>Pickup</strong><div>{when(selectedJob.pickup_datetime)}</div></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, .8fr) minmax(0, 1.2fr)', gap: 12, marginTop: 12 }}>
            <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 700 }}>
                DRIVER
                <select value={selectedDriverId} onChange={(event) => setSelectedDriverId(event.target.value)} style={{ minHeight: 32 }}>
                  <option value="">Select driver</option>
                  {data.drivers.map((driver) => {
                    const accountActive = isDriverAccountActive(driver);
                    const historicalBidder = driver.id === quotedDriverId;
                    return <option key={driver.id} value={driver.id} disabled={!accountActive}>{driverLabel(driver)}{historicalBidder ? ' — quoted this job (historical)' : ''} · {driver.availability_status ?? 'offline'}{accountActive ? '' : ' · account not active'}</option>;
                  })}
                </select>
              </label>

              <AlertBanner tone="info">
                No driver is preselected from quote history. Choose the intended execution driver deliberately; XDrive then verifies full current eligibility and binds that driver's canonical vehicle server-side.
              </AlertBanner>

              <div className="workspace-detail-item">
                <strong>Vehicle binding signal</strong>
                <div>{vehicleBindingState}</div>
                {vehicleCandidate && <small>{(vehicleCandidate.type ?? 'type unknown').replace(/_/g, ' ')} · active/compliance status verified server-side</small>}
              </div>

              <AlertBanner tone="info">
                Vehicle is never chosen arbitrarily here. The server resolves exactly one active assigned compliant vehicle for the selected driver; otherwise allocation is rejected with the real blocker.
              </AlertBanner>

              <ActionButton tone="success" disabled={working || !selectedDriverId || !driverAccountActive} onClick={() => void allocate()}>
                {working ? 'Allocating…' : 'Allocate driver + canonical vehicle'}
              </ActionButton>
            </div>

            <div className="workspace-detail-grid">
              <div className="workspace-detail-item">
                <strong>Driver availability</strong>
                <div><StatusBadge value={selectedDriver?.availability_status ?? 'No driver selected'} tone={selectedDriver?.availability_status === 'available' ? 'green' : 'orange'} /></div>
              </div>
              <div className="workspace-detail-item">
                <strong>Driver account</strong>
                <div><StatusBadge value={selectedDriver ? (driverAccountActive ? 'active account' : 'account not active') : 'No driver selected'} tone={selectedDriver ? (driverAccountActive ? 'blue' : 'red') : 'grey'} /></div>
                {selectedDriver && driverAccountActive && <small>Account state only; full operational eligibility is verified server-side.</small>}
              </div>
              <div className="workspace-detail-item">
                <strong>Latest location</strong>
                <div>{selectedLocation ? `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)} · ${when(selectedLocation.recorded_at ?? selectedLocation.updated_at)}` : 'No current location supplied'}</div>
              </div>
              <div className="workspace-detail-item">
                <strong>Driver documents</strong>
                <div><StatusBadge value={!selectedDriver ? 'No driver selected' : driverComplianceAttention ? 'attention signal' : 'no local alert'} tone={!selectedDriver ? 'grey' : driverComplianceAttention ? 'orange' : 'green'} /></div>
                <small>Presentation signal only; current required personal documents are revalidated server-side.</small>
              </div>
              <div className="workspace-detail-item">
                <strong>Schedule</strong>
                <div><StatusBadge value={!selectedDriver ? 'No driver selected' : overlappingJobs.length ? `${overlappingJobs.length} overlapping job(s)` : 'No overlap detected'} tone={!selectedDriver ? 'grey' : overlappingJobs.length ? 'orange' : 'green'} /></div>
              </div>
              <div className="workspace-detail-item">
                <strong>Vehicle assignments visible</strong>
                <div><StatusBadge value={!selectedDriver ? 'No driver selected' : `${assignedVehicles.length} assignment(s)`} tone={!selectedDriver ? 'grey' : assignedVehicles.length === 1 ? 'blue' : 'orange'} /></div>
                <small>Not an eligibility verdict because active vehicle status is not projected in this client dataset.</small>
              </div>
              <div className="workspace-detail-item">
                <strong>Vehicle type signal</strong>
                <div><StatusBadge value={!vehicleCandidate ? 'No unique client candidate' : vehicleTypeMatch ? 'type match' : 'type mismatch'} tone={!vehicleCandidate ? 'grey' : vehicleTypeMatch ? 'green' : 'orange'} /></div>
              </div>
              <div className="workspace-detail-item">
                <strong>Vehicle documents signal</strong>
                <div><StatusBadge value={!vehicleCandidate ? 'No unique client candidate' : vehicleComplianceAttention ? 'attention signal' : 'no local alert'} tone={!vehicleCandidate ? 'grey' : vehicleComplianceAttention ? 'orange' : 'green'} /></div>
                <small>Final MOT/insurance validity is rechecked by the canonical server resolver.</small>
              </div>
            </div>
          </div>
        </Panel>
      )}
    </PageFrame>
  );
}
