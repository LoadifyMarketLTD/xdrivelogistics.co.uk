'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
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
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const jobs = useMemo(
    () => data.jobs.filter((job) =>
      job.awarded_carrier_company_id === data.companyId
      && normalise(job.current_status ?? job.status) === 'awarded'
      && !job.assigned_driver_id
    ),
    [data.companyId, data.jobs],
  );

  const driverById = useMemo(() => new Map(data.drivers.map((driver) => [driver.id, driver])), [data.drivers]);
  const vehicleById = useMemo(() => new Map(data.vehicles.map((vehicle) => [vehicle.id, vehicle])), [data.vehicles]);

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
  const recommendedDriverId = acceptedBid?.bidder_driver_id && driverById.has(acceptedBid.bidder_driver_id)
    ? acceptedBid.bidder_driver_id
    : null;

  useEffect(() => {
    if (!selectedJob) {
      setSelectedDriverId('');
      setSelectedVehicleId('');
      return;
    }
    setSelectedDriverId(recommendedDriverId ?? '');
  }, [recommendedDriverId, selectedJob?.id]);

  useEffect(() => {
    if (!selectedDriverId) {
      setSelectedVehicleId('');
      return;
    }
    const assigned = data.vehicles.find((vehicle) => vehicle.assigned_driver_id === selectedDriverId);
    setSelectedVehicleId(assigned?.id ?? '');
  }, [data.vehicles, selectedDriverId]);

  const selectedDriver = selectedDriverId ? driverById.get(selectedDriverId) : undefined;
  const selectedVehicle = selectedVehicleId ? vehicleById.get(selectedVehicleId) : undefined;
  const selectedLocation = selectedDriverId ? latestLocationByDriver.get(selectedDriverId) : undefined;

  const driverDocuments = selectedDriverId
    ? data.driverDocuments.filter((document) => document.driver_id === selectedDriverId)
    : [];
  const driverComplianceAttention = driverDocuments.length === 0 || driverDocuments.some((document) =>
    ['rejected', 'expired'].includes(normalise(document.status)) || expiryAttention(document.expiry_date)
  );

  const vehicleDocuments = selectedVehicleId
    ? data.vehicleDocuments.filter((document) => document.vehicle_id === selectedVehicleId)
    : [];
  const vehicleComplianceAttention = Boolean(selectedVehicleId) && (
    vehicleDocuments.length === 0 || vehicleDocuments.some((document) =>
      ['rejected', 'expired'].includes(normalise(document.status)) || expiryAttention(document.expiry_date)
    )
  );

  const vehicleTypeMatch = !selectedJob || !selectedVehicle
    ? null
    : normalise(selectedJob.vehicle_type) === normalise(selectedVehicle.type);

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

  const driverAccountEligible = Boolean(selectedDriver) && !['suspended', 'inactive', 'rejected'].includes(normalise(selectedDriver?.status));

  const allocate = async () => {
    if (!selectedJob || !selectedDriverId) {
      setError('Select an eligible driver before allocation.');
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
        body: JSON.stringify({ driverId: selectedDriverId, expectedDriverId: null }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Driver allocation failed.');
      setNotice(`Job allocated to ${driverLabel(selectedDriver)}.`);
      await data.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Driver allocation failed.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet allocation"
        title="Won / Received — Unallocated"
        description="Carrier-awarded work stays with the company until an authorised fleet operator selects the executing driver. The quoting driver is a recommendation, not an automatic assignment."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/fleet')}>Fleet Dashboard</ActionButton>}
      />

      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {notice && <AlertBanner tone="success">{notice}</AlertBanner>}

      <Panel title="Allocation queue" description="Only jobs awarded to this carrier company and not yet assigned to a driver are shown.">
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
              bidderDriver ? driverLabel(bidderDriver) : bid?.bidder_driver_id ? 'Quoted driver not in current roster' : 'Driver not recorded on accepted quote',
              quote && quote > 0 ? money(quote, bid?.currency ?? 'GBP') : 'Not supplied',
              <ActionButton key="action" tone="success" onClick={() => setSelectedJobId(job.id)}>Allocate</ActionButton>,
            ];
          })}
          empty={<EmptyState title="No won jobs awaiting allocation" description="A multi-driver carrier award will appear here before driver allocation." />}
        />
      </Panel>

      {selectedJob && (
        <Panel
          title={`Allocate ${selectedJob.pickup_postcode ?? selectedJob.pickup_location ?? 'Collection'} → ${selectedJob.delivery_postcode ?? selectedJob.delivery_location ?? 'Delivery'}`}
          description="Readiness checks below are advisory UI signals from existing XDrive data. The canonical allocation endpoint currently persists the driver only; it does not validate or persist a job vehicle."
        >
          <div className="workspace-detail-grid">
            <div className="workspace-detail-item"><strong>Carrier award</strong><div>{acceptedBid?.companies?.name ?? 'This carrier company'}</div></div>
            <div className="workspace-detail-item"><strong>Quoted by</strong><div>{recommendedDriverId ? driverLabel(driverById.get(recommendedDriverId)) : 'No driver recommendation available'}</div></div>
            <div className="workspace-detail-item"><strong>Accepted quote</strong><div>{acceptedBid ? money(Number(acceptedBid.bid_price_gbp ?? acceptedBid.amount ?? 0), acceptedBid.currency ?? 'GBP') : 'Not supplied'}</div></div>
            <div className="workspace-detail-item"><strong>Required vehicle</strong><div>{(selectedJob.vehicle_type ?? 'Not specified').replace(/_/g, ' ')}</div></div>
            <div className="workspace-detail-item"><strong>Body type</strong><div>Not exposed by current Fleet dataset</div></div>
            <div className="workspace-detail-item"><strong>Pickup</strong><div>{when(selectedJob.pickup_datetime)}</div></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, .8fr) minmax(0, 1.2fr)', gap: 12, marginTop: 12 }}>
            <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 700 }}>
                DRIVER
                <select value={selectedDriverId} onChange={(event) => setSelectedDriverId(event.target.value)} style={{ minHeight: 32 }}>
                  <option value="">Select driver</option>
                  {data.drivers.map((driver) => {
                    const invalid = ['suspended', 'inactive', 'rejected'].includes(normalise(driver.status));
                    const recommended = driver.id === recommendedDriverId;
                    return <option key={driver.id} value={driver.id} disabled={invalid}>{driverLabel(driver)}{recommended ? ' — quoted this job' : ''} · {driver.availability_status ?? 'offline'}{invalid ? ' · ineligible account' : ''}</option>;
                  })}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 700 }}>
                PLANNED VEHICLE — READINESS ONLY
                <select value={selectedVehicleId} onChange={(event) => setSelectedVehicleId(event.target.value)} style={{ minHeight: 32 }}>
                  <option value="">No planned vehicle selected</option>
                  {data.vehicles.map((vehicle) => {
                    const exact = normalise(vehicle.type) === normalise(selectedJob.vehicle_type);
                    const assigned = vehicle.assigned_driver_id === selectedDriverId;
                    return <option key={vehicle.id} value={vehicle.id}>{vehicleLabel(vehicle)} · {(vehicle.type ?? 'type unknown').replace(/_/g, ' ')}{exact ? ' · type match' : ''}{assigned ? ' · assigned to driver' : ''}</option>;
                  })}
                </select>
              </label>

              <AlertBanner tone="warning">
                Vehicle choice is advisory in this screen. The existing allocation API assigns the driver only; it does not currently persist a job vehicle or validate type/body/payload/location/schedule automatically.
              </AlertBanner>

              <ActionButton tone="success" disabled={working || !selectedDriverId || !driverAccountEligible} onClick={() => void allocate()}>
                {working ? 'Allocating…' : 'Allocate driver'}
              </ActionButton>
            </div>

            <div className="workspace-detail-grid">
              <div className="workspace-detail-item">
                <strong>Driver availability</strong>
                <div><StatusBadge value={selectedDriver?.availability_status ?? 'No driver selected'} tone={selectedDriver?.availability_status === 'available' ? 'green' : 'orange'} /></div>
              </div>
              <div className="workspace-detail-item">
                <strong>Driver account</strong>
                <div><StatusBadge value={selectedDriver ? (driverAccountEligible ? 'eligible account' : 'ineligible account') : 'No driver selected'} tone={selectedDriver ? (driverAccountEligible ? 'green' : 'red') : 'grey'} /></div>
              </div>
              <div className="workspace-detail-item">
                <strong>Latest location</strong>
                <div>{selectedLocation ? `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)} · ${when(selectedLocation.recorded_at ?? selectedLocation.updated_at)}` : 'No current location supplied'}</div>
              </div>
              <div className="workspace-detail-item">
                <strong>Driver compliance</strong>
                <div><StatusBadge value={!selectedDriver ? 'No driver selected' : driverComplianceAttention ? 'attention required' : 'no current alert'} tone={!selectedDriver ? 'grey' : driverComplianceAttention ? 'orange' : 'green'} /></div>
              </div>
              <div className="workspace-detail-item">
                <strong>Schedule</strong>
                <div><StatusBadge value={!selectedDriver ? 'No driver selected' : overlappingJobs.length ? `${overlappingJobs.length} overlapping job(s)` : 'No overlap detected'} tone={!selectedDriver ? 'grey' : overlappingJobs.length ? 'orange' : 'green'} /></div>
              </div>
              <div className="workspace-detail-item">
                <strong>Vehicle type</strong>
                <div><StatusBadge value={!selectedVehicle ? 'No vehicle selected' : vehicleTypeMatch ? 'type match' : 'type mismatch'} tone={!selectedVehicle ? 'grey' : vehicleTypeMatch ? 'green' : 'orange'} /></div>
              </div>
              <div className="workspace-detail-item">
                <strong>Vehicle compliance</strong>
                <div><StatusBadge value={!selectedVehicle ? 'No vehicle selected' : vehicleComplianceAttention ? 'attention required' : 'no current alert'} tone={!selectedVehicle ? 'grey' : vehicleComplianceAttention ? 'orange' : 'green'} /></div>
              </div>
              <div className="workspace-detail-item">
                <strong>Vehicle assignment</strong>
                <div>{!selectedVehicle ? 'No vehicle selected' : selectedVehicle.assigned_driver_id === selectedDriverId ? 'Already assigned to selected driver' : selectedVehicle.assigned_driver_id ? 'Assigned to another driver' : 'Currently unassigned vehicle'}</div>
              </div>
            </div>
          </div>
        </Panel>
      )}
    </PageFrame>
  );
}
