import { describe, expect, it } from 'vitest';
import { detectJobExceptions, type DetectorJob } from '../lib/exception-closure/jobExceptionDetectors';

const NOW = Date.parse('2026-09-30T10:00:00Z');

const base = (overrides: Partial<DetectorJob> = {}): DetectorJob => ({
  id: '11111111-1111-1111-1111-111111111111',
  status: 'posted',
  current_status: 'posted',
  updated_at: '2026-09-30T09:55:00Z',
  pickup_datetime: '2026-09-30T11:00:00Z',
  delivery_datetime: '2026-09-30T12:00:00Z',
  is_test: false,
  ...overrides,
});

describe('job exception detectors', () => {
  it('detects overdue collection and delivery using stable dedupe keys', () => {
    const jobs = [
      base({ current_status: 'on_my_way', pickup_datetime: '2026-09-30T09:30:00Z' }),
      base({ id: '22222222-2222-2222-2222-222222222222', current_status: 'loaded', delivery_datetime: '2026-09-30T09:45:00Z' }),
    ];
    const rows = detectJobExceptions(jobs, new Set(), new Map(), NOW);
    expect(rows.some((row) => row.caseType === 'pickup_overdue')).toBe(true);
    expect(rows.some((row) => row.caseType === 'delivery_overdue')).toBe(true);
    expect(rows.every((row) => row.dedupeKey.includes(row.jobId))).toBe(true);
  });
  it('detects stale status and stale GPS only for executing jobs', () => {
    const job = base({
      current_status: 'in_transit',
      assigned_driver_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      status_updated_at: '2026-09-30T09:20:00Z',
      delivery_datetime: '2026-09-30T11:00:00Z',
    });
    const rows = detectJobExceptions([job], new Set(), new Map(), NOW);
    expect(rows.map((row) => row.caseType)).toContain('driver_status_stale');
    expect(rows.map((row) => row.caseType)).toContain('driver_gps_stale');
  });

  it('does not flag GPS when a fresh position exists', () => {
    const driverId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const job = base({
      current_status: 'in_transit',
      assigned_driver_id: driverId,
      status_updated_at: '2026-09-30T09:55:00Z',
    });
    const rows = detectJobExceptions([job], new Set(), new Map([[driverId, Date.parse('2026-09-30T09:59:00Z')]]), NOW);
    expect(rows.map((row) => row.caseType)).not.toContain('driver_gps_stale');
  });
  it('detects POD remediation and delivered-without-invoice closure failures', () => {
    const job = base({
      current_status: 'delivered',
      delivered_at: '2026-09-30T09:30:00Z',
      pod_required: true,
      pod_generated: false,
      broker_pod_review_status: 'missing_requested',
    });
    const rows = detectJobExceptions([job], new Set(), new Map(), NOW);
    expect(rows.map((row) => row.caseType)).toEqual(expect.arrayContaining([
      'pod_missing',
      'pod_remediation',
      'delivered_without_invoice',
    ]));
  });

  it('does not flag delivered-without-invoice when invoice already exists', () => {
    const job = base({
      current_status: 'delivered',
      delivered_at: '2026-09-30T09:30:00Z',
      pod_required: false,
    });
    const rows = detectJobExceptions([job], new Set([job.id]), new Map(), NOW);
    expect(rows.map((row) => row.caseType)).not.toContain('delivered_without_invoice');
  });

  it('detects imminent awarded jobs without a driver and ignores test jobs', () => {
    const operational = base({
      current_status: 'awarded',
      awarded_carrier_company_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      assigned_driver_id: null,
      pickup_datetime: '2026-09-30T10:30:00Z',
    });
    const testJob = base({
      id: '33333333-3333-3333-3333-333333333333',
      current_status: 'awarded',
      awarded_carrier_company_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      assigned_driver_id: null,
      pickup_datetime: '2026-09-30T10:30:00Z',
      is_test: true,
    });
    const rows = detectJobExceptions([operational, testJob], new Set(), new Map(), NOW);
    expect(rows.filter((row) => row.caseType === 'job_unallocated_collection_imminent')).toHaveLength(1);
    expect(rows[0]?.jobId).toBe(operational.id);
  });
});
