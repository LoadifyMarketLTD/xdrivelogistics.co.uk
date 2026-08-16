'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

import {
  canonicalWorkspaceJobStatus,
  workspaceJobPresentationStatus,
} from '../../../lib/jobs/workspaceJobStage';
import { useCompanyWorkspaceData, type WorkspaceJob } from './useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  KpiCard,
  KpiGrid,
  OperationalTable,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from './WorkspaceUI';

type QueueMode = 'collections' | 'deliveries';

type DispatchExecutionQueuePageProps = {
  mode: QueueMode;
};

const COLLECTION_STATUSES = new Set([
  'allocated',
  'on_my_way',
  'on_my_way_to_pickup',
  'on_site_pickup',
]);

const DELIVERY_STATUSES = new Set([
  'loaded',
  'in_transit',
  'on_site_delivery',
]);

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';

const isPast = (value: string | null | undefined) => {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp < Date.now();
};

export default function DispatchExecutionQueuePage({ mode }: DispatchExecutionQueuePageProps) {
  const workspace = useCompanyWorkspaceData();
  const router = useRouter();
  const collectionMode = mode === 'collections';
  const acceptedStatuses = collectionMode ? COLLECTION_STATUSES : DELIVERY_STATUSES;

  const driverById = useMemo(
    () => new Map(workspace.drivers.map((driver) => [driver.id, driver])),
    [workspace.drivers]
  );
  const vehicleById = useMemo(
    () => new Map(workspace.vehicles.map((vehicle) => [vehicle.id, vehicle])),
    [workspace.vehicles]
  );

  const jobs = useMemo(
    () =>
      workspace.jobs
        .filter((job) => acceptedStatuses.has(canonicalWorkspaceJobStatus(job.current_status ?? job.status)))
        .sort((a, b) => {
          const aTime = new Date(collectionMode ? a.pickup_datetime ?? 0 : a.delivery_datetime ?? 0).getTime();
          const bTime = new Date(collectionMode ? b.pickup_datetime ?? 0 : b.delivery_datetime ?? 0).getTime();
          return aTime - bTime;
        }),
    [acceptedStatuses, collectionMode, workspace.jobs]
  );

  const overdueCount = jobs.filter((job) =>
    isPast(collectionMode ? job.pickup_datetime : job.delivery_datetime)
  ).length;
  const unassignedCount = jobs.filter((job) => !job.assigned_driver_id || !job.vehicle_id).length;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Daily operations"
        title={collectionMode ? 'Collections' : 'Deliveries'}
        description={
          collectionMode
            ? 'Assigned jobs still progressing toward collection, using the canonical execution lifecycle.'
            : 'Collected jobs progressing toward delivery, using the canonical execution lifecycle.'
        }
      />

      {workspace.error && <AlertBanner>{workspace.error}</AlertBanner>}

      <KpiGrid>
        <KpiCard label={collectionMode ? 'Collection queue' : 'Delivery queue'} value={jobs.length} tone="navy" />
        <KpiCard label="Past planned time" value={overdueCount} tone={overdueCount > 0 ? 'red' : 'green'} />
        <KpiCard label="Resource gaps" value={unassignedCount} tone={unassignedCount > 0 ? 'orange' : 'green'} />
      </KpiGrid>

      <Panel
        title={collectionMode ? 'Collection execution queue' : 'Delivery execution queue'}
        description={
          collectionMode
            ? 'Allocated, on-my-way and on-site-pickup work only. Loaded work moves into Deliveries.'
            : 'Loaded, in-transit and on-site-delivery work only. Completed work leaves this queue.'
        }
      >
        <OperationalTable<WorkspaceJob>
          columns={[
            {
              id: 'route',
              header: 'Route',
              cell: (job) => (
                <strong>
                  {job.pickup_postcode ?? job.pickup_location ?? 'Pickup'} →{' '}
                  {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}
                </strong>
              ),
            },
            {
              id: 'planned-time',
              header: collectionMode ? 'Collection' : 'Delivery',
              cell: (job) => when(collectionMode ? job.pickup_datetime : job.delivery_datetime),
            },
            {
              id: 'driver',
              header: 'Driver',
              cell: (job) => {
                const driver = job.assigned_driver_id ? driverById.get(job.assigned_driver_id) : null;
                return driver?.display_name ?? driver?.email ?? (job.assigned_driver_id ? 'Assigned driver' : 'Not assigned');
              },
            },
            {
              id: 'vehicle',
              header: 'Vehicle',
              cell: (job) => {
                const vehicle = job.vehicle_id ? vehicleById.get(job.vehicle_id) : null;
                return vehicle?.reg_plate ?? (job.vehicle_id ? 'Assigned vehicle' : 'Not assigned');
              },
            },
            {
              id: 'status',
              header: 'Status',
              cell: (job) => <StatusBadge value={workspaceJobPresentationStatus(job)} />,
            },
            {
              id: 'action',
              header: 'Action',
              isAction: true,
              cell: (job) => (
                <ActionButton
                  tone="secondary"
                  onClick={() => router.push(`/admin/jobs/${job.id}`)}
                >
                  Open job
                </ActionButton>
              ),
            },
          ]}
          rows={jobs}
          getRowKey={(job) => job.id}
          empty={
            <EmptyState
              title={
                workspace.loading
                  ? `Loading ${collectionMode ? 'collections' : 'deliveries'}…`
                  : `No active ${collectionMode ? 'collections' : 'deliveries'}`
              }
            />
          }
        />
      </Panel>
    </PageFrame>
  );
}
