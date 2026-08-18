import { classifyWorkspaceJobStage, normalizedJobStatus } from './jobs/workspaceJobStage';

type DriverJobLike = {
  id: string;
  assigned_driver_id?: string | null;
  status: string;
  current_status?: string | null;
  pickup_location?: string | null;
  pickup_postcode?: string | null;
  delivery_location?: string | null;
  delivery_postcode?: string | null;
  pickup_datetime?: string | null;
  vehicle_type?: string | null;
  delivery_datetime?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export const canonicalJobStatus = (currentStatus: string | null | undefined, fallbackStatus: string) =>
  normalizedJobStatus({ current_status: currentStatus, status: fallbackStatus });

export const filterJobsForDriver = <T extends DriverJobLike>(
  jobs: T[],
  opts: { driverId?: string | null; ownerDriver: boolean }
): T[] =>
  opts.driverId
    ? jobs.filter((job) => job.assigned_driver_id === opts.driverId)
    : [];

export const recentCompletedJobs = <T extends DriverJobLike>(jobs: T[], limit = 5): T[] =>
  [...jobs]
    .filter((job) => classifyWorkspaceJobStage(job) === 'completed')
    .sort((a, b) =>
      String(b.delivery_datetime ?? b.created_at ?? '').localeCompare(String(a.delivery_datetime ?? a.created_at ?? ''))
    )
    .slice(0, limit);
