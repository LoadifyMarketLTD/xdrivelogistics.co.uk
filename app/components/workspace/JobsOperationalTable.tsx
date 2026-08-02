/**
 * JobsOperationalTable
 *
 * Pure operational UI component for the Jobs list view.
 * All dimensions derived from docs/ui/cx/jobs.md and the mandatory numeric
 * contract in PR #338.  No layout values are invented.
 *
 * Reference: public/reference/courier-exchange/Screenshot 2026-05-28 204652.png
 *
 * Section 10 column geometry (from mandatory directive):
 *   status/priority : 92px
 *   job/reference   : 110px
 *   route           : minmax(260px, 1.6fr)
 *   pickup          : 150px
 *   delivery        : 150px
 *   vehicle         : 110px
 *   customer        : 150px
 *   price/distance  : 96px
 *   actions         : 92px
 *
 * Row target height: 42px standard, max 52px when route wraps.
 */
'use client';

import type { CSSProperties } from 'react';
import type { LoadDetailItem } from '../../../lib/loadPostingDetails';
import styles from './WorkspaceUI.module.css';

/* ─── Types ─────────────────────────────────────────────────────────────── */

/** Full display + operational data carried by every table row. */
export interface JobRow {
  id: string;
  jobRef: string;
  status: string;
  client: { name: string };
  pickup: { location: string; date: string; time: string; postcode?: string };
  delivery: { location: string; date: string; time: string; postcode?: string };
  vehicleType: string;
  /** Pre-formatted distance string, e.g. "42.3 mi", or empty string. */
  distanceMiles: string;
  createdAt: string;
  updatedAt: string;
  exchange_visibility?: string | null;
  awarded_carrier_company_id?: string | null;
  direct_invite_company_id?: string | null;
  paymentTerms?: string;
  cargo?: { type: string; quantity: number; notes: string };
  loadDetailSummary?: LoadDetailItem[];
}

/**
 * Input shape accepted by jobToRow — a superset of JobRow that includes all
 * fields present on the Supabase-mapped admin Job object.
 * Exported so page.tsx can use it as a typed constraint without maintaining a
 * duplicate interface.
 */
export interface AdminJobFields {
  id: string;
  jobRef: string;
  status: string;
  client: { name: string; email: string; phone: string };
  pickup: { location: string; date: string; time: string; postcode?: string };
  delivery: { location: string; date: string; time: string; postcode?: string };
  vehicleType: string;
  distanceMiles: string;
  createdAt: string;
  updatedAt: string;
  exchange_visibility?: string | null;
  awarded_carrier_company_id?: string | null;
  direct_invite_company_id?: string | null;
  paymentTerms?: string;
  cargo?: { type: string; quantity: number; notes: string };
  loadDetailSummary?: LoadDetailItem[];
}

/**
 * Typed adapter — converts an AdminJobFields record to a JobRow without any
 * `as unknown as` coercion.  Every field is mapped explicitly so that contract
 * mismatches surface as compile-time errors rather than silent runtime bugs.
 */
export function jobToRow(job: AdminJobFields): JobRow {
  return {
    id: job.id,
    jobRef: job.jobRef,
    status: job.status,
    client: { name: job.client.name },
    pickup: {
      location: job.pickup.location,
      date: job.pickup.date,
      time: job.pickup.time,
      postcode: job.pickup.postcode,
    },
    delivery: {
      location: job.delivery.location,
      date: job.delivery.date,
      time: job.delivery.time,
      postcode: job.delivery.postcode,
    },
    vehicleType: job.vehicleType,
    distanceMiles: job.distanceMiles,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    exchange_visibility: job.exchange_visibility,
    awarded_carrier_company_id: job.awarded_carrier_company_id,
    direct_invite_company_id: job.direct_invite_company_id,
    paymentTerms: job.paymentTerms,
    cargo: job.cargo,
    loadDetailSummary: job.loadDetailSummary,
  };
}

/* ─── Pure eligibility / transition helpers (exported for unit testing) ─── */

/**
 * Direct Invite is only available when the job has not yet been awarded to a
 * carrier AND the exchange visibility is absent (null/undefined) or 'private'.
 * Public/exchange records must not be offered for direct invitation unless the
 * business rule explicitly changes.
 */
