import { describe, expect, it } from 'vitest';
import { canonicalJobStatus, filterJobsForDriver, recentCompletedJobs } from '../lib/driverDashboard';

describe('driver dashboard helpers', () => {
  const jobs = [
    { id: 'job-a', assigned_driver_id: 'driver-1', status: 'allocated', current_status: 'allocated', created_at: '2026-08-01T08:00:00Z' },
    { id: 'job-b', assigned_driver_id: 'driver-2', status: 'delivered', current_status: 'completed', delivery_datetime: '2026-08-01T11:00:00Z', created_at: '2026-08-01T06:00:00Z' },
    { id: 'job-c', assigned_driver_id: 'driver-1', status: 'delivered', current_status: 'completed', delivery_datetime: '2026-08-02T11:00:00Z', created_at: '2026-08-01T06:00:00Z' },
  ];

  it('keeps canonical status from current_status when present', () => {
    expect(canonicalJobStatus('in_transit', 'allocated')).toBe('in_transit');
    expect(canonicalJobStatus(null, 'allocated')).toBe('allocated');
  });

  it('fails closed to assigned-driver jobs only, even for owner-driver surfaces', () => {
    expect(filterJobsForDriver(jobs, { driverId: 'driver-1', ownerDriver: false }).map((job) => job.id)).toEqual(['job-a', 'job-c']);
    expect(filterJobsForDriver(jobs, { driverId: 'driver-1', ownerDriver: true }).map((job) => job.id)).toEqual(['job-a', 'job-c']);
    expect(filterJobsForDriver(jobs, { driverId: null, ownerDriver: false })).toEqual([]);
  });

  it('orders completed work by delivery completion time and handles no-data state', () => {
    expect(recentCompletedJobs(jobs).map((job) => job.id)).toEqual(['job-c', 'job-b']);
    expect(recentCompletedJobs([], 5)).toEqual([]);
  });
});
