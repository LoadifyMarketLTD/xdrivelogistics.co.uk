'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { classifyWorkspaceJobStage } from '../../../../lib/jobs/workspaceJobStage';
import { useCompanyWorkspaceData, type WorkspaceJob, type WorkspaceLocation, type WorkspaceVehicle } from '../../../components/workspace/useCompanyWorkspaceData';
import { useFleetAvailabilityPresence } from '../../../components/workspace/useFleetAvailabilityPresence';
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
import { getAccessToken } from '../../_lib/getAccessToken';

type ReadinessDocumentStats = {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  expired: number;
};

type ReadinessRow = {
  driver_id: string;
  display_name: string;
  operationally_ready: boolean;
  blockers: string[];
  account: {
    status: string;
    is_active: boolean;
    app_access: boolean;
    can_commercial_bid: boolean;
  };
  onboarding: {
    application_id: string | null;
    status: string;
    risk_status: string;
    missing_documents: Array<{ document_family: string; doc_type: string; reason: string }>;
    documents: ReadinessDocumentStats;
  };
  vehicle: {
    active_assigned_count: number;
    id: string | null;
    registration: string | null;
    documents: ReadinessDocumentStats;
  };
};

type ReadinessResponse = {
  rows?: ReadinessRow[];
  error?: string;
  summary?: {
    total: number;
    operationally_ready: number;
    blocked: number;
    missing_onboarding_documents: number;
    vehicle_assignment_attention: number;
  };
};

const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();
const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not supplied';

const BLOCKER_LABELS: Record<string, string> = {
  driver_not_found: 'Driver record missing',
  driver_account_not_active: 'Driver account is not active',
  driver_app_access_disabled: 'Driver app access is disabled',
  commercial_bidding_not_permitted: 'Commercial bidding is not enabled',
  driver_user_identity_missing: 'Login identity is not linked',
  driver_company_context_missing: 'Company link is missing',
  verified_driver_identity_missing: 'Driver identity has not been verified',
  driver_onboarding_not_approved: 'Driver onboarding is not approved',
  driver_personal_compliance_not_current: 'Required Driver evidence is missing, pending, rejected or expired',
  driver_company_not_active: 'Company is not operationally active',
  driver_company_membership_not_active: 'Driver company membership is not active',
  canonical_vehicle_missing: 'Exactly one active assigned Vehicle is required',
  canonical_vehicle_ambiguous: 'More than one active Vehicle is assigned',
  canonical_vehicle_company_mismatch: 'Assigned Vehicle belongs to another company',
  'vehicle_document_missing_or_invalid:mot': 'Current approved MOT is required',
  'vehicle_document_missing_or_invalid:insurance': 'Current approved Vehicle Insurance is required',
  readiness_check_failed: 'Readiness check could not be completed',
};

const blockerLabel = (value: string) => BLOCKER_LABELS[value] ?? value.replace(/_/g, ' ');
const docLabel = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const statsSummary = (stats: ReadinessDocumentStats) => {
  if (stats.total === 0) return 'No evidence uploaded';
  const parts = [`${stats.approved} approved`];
  if (stats.pending) parts.push(`${stats.pending} pending`);
  if (stats.rejected) parts.push(`${stats.rejected} rejected`);
  if (stats.expired) parts.push(`${stats.expired} expired`);
  return parts.join(' / ');
};

