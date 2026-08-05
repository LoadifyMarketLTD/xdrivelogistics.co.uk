/**
 * Admin Jobs status deep-link contract tests.
 *
 * Validates:
 *   1. resolveJobStatusFilter covers all cases required by the ?status= deep-link
 *      feature (full integration with JOBS_STATUS_FILTER_VALUES).
 *   2. app/admin/jobs/page.tsx source wiring — the resolver is imported and used
 *      both for initialisation and for the synchronisation useEffect.
 *
 * These are pure unit / source-contract tests.  No production credentials,
 * Supabase, or browser environment required.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  resolveJobStatusFilter,
  JOBS_STATUS_FILTER_VALUES,
} from '../lib/jobs/jobOperationalContract';

const CWD = process.cwd();

const adminJobsPage = readFileSync(
  resolve(CWD, 'app/admin/jobs/page.tsx'),
  'utf8',
);

// ── Source wiring contract ────────────────────────────────────────────────────

describe('Admin Jobs page source wiring', () => {
  it('imports resolveJobStatusFilter from the canonical contract module', () => {
    expect(adminJobsPage).toContain('resolveJobStatusFilter');
    expect(adminJobsPage).toContain('jobOperationalContract');
  });

  it('initialises statusFilter through resolveJobStatusFilter', () => {
    expect(adminJobsPage).toMatch(/useState\(\s*\(\)\s*=>\s*resolveJobStatusFilter\(/);
  });

  it('synchronises statusFilter in a useEffect that depends on statusParam', () => {
    expect(adminJobsPage).toMatch(/useEffect\([\s\S]*?resolveJobStatusFilter[\s\S]*?\[statusParam\]/);
  });

  it('retains the Suspense boundary wrapping JobsPageInner', () => {
    expect(adminJobsPage).toContain('<Suspense');
    expect(adminJobsPage).toContain('JobsPageInner');
  });
});

// ── JOBS_STATUS_FILTER_VALUES completeness ───────────────────────────────────

describe('JOBS_STATUS_FILTER_VALUES', () => {
  it('includes the "All" sentinel', () => {
    expect(JOBS_STATUS_FILTER_VALUES).toContain('All');
  });

  it('includes canonical DB values used by the visible tabs', () => {
    const expected = ['draft', 'posted', 'allocated', 'in_transit', 'delivered', 'completed', 'cancelled'];
    for (const v of expected) {
      expect(JOBS_STATUS_FILTER_VALUES).toContain(v);
    }
  });
});

// ── resolveJobStatusFilter deep-link integration ──────────────────────────────

describe('resolveJobStatusFilter — ?status= deep-link resolution', () => {
  it('/admin/jobs (no param) → "All"', () => {
    expect(resolveJobStatusFilter(null)).toBe('All');
  });

  it('/admin/jobs?status=delivered → "delivered" (Delivered tab selected)', () => {
    expect(resolveJobStatusFilter('delivered')).toBe('delivered');
  });

  it('/admin/jobs?status=DELIVERED → "delivered" (case-insensitive)', () => {
    expect(resolveJobStatusFilter('DELIVERED')).toBe('delivered');
  });

  it('/admin/jobs?status=received → "draft" (human-readable alias maps to DB value)', () => {
    expect(resolveJobStatusFilter('received')).toBe('draft');
  });

  it('/admin/jobs?status=draft → "draft" (DB value accepted directly)', () => {
    expect(resolveJobStatusFilter('draft')).toBe('draft');
  });

  it('/admin/jobs?status= (empty) → "All" (safe fallback)', () => {
    expect(resolveJobStatusFilter('')).toBe('All');
  });

  it('/admin/jobs?status=bogus → "All" (unknown value fails safely)', () => {
    expect(resolveJobStatusFilter('bogus')).toBe('All');
  });

  it('/admin/jobs?status=completed → "completed" (post-delivery operational state)', () => {
    expect(resolveJobStatusFilter('completed')).toBe('completed');
  });

  it('every value returned by the resolver is a member of JOBS_STATUS_FILTER_VALUES', () => {
    const probes = [
      null, '', 'all', 'All', 'ALL',
      'received', 'RECEIVED',
      'draft', 'posted', 'allocated', 'in_transit', 'delivered', 'completed', 'cancelled',
      'DELIVERED', ' Posted ',
      'unknown', 'invoiced',
    ];
    for (const probe of probes) {
      const result = resolveJobStatusFilter(probe);
      expect(JOBS_STATUS_FILTER_VALUES as readonly string[]).toContain(result);
    }
  });
});
