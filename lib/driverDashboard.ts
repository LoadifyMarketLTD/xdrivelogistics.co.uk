type DriverJobLike = {
  id: string;
  assigned_driver_id?: string | null;
  status: string;
  current_status?: string | null;
  pickup_location?: string | null;
  delivery_location?: string | null;
  pickup_datetime?: string | null;
  vehicle_type?: string | null;
  delivery_datetime?: string | null;
  created_at?: string | null;
};

const COMPLETED_STATUSES = new Set(['completed', 'invoiced', 'paid']);

export const canonicalJobStatus = (currentStatus: string | null | undefined, fallbackStatus: string) =>
  currentStatus ?? fallbackStatus;

export const filterJobsForDriver = (
  jobs: DriverJobLike[],
  opts: { driverId?: string | null; ownerDriver: boolean }
) =>
  opts.driverId
    ? jobs.filter((job) => job.assigned_driver_id === opts.driverId)
    : [];

export const recentCompletedJobs = (jobs: DriverJobLike[], limit = 5) =>
  [...jobs]
    .filter((job) => COMPLETED_STATUSES.has(canonicalJobStatus(job.current_status, job.status)))
    .sort((a, b) =>
      String(b.delivery_datetime ?? b.created_at ?? '').localeCompare(String(a.delivery_datetime ?? a.created_at ?? ''))
    )
    .slice(0, limit);