export default function FleetDriversPage() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const presence = useFleetAvailabilityPresence(data.companyId);
  const [readinessRows, setReadinessRows] = useState<ReadinessRow[]>([]);
  const [readinessError, setReadinessError] = useState('');
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessSummary, setReadinessSummary] = useState<ReadinessResponse['summary']>();

  useEffect(() => {
    let cancelled = false;
    const loadReadiness = async () => {
      if (!data.companyId) {
        setReadinessRows([]);
        setReadinessSummary(undefined);
        return;
      }
      setReadinessLoading(true);
      setReadinessError('');
      const { accessToken, error: tokenError } = await getAccessToken();
      if (cancelled) return;
      if (tokenError || !accessToken) {
        setReadinessError(tokenError ?? 'Session expired. Please sign in again.');
        setReadinessLoading(false);
        return;
      }

      const response = await fetch(
        `/api/admin/fleet/readiness?companyId=${encodeURIComponent(data.companyId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' },
      );
      const payload = await response.json().catch(() => ({} as ReadinessResponse)) as ReadinessResponse;
      if (cancelled) return;
      if (!response.ok) {
        setReadinessError(payload.error ?? 'Unable to resolve Fleet operational readiness.');
        setReadinessRows([]);
        setReadinessSummary(undefined);
      } else {
        setReadinessRows(Array.isArray(payload.rows) ? payload.rows : []);
        setReadinessSummary(payload.summary);
      }
      setReadinessLoading(false);
    };

    void loadReadiness();
    return () => { cancelled = true; };
  }, [data.companyId]);

  const readinessByDriver = useMemo(
    () => new Map(readinessRows.map((row) => [row.driver_id, row])),
    [readinessRows],
  );

  const vehiclesByDriver = useMemo(() => {
    const map = new Map<string, WorkspaceVehicle[]>();
    for (const vehicle of data.vehicles) {
      if (!vehicle.assigned_driver_id) continue;
      const rows = map.get(vehicle.assigned_driver_id) ?? [];
      rows.push(vehicle);
      map.set(vehicle.assigned_driver_id, rows);
    }
    return map;
  }, [data.vehicles]);

  const latestLocationByDriver = useMemo(() => {
    const map = new Map<string, WorkspaceLocation>();
    for (const location of data.locations) {
      const current = map.get(location.driver_id);
      const currentAt = current?.recorded_at ?? current?.updated_at ?? '';
      const nextAt = location.recorded_at ?? location.updated_at ?? '';
      if (!current || nextAt > currentAt) map.set(location.driver_id, location);
    }
    for (const point of presence.points) {
      const current = map.get(point.driverId);
      const currentAt = current?.recorded_at ?? current?.updated_at ?? '';
      const nextAt = point.recordedAt ?? '';
      if (!current || nextAt > currentAt) {
        map.set(point.driverId, {
          id: `availability:${point.driverId}`,
          driver_id: point.driverId,
          job_id: null,
          lat: point.lat,
          lng: point.lng,
          recorded_at: point.recordedAt,
          updated_at: null,
        });
      }
    }
    return map;
  }, [data.locations, presence.points]);

  const jobByDriver = useMemo(() => {
    const map = new Map<string, WorkspaceJob>();
    for (const job of data.jobs) {
      if (!job.assigned_driver_id || job.awarded_carrier_company_id !== data.companyId) continue;
      if (classifyWorkspaceJobStage(job) !== 'in_progress') continue;
      if (!map.has(job.assigned_driver_id)) map.set(job.assigned_driver_id, job);
    }
    return map;
  }, [data.companyId, data.jobs]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet resources"
        title="Drivers"
        description="Operational readiness is resolved from the canonical Driver identity, onboarding, Vehicle assignment and compliance contracts - not from the account status badge alone."
        actions={(
          <>
            <ActionButton tone="secondary" onClick={() => router.push('/admin/documents')}>Compliance documents</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/admin/live-availability')}>Live positions</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/admin/drivers')}>Manage drivers</ActionButton>
          </>
        )}
      />

      {presence.error && <AlertBanner tone="warning">{presence.error}</AlertBanner>}
      {readinessError && <AlertBanner tone="warning">{readinessError}</AlertBanner>}
      {readinessSummary && (
        <AlertBanner tone={readinessSummary.blocked > 0 ? 'warning' : 'success'}>
          Fleet readiness: {readinessSummary.operationally_ready} ready / {readinessSummary.blocked} blocked.
          {readinessSummary.missing_onboarding_documents > 0 ? ` ${readinessSummary.missing_onboarding_documents} Driver(s) need onboarding evidence or review.` : ''}
          {readinessSummary.vehicle_assignment_attention > 0 ? ` ${readinessSummary.vehicle_assignment_attention} Driver(s) need exactly one active assigned Vehicle.` : ''}
        </AlertBanner>
      )}

      <Panel
        title="Driver operations register"
        description="Every blocked Driver now shows the actual readiness reason. Fleet Managers can upload evidence and fix Vehicle assignment; Platform Owner compliance review remains the approval authority."
      >
        <DataTable
          columns={['Driver', 'Vehicle', 'Location', 'Account', 'Compliance', 'Operational readiness', 'Current job', 'Action']}
          rows={data.drivers.map((driver) => {
            const readiness = readinessByDriver.get(driver.id);
            const vehicles = vehiclesByDriver.get(driver.id) ?? [];
            const vehicle = vehicles.length === 1 ? vehicles[0] : undefined;
            const vehicleSignal = readiness
              ? readiness.vehicle.active_assigned_count === 0
                ? 'No active assigned Vehicle'
                : readiness.vehicle.active_assigned_count > 1
                  ? `${readiness.vehicle.active_assigned_count} active Vehicles assigned`
                  : `${readiness.vehicle.registration ?? vehicle?.reg_plate ?? 'Vehicle'} / ${statsSummary(readiness.vehicle.documents)}`
              : vehicles.length === 0
                ? 'No assigned Vehicle'
                : vehicles.length > 1
                  ? `${vehicles.length} Vehicles assigned`
                  : `${vehicle?.reg_plate ?? 'No registration'} / ${(vehicle?.type ?? 'type unknown').replace(/_/g, ' ')}`;
            const location = latestLocationByDriver.get(driver.id);
            const job = jobByDriver.get(driver.id);
            const accountActive = normalise(driver.status) === 'active';
            const operationallyAvailable = accountActive && normalise(driver.availability_status) === 'available';
            const missingDocuments = readiness?.onboarding.missing_documents ?? [];
            const blockers = readiness?.blockers ?? [];

            const complianceCell = readiness ? (
              <span key="compliance" style={{ display: 'grid', gap: 3 }}>
                <strong>{statsSummary(readiness.onboarding.documents)}</strong>
                <span>Onboarding: {readiness.onboarding.status.replace(/_/g, ' ')}</span>
                {missingDocuments.length > 0 && (
                  <span style={{ color: '#b45309' }}>
                    Missing: {missingDocuments.map((item) => docLabel(item.doc_type)).join(', ')}
                  </span>
                )}
                {readiness.onboarding.risk_status !== 'clear' && (
                  <span style={{ color: '#b91c1c' }}>Risk: {readiness.onboarding.risk_status.replace(/_/g, ' ')}</span>
                )}
              </span>
            ) : readinessLoading ? 'Checking compliance...' : 'Readiness unavailable';

            const readinessCell = readiness ? (
              <span key="readiness" style={{ display: 'grid', gap: 4, minWidth: 220 }}>
                <StatusBadge value={readiness.operationally_ready ? 'Operationally Ready' : 'Blocked'} tone={readiness.operationally_ready ? 'green' : 'red'} />
                {!readiness.operationally_ready && blockers.length > 0 && (
                  <span style={{ color: '#991b1b', lineHeight: 1.35 }}>
                    {blockers.map(blockerLabel).join(' / ')}
                  </span>
                )}
              </span>
            ) : readinessLoading ? 'Checking...' : 'Not resolved';

            return [
              <span key="driver">
                <strong style={{ display: 'block' }}>{driver.display_name ?? driver.email ?? 'Driver'}</strong>
                <span>{driver.phone ?? driver.email ?? 'No contact supplied'}</span>
              </span>,
              vehicleSignal,
              location
                ? <span key="location"><strong style={{ display: 'block' }}>Position received</strong><span>{when(location.recorded_at ?? location.updated_at)}</span></span>
                : 'Location unavailable',
              <span key="account" style={{ display: 'grid', gap: 3 }}>
                <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <StatusBadge value={driver.availability_status ?? 'offline'} tone={operationallyAvailable ? 'green' : undefined} />
                  <StatusBadge value={readiness?.account.status ? `account ${readiness.account.status}` : (accountActive ? 'active account' : `account ${driver.status ?? 'unknown'}`)} tone={readiness?.account.is_active ? 'blue' : 'red'} />
                </span>
                {readiness && !readiness.account.app_access && <span style={{ color: '#991b1b' }}>App access disabled</span>}
              </span>,
              complianceCell,
              readinessCell,
              job
                ? `${job.pickup_postcode ?? job.pickup_location ?? 'Collection'} -> ${job.delivery_postcode ?? job.delivery_location ?? 'Delivery'} / ${(job.current_status ?? job.status).replace(/_/g, ' ')}`
                : 'No job currently in execution',
              <span key="action" style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                {!readiness?.operationally_ready && (
                  <ActionButton tone="secondary" onClick={() => router.push('/admin/documents?type=driver')}>Fix compliance</ActionButton>
                )}
                {readiness && readiness.vehicle.active_assigned_count !== 1 && (
                  <ActionButton tone="secondary" onClick={() => router.push('/admin/vehicles')}>Fix Vehicle</ActionButton>
                )}
                {location && <ActionButton tone="secondary" onClick={() => router.push('/admin/live-availability')}>Locate</ActionButton>}
                <ActionButton tone="secondary" onClick={() => router.push('/admin/drivers')}>Manage</ActionButton>
              </span>,
            ];
          })}
          empty={<EmptyState title="No Drivers in the Fleet roster" />}
        />
      </Panel>
    </PageFrame>
  );
}