export function isDirectInviteEligible(
  job: Pick<JobRow, 'exchange_visibility' | 'awarded_carrier_company_id'>,
): boolean {
  return (
    !job.awarded_carrier_company_id &&
    (!job.exchange_visibility || job.exchange_visibility === 'private')
  );
}

/**
 * Returns the set of status values this job's current status may transition to
 * within the admin operations surface.  Only forward/terminal transitions that
 * do not require driver or carrier interaction are included.
 */
export const ALLOWED_STATUS_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  draft:     ['posted', 'cancelled'],
  posted:    ['cancelled'],
  allocated: ['cancelled'],
} as const;

export function allowedStatusTransitions(status: string): readonly string[] {
  return ALLOWED_STATUS_TRANSITIONS[status.toLowerCase()] ?? [];
}

export interface JobsKpiTile {
  label: string;
  status: string;
  count: number;
  /** XDrive palette accent colour */
  accent: string;
}

export interface JobsOperationalTableProps {
  /** All unfiltered jobs (for KPI counts) */
  jobs: JobRow[];
  /** Filtered + paginated jobs to render in table */
  filteredJobs: JobRow[];
  page: number;
  perPage: number;
  totalFiltered: number;
  onPageChange: (page: number) => void;
  /** Filter state */
  searchTerm: string;
  statusFilter: string;
  pickupFilter: string;
  deliveryFilter: string;
  dateFilter: string;
  customerFilter: string;
  /** Filter setters */
  onSearchTermChange: (v: string) => void;
  onStatusFilterChange: (v: string) => void;
  onPickupFilterChange: (v: string) => void;
  onDeliveryFilterChange: (v: string) => void;
  onDateFilterChange: (v: string) => void;
  onCustomerFilterChange: (v: string) => void;
  /** Actions */
  onNewJob: () => void;
  onViewJob: (id: string) => void;
  onDirectInvite: (job: JobRow) => void;
  /**
   * Transition the job to a new status.  Called with the job id and the target
   * status string.  The parent is responsible for the Supabase update, company
   * scoping, and re-fetching the jobs list on success.
   */
  onStatusChange: (id: string, newStatus: string) => void;
  /**
   * Explicitly post a draft job to the marketplace.  Only called for jobs with
   * status === 'draft'.  Parent applies the Supabase update and re-fetches.
   */
  onPostJob: (id: string) => void;
  newJobDisabled?: boolean;
  /** Alert content (pass null to suppress) */
  companyError?: string | null;
  dbError?: string | null;
  hasSupabaseSession?: boolean;
  onRetryCompany?: () => void;
  onDismissDbError?: () => void;
}

/* ─── Status → badge colour mapping ─────────────────────────────────────── */

const STATUS_STYLES: Record<string, CSSProperties> = {
  draft:       { background: '#FFFBEB', borderColor: '#FCD34D', color: '#B76E00' },
  received:    { background: '#FFFBEB', borderColor: '#FCD34D', color: '#B76E00' },
  posted:      { background: '#EFF6FF', borderColor: '#BFDBFE', color: '#1D57D8' },
  allocated:   { background: '#F5F3FF', borderColor: '#DDD6FE', color: '#6D28D9' },
  accepted:    { background: '#F0FDF4', borderColor: '#BBF7D0', color: '#198754' },
  collected:   { background: '#F0FDF4', borderColor: '#BBF7D0', color: '#198754' },
  in_transit:  { background: '#EFF6FF', borderColor: '#BFDBFE', color: '#1D57D8' },
  delivered:   { background: '#F0FDF4', borderColor: '#BBF7D0', color: '#198754' },
  completed:   { background: '#F0FDF4', borderColor: '#BBF7D0', color: '#198754' },
  cancelled:   { background: '#FEF2F2', borderColor: '#FCA5A5', color: '#C62828' },
  disputed:    { background: '#FEF2F2', borderColor: '#FCA5A5', color: '#C62828' },
  exception:   { background: '#FEF2F2', borderColor: '#FCA5A5', color: '#C62828' },
};

function statusStyle(status: string): CSSProperties {
  return STATUS_STYLES[status.toLowerCase()] ?? { background: '#F4F6F8', borderColor: '#D8DEE8', color: '#1A1F2B' };
}

