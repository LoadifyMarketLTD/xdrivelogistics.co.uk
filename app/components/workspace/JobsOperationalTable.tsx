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

import { Fragment, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import styles from './WorkspaceUI.module.css';
import { OperationalExpandAllControl } from './OperationalExpandAllControl';

/*
 * Business logic is owned by the canonical contract module.
 * Imported for local use and re-exported so existing imports from this file
 * continue to resolve without changes to callers.
 */
import {
  allowedStatusTransitions,
  isDirectInviteEligible,
  JOBS_STATUS_FILTER_OPTIONS,
  resolveJobStatusFilter,
  type JobRow,
  type JobStatusFilterValue,
} from '../../../lib/jobs/jobOperationalContract';

export {
  type JobRow,
  type AdminJobFields,
  jobToRow,
  ALLOWED_STATUS_TRANSITIONS,
  allowedStatusTransitions,
  isDirectInviteEligible,
  filterJobsByDriver,
} from '../../../lib/jobs/jobOperationalContract';

export interface JobsOperationalTableProps {
  /** Filtered + paginated jobs to render in table */
  filteredJobs: JobRow[];
  page: number;
  perPage: number;
  totalFiltered: number;
  onPageChange: (page: number) => void;
  /** Filter state */
  searchTerm: string;
  statusFilter: JobStatusFilterValue;
  pickupFilter: string;
  deliveryFilter: string;
  dateFilter: string;
  customerFilter: string;
  /** Driver filter — empty string means "all drivers" */
  driverFilter: string;
  /** Driver filter setter */
  onDriverFilterChange: (v: string) => void;
  /** Company drivers available for the driver filter dropdown */
  drivers: Array<{ id: string; displayName: string }>;
  /** Filter setters */
  onSearchTermChange: (v: string) => void;
  onStatusFilterChange: (v: JobStatusFilterValue) => void;
  onPickupFilterChange: (v: string) => void;
  onDeliveryFilterChange: (v: string) => void;
  onDateFilterChange: (v: string) => void;
  onCustomerFilterChange: (v: string) => void;
  /** Actions */
  onNewJob: () => void;
  onViewJob: (id: string) => void;
  onDirectInvite: (job: JobRow) => void;
  /**
   * Transition the job to a new status. Called with the job id and target
   * status string. Parent owns the Supabase update and company scoping.
   */
  onStatusChange: (id: string, newStatus: string) => void;
  /** Explicitly post a draft job to the marketplace. */
  onPostJob: (id: string) => void;
  newJobDisabled?: boolean;
  companyError?: string | null;
  dbError?: string | null;
  hasSupabaseSession?: boolean;
  onRetryCompany?: () => void;
  onDismissDbError?: () => void;
}

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

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function JobsOperationalTable({
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
  driverFilter,
  onDriverFilterChange,
  drivers,
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
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const allVisibleExpanded = filteredJobs.length > 0 && filteredJobs.every((job) => expandedRows.has(job.id));

  useEffect(() => {
    const syncViewport = () => setIsMobileViewport(window.innerWidth <= 480);
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  function toggleRowExpanded(id: string) {
    setExpandedRows((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleExpandAll() {
    setExpandedRows((previous) => {
      const next = new Set(previous);
      for (const job of filteredJobs) {
        if (allVisibleExpanded) next.delete(job.id);
        else next.add(job.id);
      }
      return next;
    });
  }

  function resolveDriverName(driverId: string | null | undefined): string {
    if (!driverId) return 'Unassigned';
    return drivers.find((d) => d.id === driverId)?.displayName ?? driverId.slice(0, 8) + '…';
  }

  return (
    <div className={styles.jobsPageShell}>
      <div className={styles.jobsPageHeader}>
        <div className={styles.jobsPageHeaderText}>
          <h1 className={styles.jobsPageTitle}>Jobs</h1>
          <p className={styles.jobsPageSubtitle}>Assign, track and complete operational work.</p>
        </div>
        <div className={styles.jobsPageHeaderActions}>
          <button type="button" className={styles.jobsNewBtn} onClick={onNewJob} disabled={newJobDisabled} aria-label="Create new job">
            + New Job
          </button>
        </div>
      </div>

      {hasSupabaseSession === false && (
        <div className={`${styles.jobsAlertBanner} ${styles.jobsAlertBannerInfo}`} role="status">
          Local session — changes will not sync until you sign in.
        </div>
      )}
      {companyError && (
        <div className={`${styles.jobsAlertBanner} ${styles.jobsAlertBannerWarning}`} role="alert">
          <span>{companyError}</span>
          {onRetryCompany && <button type="button" className={styles.jobsAlertBannerBtn} onClick={onRetryCompany}>Retry</button>}
        </div>
      )}
      {dbError && (
        <div className={`${styles.jobsAlertBanner} ${styles.jobsAlertBannerDanger}`} role="alert">
          <span>{dbError}</span>
          {onDismissDbError && (
            <button type="button" className={styles.jobsAlertBannerBtn} onClick={onDismissDbError} aria-label="Dismiss error">×</button>
          )}
        </div>
      )}

      <div className={styles.jobsStatusTabs} role="tablist" aria-label="Filter jobs by status">
        {JOBS_STATUS_FILTER_OPTIONS.map((tab) => {
          const selected = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`${styles.jobsStatusTab} ${selected ? styles.jobsStatusTabActive : ''}`}
              onClick={() => { onStatusFilterChange(tab.value); onPageChange(0); }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className={styles.jobsToolbar} role="search" aria-label="Filter jobs">
        <input type="search" placeholder="Search ref, client, location…" value={searchTerm} onChange={(e) => { onSearchTermChange(e.target.value); onPageChange(0); }} className={`${styles.jobsToolbarInput} ${styles.jobsToolbarSearch}`} aria-label="Search jobs" />
        <select value={statusFilter} onChange={(e) => { onStatusFilterChange(resolveJobStatusFilter(e.target.value)); onPageChange(0); }} className={`${styles.jobsToolbarInput} ${styles.jobsToolbarStatus}`} aria-label="Filter by status">
          <option value="All">All statuses</option>
          {JOBS_STATUS_FILTER_OPTIONS.filter((t) => t.value !== 'All').map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input type="text" placeholder="Pickup location" value={pickupFilter} onChange={(e) => { onPickupFilterChange(e.target.value); onPageChange(0); }} className={`${styles.jobsToolbarInput} ${styles.jobsToolbarPickup}`} aria-label="Filter by pickup location" />
        <input type="text" placeholder="Delivery location" value={deliveryFilter} onChange={(e) => { onDeliveryFilterChange(e.target.value); onPageChange(0); }} className={`${styles.jobsToolbarInput} ${styles.jobsToolbarDelivery}`} aria-label="Filter by delivery location" />
        <input type="date" value={dateFilter} onChange={(e) => { onDateFilterChange(e.target.value); onPageChange(0); }} className={`${styles.jobsToolbarInput} ${styles.jobsToolbarDate}`} aria-label="Filter by date" />
        <input type="text" placeholder="Customer" value={customerFilter} onChange={(e) => { onCustomerFilterChange(e.target.value); onPageChange(0); }} className={`${styles.jobsToolbarInput} ${styles.jobsToolbarCustomer}`} aria-label="Filter by customer" />
        {drivers.length > 0 && (
          <select value={driverFilter} onChange={(e) => { onDriverFilterChange(e.target.value); onPageChange(0); }} className={`${styles.jobsToolbarInput} ${styles.jobsToolbarStatus}`} aria-label="Filter by assigned driver">
            <option value="">All drivers</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.displayName}</option>)}
          </select>
        )}
        <div className={styles.jobsToolbarSpacer} />
        {totalFiltered > 0 && <span className={styles.jobsToolbarCount} aria-live="polite">{totalFiltered.toLocaleString('en-GB')} result{totalFiltered !== 1 ? 's' : ''}</span>}
        <OperationalExpandAllControl expanded={allVisibleExpanded} disabled={!filteredJobs.length} onToggle={toggleExpandAll} noun="jobs" />
      </div>

      <div className={styles.jobsTableSection} data-testid="jobs-desktop-table">
      {!isMobileViewport && (
      <div className={styles.operationalTableContainer}>
        <div className={styles.operationalTableScroll}>
          <table className={`${styles.operationalTable} ${styles.operationalTableMinWidth} ${styles.jobsOperationalTable}`}>
          <caption className={styles.operationalTableCaption}>Jobs list</caption>
          <colgroup><col className={styles.jobsColStatusWidth} /><col className={styles.jobsColRefWidth} /><col /><col className={styles.jobsColPickupWidth} /><col className={styles.jobsColDeliveryWidth} /><col className={styles.jobsColVehicleWidth} /><col className={styles.jobsColCustomerWidth} /><col className={styles.jobsColDistanceWidth} /><col className={styles.jobsColActionsWidth} /></colgroup>
            <thead>
              <tr className={styles.operationalTableHeaderRow}>
                <th scope="col" className={styles.operationalTableHeadCell}>Status</th>
                <th scope="col" className={styles.operationalTableHeadCell}>Ref</th>
                <th scope="col" className={styles.operationalTableHeadCell}>Route</th>
                <th scope="col" className={styles.operationalTableHeadCell}>Pickup</th>
                <th scope="col" className={styles.operationalTableHeadCell}>Delivery</th>
                <th scope="col" className={styles.operationalTableHeadCell}>Vehicle</th>
                <th scope="col" className={`${styles.operationalTableHeadCell} ${styles.jobsColCustomer}`}>Customer</th>
                <th scope="col" className={`${styles.operationalTableHeadCell} ${styles.operationalTableActionHeadCell} ${styles.jobsColDistance}`}>Dist.</th>
                <th scope="col" className={`${styles.operationalTableHeadCell} ${styles.operationalTableActionHeadCell}`}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr><td colSpan={9} className={`${styles.operationalTableCell} ${styles.jobsEmptyTableCell}`}>No jobs match the current filters.</td></tr>
              ) : (
                filteredJobs.map((job) => {
                  const s = statusStyle(job.status);
                  const isExpanded = expandedRows.has(job.id);
                  return (
                    <Fragment key={job.id}>
                      <tr className={`${styles.operationalTableRow} ${styles.jobsOperationalRow}`} onClick={() => onViewJob(job.id)}>
                        <td className={styles.operationalTableCell}>
                          <span className={styles.jobsStatusBadge} style={s}>{statusLabel(job.status)}</span>
                          {job.exchange_visibility && job.exchange_visibility !== 'private' && <div className={styles.jobsStatusMeta}>{job.exchange_visibility}</div>}
                        </td>
                        <td className={styles.operationalTableCell}>
                          <span className={styles.jobsRefValue}>{job.jobRef}</span>
                          {job.createdAt && <div className={styles.jobsSubMeta}>{fmtDate(job.createdAt)}</div>}
                        </td>
                        <td className={styles.operationalTableCell}>
                          <div className={styles.jobsRouteCell}>
                            <span className={styles.jobsRouteOrigin}>
                              <span className={styles.jobsRouteOriginPrimary}>{job.pickup.location || '—'}</span>
                              {job.pickup.postcode && <span className={styles.jobsRoutePostcode}>{job.pickup.postcode}</span>}
                            </span>
                            <span className={styles.jobsRouteDest}>
                              <span className={styles.jobsRouteArrow} aria-hidden="true">↓</span>
                              <span className={styles.jobsRouteDestPrimary}>{job.delivery.location || '—'}</span>
                              {job.delivery.postcode && <span className={styles.jobsRoutePostcode}>{job.delivery.postcode}</span>}
                            </span>
                          </div>
                        </td>
                        <td className={styles.operationalTableCell}>
                          <div className={styles.jobsPrimaryDate}>{fmtDate(job.pickup.date)}</div>
                          {job.pickup.time && job.pickup.time !== 'ASAP' && <div className={styles.jobsSubMeta}>{job.pickup.time}</div>}
                          {job.pickup.time === 'ASAP' && <div className={styles.jobsAsapMeta}>ASAP</div>}
                        </td>
                        <td className={styles.operationalTableCell}>
                          <div className={styles.jobsPrimaryDate}>{fmtDate(job.delivery.date)}</div>
                          {job.delivery.time && job.delivery.time !== 'ASAP' && <div className={styles.jobsSubMeta}>{job.delivery.time}</div>}
                          {job.delivery.time === 'ASAP' && <div className={styles.jobsAsapMeta}>ASAP</div>}
                        </td>
                        <td className={`${styles.operationalTableCell} ${styles.jobsVehicleCell}`}>
                          <div>{job.vehicleType || '—'}</div>
                          {job.cargo?.type && <div className={styles.jobsVehicleMeta}>{job.cargo.quantity > 0 ? `${job.cargo.quantity}× ` : ''}{job.cargo.type}</div>}
                        </td>
                        <td className={`${styles.operationalTableCell} ${styles.jobsColCustomer} ${styles.jobsCustomerCell}`}>
                          <div className={styles.jobsCellEllipsis}>{job.client.name || '—'}</div>
                          {job.clientPhone && <div className={`${styles.jobsSubMeta} ${styles.jobsCellEllipsis}`}>{job.clientPhone}</div>}
                        </td>
                        <td className={`${styles.operationalTableCell} ${styles.operationalTableActionCell} ${styles.jobsColDistance} ${styles.jobsDistanceCell}`}>{job.distanceMiles || '—'}</td>
                        <td className={`${styles.operationalTableCell} ${styles.operationalTableActionCell}`} onClick={(e) => e.stopPropagation()}>
                          <div className={styles.jobsActionCell}>
                            <button type="button" className={styles.jobsExpandBtn} onClick={() => toggleRowExpanded(job.id)} aria-label={isExpanded ? `Collapse details for job ${job.jobRef}` : `Expand details for job ${job.jobRef}`} aria-expanded={isExpanded}>{isExpanded ? '▲' : '▼'}</button>
                            <button type="button" className={styles.jobsActionBtn} onClick={() => onViewJob(job.id)} aria-label={`View job ${job.jobRef}`}>View</button>
                            {job.status === 'draft' && <button type="button" className={`${styles.jobsActionBtn} ${styles.jobsActionBtnPrimary}`} onClick={() => onPostJob(job.id)} aria-label={`Post job ${job.jobRef} to marketplace`}>Post</button>}
                            {job.status !== 'draft' && allowedStatusTransitions(job.status).length > 0 && (
                              <select className={`${styles.jobsActionBtn} ${styles.jobsActionSelect}`} defaultValue="" aria-label={`Update status for job ${job.jobRef}`} onChange={(e) => { const next = e.target.value; if (next) { onStatusChange(job.id, next); e.target.value = ''; } }}>
                                <option value="" disabled>Update…</option>
                                {allowedStatusTransitions(job.status).map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                              </select>
                            )}
                            {isDirectInviteEligible(job) && <button type="button" className={styles.jobsActionBtn} onClick={() => onDirectInvite(job)} aria-label={`Invite carrier for job ${job.jobRef}`}>Invite</button>}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${job.id}-detail`} className={styles.operationalTableDetailRow}>
                          <td colSpan={9} className={styles.operationalTableDetailCell}>
                            <div className={styles.operationalJobDetailGrid}>
                              <div className={styles.operationalJobDetailItem}><span className={styles.operationalJobDetailLabel}>Driver</span><span>{resolveDriverName(job.assignedDriverId)}</span></div>
                              {job.clientEmail && <div className={styles.operationalJobDetailItem}><span className={styles.operationalJobDetailLabel}>Client email</span><span>{job.clientEmail}</span></div>}
                              {job.paymentTerms && <div className={styles.operationalJobDetailItem}><span className={styles.operationalJobDetailLabel}>Payment terms</span><span>{job.paymentTerms}</span></div>}
                              {job.awarded_carrier_company_id && <div className={styles.operationalJobDetailItem}><span className={styles.operationalJobDetailLabel}>Awarded carrier</span><span className={styles.jobsMonospaceMeta}>{job.awarded_carrier_company_id.slice(0, 13)}…</span></div>}
                              {job.exchange_visibility && <div className={styles.operationalJobDetailItem}><span className={styles.operationalJobDetailLabel}>Visibility</span><span className={styles.jobsCapitalizeText}>{job.exchange_visibility}</span></div>}
                              {job.cargo?.notes && <div className={styles.operationalJobDetailItem}><span className={styles.operationalJobDetailLabel}>Cargo notes</span><span>{job.cargo.notes}</span></div>}
                              {job.loadDetailSummary && job.loadDetailSummary.length > 0 && <div className={`${styles.operationalJobDetailItem} ${styles.operationalJobDetailWideItem}`}><span className={styles.operationalJobDetailLabel}>Load details</span><span>{job.loadDetailSummary.map((l) => `${l.label}: ${l.value}`).join(' · ')}</span></div>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalFiltered > perPage && (
          <div className={styles.operationalPagination} aria-label="Pagination">
            <span className={styles.operationalPaginationInfo}>{start}–{end} of {totalFiltered.toLocaleString('en-GB')}</span>
            <div className={styles.operationalPaginationButtons}>
              <button type="button" className={styles.operationalPaginationBtn} onClick={() => onPageChange(0)} disabled={page === 0} aria-label="First page">«</button>
              <button type="button" className={styles.operationalPaginationBtn} onClick={() => onPageChange(Math.max(0, page - 1))} disabled={page === 0} aria-label="Previous page">‹</button>
              <span className={styles.operationalPaginationCurrent}>{page + 1} / {totalPages}</span>
              <button type="button" className={styles.operationalPaginationBtn} onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} aria-label="Next page">›</button>
              <button type="button" className={styles.operationalPaginationBtn} onClick={() => onPageChange(totalPages - 1)} disabled={page >= totalPages - 1} aria-label="Last page">»</button>
            </div>
          </div>
        )}
      </div>
      )}
      </div>

      <div className={styles.jobsMobileCardList} data-testid="jobs-mobile-cards" aria-label="Jobs list">
        {isMobileViewport ? (
          filteredJobs.length === 0 ? (
            <div className={styles.jobsEmptyMobileState}>No jobs match the current filters.</div>
          ) : (
            filteredJobs.map((job) => {
              const s = statusStyle(job.status);
              const isExpanded = expandedRows.has(job.id);
              const transitions = allowedStatusTransitions(job.status);
              return (
                <div key={job.id} className={styles.jobsMobileCard} data-testid="jobs-mobile-card">
                  <div className={styles.jobsMobileCardHeader}>
                    <span className={styles.jobsMobileCardRef}>{job.jobRef}</span>
                    <span className={styles.jobsStatusBadge} style={s} aria-label={`Status: ${statusLabel(job.status)}`}>{statusLabel(job.status)}</span>
                    <button type="button" className={styles.jobsExpandBtn} onClick={() => toggleRowExpanded(job.id)} aria-label={isExpanded ? `Collapse details for job ${job.jobRef}` : `Expand details for job ${job.jobRef}`} aria-expanded={isExpanded}>{isExpanded ? '▲' : '▼'}</button>
                  </div>

                  <div className={styles.jobsMobileCardBody}>
                    <div className={styles.jobsMobileCardRoute}>
                      <div className={styles.jobsMobileCardRouteOrigin}>{job.pickup.location || '—'}{job.pickup.postcode && <span className={styles.jobsMobileRoutePostcode}>{job.pickup.postcode}</span>}</div>
                      <div className={styles.jobsMobileCardRouteDest}><span aria-hidden="true" className={styles.jobsMobileRouteArrow}>↓</span>{job.delivery.location || '—'}{job.delivery.postcode && <span className={styles.jobsMobileRouteMetaPostcode}>{job.delivery.postcode}</span>}</div>
                    </div>
                    <div className={styles.jobsMobileCardRow}><span className={styles.jobsMobileCardLabel}>Pickup</span><span>{fmtDate(job.pickup.date)}{job.pickup.time ? `, ${job.pickup.time}` : ''}</span></div>
                    <div className={styles.jobsMobileCardRow}><span className={styles.jobsMobileCardLabel}>Delivery</span><span>{fmtDate(job.delivery.date)}{job.delivery.time ? `, ${job.delivery.time}` : ''}</span></div>
                    <div className={styles.jobsMobileCardRow}><span className={styles.jobsMobileCardLabel}>Vehicle</span><span className={styles.jobsCapitalizeText}>{job.vehicleType || '—'}{job.cargo?.type ? ` · ${job.cargo.quantity > 0 ? `${job.cargo.quantity}× ` : ''}${job.cargo.type}` : ''}</span></div>
                    <div className={styles.jobsMobileCardRow}><span className={styles.jobsMobileCardLabel}>Driver</span><span>{resolveDriverName(job.assignedDriverId)}</span></div>
                    <div className={styles.jobsMobileCardRow}><span className={styles.jobsMobileCardLabel}>Customer</span><span>{job.client.name || '—'}</span></div>
                  </div>

                  {isExpanded && (
                    <div className={styles.jobsMobileCardDetail}>
                      {job.clientEmail && <div className={styles.jobsMobileCardRow}><span className={styles.jobsMobileCardLabel}>Email</span><span>{job.clientEmail}</span></div>}
                      {job.clientPhone && <div className={styles.jobsMobileCardRow}><span className={styles.jobsMobileCardLabel}>Phone</span><span>{job.clientPhone}</span></div>}
                      {job.paymentTerms && <div className={styles.jobsMobileCardRow}><span className={styles.jobsMobileCardLabel}>Payment</span><span>{job.paymentTerms}</span></div>}
                      {job.awarded_carrier_company_id && <div className={styles.jobsMobileCardRow}><span className={styles.jobsMobileCardLabel}>Carrier</span><span className={styles.jobsMonospaceMeta}>{job.awarded_carrier_company_id.slice(0, 13)}…</span></div>}
                      {job.exchange_visibility && <div className={styles.jobsMobileCardRow}><span className={styles.jobsMobileCardLabel}>Visibility</span><span className={styles.jobsCapitalizeText}>{job.exchange_visibility}</span></div>}
                      {job.cargo?.notes && <div className={styles.jobsMobileCardRow}><span className={styles.jobsMobileCardLabel}>Notes</span><span>{job.cargo.notes}</span></div>}
                      {job.loadDetailSummary && job.loadDetailSummary.length > 0 && <div className={styles.jobsMobileCardRow}><span className={styles.jobsMobileCardLabel}>Load</span><span>{job.loadDetailSummary.map((l) => `${l.label}: ${l.value}`).join(' · ')}</span></div>}
                      {job.distanceMiles && <div className={styles.jobsMobileCardRow}><span className={styles.jobsMobileCardLabel}>Distance</span><span>{job.distanceMiles}</span></div>}
                    </div>
                  )}

                  <div className={styles.jobsMobileCardActions}>
                    <button type="button" className={styles.jobsActionBtn} onClick={() => onViewJob(job.id)} aria-label={`View job ${job.jobRef}`}>View</button>
                    {job.status === 'draft' && <button type="button" className={`${styles.jobsActionBtn} ${styles.jobsActionBtnPrimary}`} onClick={() => onPostJob(job.id)} aria-label={`Post job ${job.jobRef} to marketplace`}>Post</button>}
                    {job.status !== 'draft' && transitions.length > 0 && (
                      <select className={styles.jobsActionBtn} defaultValue="" aria-label={`Update status for job ${job.jobRef}`} onChange={(e) => { const next = e.target.value; if (next) { onStatusChange(job.id, next); e.target.value = ''; } }}>
                        <option value="" disabled>Update…</option>
                        {transitions.map((t) => <option key={t} value={t}>{statusLabel(t)}</option>)}
                      </select>
                    )}
                    {isDirectInviteEligible(job) && <button type="button" className={styles.jobsActionBtn} onClick={() => onDirectInvite(job)} aria-label={`Invite carrier for job ${job.jobRef}`}>Invite</button>}
                  </div>
                </div>
              );
            })
          )
        ) : null}
      </div>
    </div>
  );
}