function statusLabel(status: string): string {
  if (status === 'draft') return 'Received';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── Date formatting ────────────────────────────────────────────────────── */

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/* ─── Status tabs definition ─────────────────────────────────────────────── */

const STATUS_TABS = [
  { label: 'All',        value: 'All' },
  { label: 'Received',   value: 'draft' },
  { label: 'Posted',     value: 'posted' },
  { label: 'Allocated',  value: 'allocated' },
  { label: 'In Transit', value: 'in_transit' },
  { label: 'Delivered',  value: 'delivered' },
  { label: 'Completed',  value: 'completed' },
  { label: 'Cancelled',  value: 'cancelled' },
];

/* ─── KPI tiles ──────────────────────────────────────────────────────────── */

const DEFAULT_KPI_TILES: Array<{ label: string; value: string; accent: string }> = [
  { label: 'All Jobs',   value: 'All',       accent: '#1D57D8' },
  { label: 'Received',   value: 'draft',     accent: '#B76E00' },
  { label: 'Posted',     value: 'posted',    accent: '#1D57D8' },
  { label: 'Allocated',  value: 'allocated', accent: '#6D28D9' },
  { label: 'Delivered',  value: 'delivered', accent: '#198754' },
  { label: 'Cancelled',  value: 'cancelled', accent: '#C62828' },
];

/* ─── Component ──────────────────────────────────────────────────────────── */

export function JobsOperationalTable({
  jobs,
  filteredJobs,
  page,
  perPage,
  totalFiltered,
  onPageChange,
  searchTerm,
  statusFilter,
  pickupFilter,
  deliveryFilter,
  dateFilter,
  customerFilter,
  onSearchTermChange,
  onStatusFilterChange,
  onPickupFilterChange,
  onDeliveryFilterChange,
  onDateFilterChange,
  onCustomerFilterChange,
  onNewJob,
  onViewJob,
  onDirectInvite,
  onStatusChange,
  onPostJob,
  newJobDisabled = false,
  companyError,
  dbError,
  hasSupabaseSession,
  onRetryCompany,
  onDismissDbError,
}: JobsOperationalTableProps) {
  const totalPages = Math.ceil(totalFiltered / perPage);
  const start = page * perPage + 1;
  const end = Math.min((page + 1) * perPage, totalFiltered);

  function getCount(status: string): number {
    if (status === 'All') return jobs.length;
    return jobs.filter((j) => j.status.toLowerCase() === status.toLowerCase()).length;
  }

  return (
    <div className={styles.jobsPageShell}>

      {/* ── Page header ────────────────────────────────────────────────────
       * Section 4: title 20px/26px/600; subtitle 12px/16px; margin-bottom 8px
       */}
      <div className={styles.jobsPageHeader}>
        <div className={styles.jobsPageHeaderText}>
          <h1 className={styles.jobsPageTitle}>Jobs</h1>
          <p className={styles.jobsPageSubtitle}>
            Assign, track and complete operational work.
          </p>
        </div>
        <div className={styles.jobsPageHeaderActions}>
          <button
            type="button"
            className={styles.jobsNewBtn}
            onClick={onNewJob}
            disabled={newJobDisabled}
            aria-label="Create new job"
          >
            + New Job
          </button>
        </div>
      </div>

      {/* ── Alert banners (compact — not marketing boxes) ─────────────── */}
      {hasSupabaseSession === false && (
        <div className={`${styles.jobsAlertBanner} ${styles.jobsAlertBannerInfo}`} role="status">
          Local session — changes will not sync until you sign in.
        </div>
      )}
      {companyError && (
        <div className={`${styles.jobsAlertBanner} ${styles.jobsAlertBannerWarning}`} role="alert">
          <span>{companyError}</span>
          {onRetryCompany && (
            <button type="button" className={styles.jobsAlertBannerBtn} onClick={onRetryCompany}>
              Retry
            </button>
          )}
        </div>
      )}
      {dbError && (
        <div className={`${styles.jobsAlertBanner} ${styles.jobsAlertBannerDanger}`} role="alert">
          <span>{dbError}</span>
          {onDismissDbError && (
            <button type="button" className={styles.jobsAlertBannerBtn} onClick={onDismissDbError} aria-label="Dismiss error">
              ×
            </button>
          )}
        </div>
      )}

      {/* ── KPI strip ──────────────────────────────────────────────────────
       * Section 8: 72px tiles; 8px gap; max 6; label 11/14/600; value 22/26/700
       */}
      <div className={styles.exchangeKpiStrip} role="region" aria-label="Operational key performance indicators">
        {DEFAULT_KPI_TILES.map(({ label, value: tileStatus, accent }) => (
          <button
            key={tileStatus}
            type="button"
            aria-label={`Filter by ${label}`}
            aria-pressed={statusFilter === tileStatus}
            onClick={() => { onStatusFilterChange(tileStatus); onPageChange(0); }}
            className={styles.kpiTile}
            style={{ '--xdrive-kpi-accent': accent, cursor: 'pointer', border: statusFilter === tileStatus ? `2px solid ${accent}` : undefined } as CSSProperties}
          >
            <span className={styles.kpiTileLabel}>{label}</span>
            <span className={styles.kpiTileValue}>{getCount(tileStatus)}</span>
          </button>
        ))}
      </div>

      {/* ── Status tabs ────────────────────────────────────────────────────
       * Section 12: 36px; 12px h-padding; 12px/600; 2px active underline
       */}
      <div className={styles.statusTabs} role="tablist" aria-label="Filter jobs by status">
        {STATUS_TABS.map(({ label, value: tabValue }) => {
          const isActive = statusFilter === tabValue;
          const count = getCount(tabValue);
          return (
            <button
              key={tabValue}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`${styles.statusTab} ${isActive ? styles.statusTabActive : ''}`}
              onClick={() => { onStatusFilterChange(tabValue); onPageChange(0); }}
            >
              {label}
              {count > 0 && (
                <span className={styles.statusTabBadge}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────────
       * Section 5: 40px height; 8px h-pad; 4px v-pad; controls 32px; gaps 8px
       */}
      <div className={styles.jobsToolbar} role="search" aria-label="Filter jobs">
        <input
          type="search"
          placeholder="Search ref, client, location…"
          value={searchTerm}
          onChange={(e) => { onSearchTermChange(e.target.value); onPageChange(0); }}
          className={`${styles.jobsToolbarInput} ${styles.jobsToolbarSearch}`}
          aria-label="Search jobs"
        />
        <select
          value={statusFilter}
          onChange={(e) => { onStatusFilterChange(e.target.value); onPageChange(0); }}
          className={`${styles.jobsToolbarInput} ${styles.jobsToolbarStatus}`}
          aria-label="Filter by status"
        >
          <option value="All">All statuses</option>
          {STATUS_TABS.filter((t) => t.value !== 'All').map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Pickup location"
          value={pickupFilter}
          onChange={(e) => { onPickupFilterChange(e.target.value); onPageChange(0); }}
          className={`${styles.jobsToolbarInput} ${styles.jobsToolbarStatus}`}
          aria-label="Filter by pickup location"
          style={{ width: 132 }}
        />
        <input
          type="text"
          placeholder="Delivery location"
          value={deliveryFilter}
          onChange={(e) => { onDeliveryFilterChange(e.target.value); onPageChange(0); }}
          className={`${styles.jobsToolbarInput} ${styles.jobsToolbarStatus}`}
          aria-label="Filter by delivery location"
          style={{ width: 132 }}
        />
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => { onDateFilterChange(e.target.value); onPageChange(0); }}
          className={`${styles.jobsToolbarInput} ${styles.jobsToolbarDate}`}
          aria-label="Filter by date"
        />
        <input
          type="text"
          placeholder="Customer"
          value={customerFilter}
          onChange={(e) => { onCustomerFilterChange(e.target.value); onPageChange(0); }}
          className={`${styles.jobsToolbarInput}`}
          aria-label="Filter by customer"
          style={{ width: 120 }}
        />
        <div className={styles.jobsToolbarSpacer} />
        {totalFiltered > 0 && (
          <span className={styles.jobsToolbarCount} aria-live="polite">
            {totalFiltered.toLocaleString('en-GB')} result{totalFiltered !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────
       * Section 9 + 10: header 36px; rows 42px; column widths per contract.
       */}
      <div className={styles.operationalTableContainer}>
        <div className={styles.operationalTableScroll}>
          <table
            className={`${styles.operationalTable} ${styles.operationalTableMinWidth}`}
            style={{ '--xdrive-operational-table-min-width': '1060px' } as CSSProperties}
          >
            <caption className={styles.operationalTableCaption}>Jobs list</caption>
            <colgroup>
              {/* Section 10 column widths */}
              <col style={{ width: 92 }} />   {/* status/priority */}
              <col style={{ width: 110 }} />  {/* job/reference */}
              <col />                          {/* route — minmax(260px,1.6fr) */}
              <col style={{ width: 150 }} />  {/* pickup */}
              <col style={{ width: 150 }} />  {/* delivery */}
              <col style={{ width: 110 }} />  {/* vehicle */}
              <col style={{ width: 150 }} />  {/* customer */}
              <col style={{ width: 96 }} />   {/* distance/quote */}
              <col style={{ width: 92 }} />   {/* actions */}
            </colgroup>
            <thead>
              <tr className={styles.operationalTableHeaderRow}>
                <th scope="col" className={styles.operationalTableHeadCell}>Status</th>
                <th scope="col" className={styles.operationalTableHeadCell}>Ref</th>
                <th scope="col" className={styles.operationalTableHeadCell}>Route</th>
                <th scope="col" className={styles.operationalTableHeadCell}>Pickup</th>
                <th scope="col" className={styles.operationalTableHeadCell}>Delivery</th>
                <th scope="col" className={styles.operationalTableHeadCell}>Vehicle</th>
                <th scope="col" className={styles.operationalTableHeadCell}>Customer</th>
                <th scope="col" className={`${styles.operationalTableHeadCell} ${styles.operationalTableActionHeadCell}`}>Dist.</th>
                <th scope="col" className={`${styles.operationalTableHeadCell} ${styles.operationalTableActionHeadCell}`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className={styles.operationalTableCell}
                    style={{ textAlign: 'center', height: 64, color: '#64748B', fontSize: 12 }}
                  >
                    No jobs match the current filters.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => {
                  const s = statusStyle(job.status);
                  return (
                    <tr
                      key={job.id}
                      className={styles.operationalTableRow}
                      style={{ cursor: 'pointer' }}
                      onClick={() => onViewJob(job.id)}
                    >
                      {/* Status/priority — 92px */}
                      <td className={styles.operationalTableCell}>
                        <span className={styles.jobsStatusBadge} style={s}>
                          {statusLabel(job.status)}
                        </span>
                      </td>

                      {/* Job/reference — 110px */}
                      <td className={styles.operationalTableCell}>
                        <span style={{ fontWeight: 600, color: '#1D57D8', fontSize: '12.5px' }}>
                          {job.jobRef}
                        </span>
                      </td>

                      {/* Route — minmax(260px,1.6fr) */}
                      <td className={styles.operationalTableCell}>
                        <div className={styles.jobsRouteCell}>
                          <span className={styles.jobsRouteOrigin}>
                            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '45%', display: 'inline-block' }}>
                              {job.pickup.location || '—'}
                            </span>
                            {job.pickup.postcode && (
                              <span className={styles.jobsRoutePostcode}>{job.pickup.postcode}</span>
                            )}
                          </span>
                          <span className={styles.jobsRouteDest}>
                            <span className={styles.jobsRouteArrow} aria-hidden="true">↓</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75%', display: 'inline-block' }}>
                              {job.delivery.location || '—'}
                            </span>
                            {job.delivery.postcode && (
                              <span className={styles.jobsRoutePostcode}>{job.delivery.postcode}</span>
                            )}
                          </span>
                        </div>
                      </td>

                      {/* Pickup — 150px */}
                      <td className={styles.operationalTableCell}>
                        <div style={{ fontSize: '12.5px', lineHeight: '17px' }}>{fmtDate(job.pickup.date)}</div>
                        {job.pickup.time && job.pickup.time !== 'ASAP' && (
                          <div style={{ fontSize: '11px', lineHeight: '14px', color: '#64748B' }}>{job.pickup.time}</div>
                        )}
                        {job.pickup.time === 'ASAP' && (
                          <div style={{ fontSize: '11px', lineHeight: '14px', color: '#B76E00', fontWeight: 600 }}>ASAP</div>
                        )}
                      </td>

                      {/* Delivery — 150px */}
                      <td className={styles.operationalTableCell}>
                        <div style={{ fontSize: '12.5px', lineHeight: '17px' }}>{fmtDate(job.delivery.date)}</div>
                        {job.delivery.time && job.delivery.time !== 'ASAP' && (
                          <div style={{ fontSize: '11px', lineHeight: '14px', color: '#64748B' }}>{job.delivery.time}</div>
                        )}
                        {job.delivery.time === 'ASAP' && (
                          <div style={{ fontSize: '11px', lineHeight: '14px', color: '#B76E00', fontWeight: 600 }}>ASAP</div>
                        )}
                      </td>

                      {/* Vehicle — 110px */}
                      <td className={styles.operationalTableCell} style={{ fontSize: '12px', color: '#64748B', textTransform: 'capitalize' }}>
                        {job.vehicleType || '—'}
                      </td>

                      {/* Customer — 150px */}
                      <td className={styles.operationalTableCell} style={{ fontSize: '12.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                        {job.client.name || '—'}
                      </td>

                      {/* Distance — 96px */}
                      <td className={`${styles.operationalTableCell} ${styles.operationalTableActionCell}`} style={{ fontSize: '12px', color: '#64748B' }}>
                        {job.distanceMiles || '—'}
                      </td>

                      {/* Actions — 92px
                       * Compact action cell:
                       *   • "View" always present
                       *   • "Post" for draft jobs (primary workflow action)
                       *   • Status select for jobs with allowed transitions
                       *   • "Invite" only for private/unawarded jobs
                       */}
                      <td className={`${styles.operationalTableCell} ${styles.operationalTableActionCell}`} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.jobsActionCell}>
                          <button
                            type="button"
                            className={styles.jobsActionBtn}
                            onClick={() => onViewJob(job.id)}
                            aria-label={`View job ${job.jobRef}`}
                          >
                            View
                          </button>
                          {job.status === 'draft' && (
                            <button
                              type="button"
                              className={styles.jobsActionBtn}
                              style={{ background: '#0B2F6B', color: '#ffffff', borderColor: '#0B2F6B' }}
                              onClick={() => onPostJob(job.id)}
                              aria-label={`Post job ${job.jobRef} to marketplace`}
                            >
                              Post
                            </button>
                          )}
                          {job.status !== 'draft' && allowedStatusTransitions(job.status).length > 0 && (
                            <select
                              className={styles.jobsActionBtn}
                              defaultValue=""
                              aria-label={`Update status for job ${job.jobRef}`}
                              onChange={(e) => {
                                const next = e.target.value;
                                if (next) {
                                  onStatusChange(job.id, next);
                                  e.target.value = '';
                                }
                              }}
                              style={{ paddingRight: 4 }}
                            >
                              <option value="" disabled>Update…</option>
                              {allowedStatusTransitions(job.status).map((s) => (
                                <option key={s} value={s}>{statusLabel(s)}</option>
                              ))}
                            </select>
                          )}
                          {isDirectInviteEligible(job) && (
                            <button
                              type="button"
                              className={styles.jobsActionBtn}
                              onClick={() => onDirectInvite(job)}
                              aria-label={`Invite carrier for job ${job.jobRef}`}
                            >
                              Invite
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ──────────────────────────────────────────────────
         * Section 9: bar 36px; button 28×28px; gap 4px.
         */}
        {totalFiltered > perPage && (
          <div className={styles.operationalPagination} aria-label="Pagination">
            <span className={styles.operationalPaginationInfo}>
              {start}–{end} of {totalFiltered.toLocaleString('en-GB')}
            </span>
            <div className={styles.operationalPaginationButtons}>
              <button
                type="button"
                className={styles.operationalPaginationBtn}
                onClick={() => onPageChange(0)}
                disabled={page === 0}
                aria-label="First page"
              >
                «
              </button>
              <button
                type="button"
                className={styles.operationalPaginationBtn}
                onClick={() => onPageChange(Math.max(0, page - 1))}
                disabled={page === 0}
                aria-label="Previous page"
              >
                ‹
              </button>
              <span style={{ fontSize: 12, color: '#1A1F2B', padding: '0 4px' }}>
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                className={styles.operationalPaginationBtn}
                onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                aria-label="Next page"
              >
                ›
              </button>
              <button
                type="button"
                className={styles.operationalPaginationBtn}
                onClick={() => onPageChange(totalPages - 1)}
                disabled={page >= totalPages - 1}
                aria-label="Last page"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
