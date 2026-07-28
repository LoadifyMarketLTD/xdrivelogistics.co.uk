/**
 * Canonical company workspace job status registry.
 *
 * Single source of truth for every job-status key, display label, semantic
 * tone and permitted workflow actions.  All admin/company workspace pages use
 * this registry — no page-local status maps, color lookups or ad-hoc string
 * comparisons.
 *
 * Values must match the Supabase public.job_status ENUM defined in
 * app/config/company.ts (JOB_STATUS).
 */

import type { CompanyJobAction } from './companyJobTypes';

// ── Semantic tone tokens ──────────────────────────────────────────────────────

export type StatusTone = 'grey' | 'blue' | 'orange' | 'green' | 'red' | 'purple';

// ── Workflow groups ───────────────────────────────────────────────────────────

export type StatusWorkflowGroup =
  | 'pre_market'    // draft
  | 'market'        // posted, quoted
  | 'awarded'       // awarded
  | 'operational'   // allocated, collected, in_transit
  | 'complete'      // delivered, invoiced, paid
  | 'exception';    // cancelled, disputed

// ── Status entry ──────────────────────────────────────────────────────────────

export interface JobStatusEntry {
  /** Canonical DB value (must match job_status ENUM). */
  key: string;
  /** Alternative/legacy values that should resolve to this entry. */
  aliases: string[];
  /** Customer-facing label (shown to the posting company). */
  customerLabel: string;
  /** Company-facing label (shown to the carrying/admin company). */
  companyLabel: string;
  /** Semantic tone for badge rendering. */
  tone: StatusTone;
  /** Broad workflow grouping. */
  workflowGroup: StatusWorkflowGroup;
  /** True when no further state changes are expected. */
  terminal: boolean;
  /**
   * Actions that are permitted from this status for a company_owner role.
   * Pages may further restrict based on context (e.g. only own jobs).
   */
  permittedActions: CompanyJobAction[];
}

// ── Registry definition ───────────────────────────────────────────────────────

const STATUS_REGISTRY: JobStatusEntry[] = [
  {
    key: 'draft',
    aliases: ['received', 'new'],
    customerLabel: 'Received',
    companyLabel: 'Draft / Received',
    tone: 'grey',
    workflowGroup: 'pre_market',
    terminal: false,
    permittedActions: ['view', 'edit', 'post_to_exchange', 'direct_invite', 'cancel'],
  },
  {
    key: 'posted',
    aliases: ['open', 'live'],
    customerLabel: 'Posted',
    companyLabel: 'Posted to Exchange',
    tone: 'blue',
    workflowGroup: 'market',
    terminal: false,
    permittedActions: ['view', 'direct_invite', 'withdraw_from_exchange', 'cancel'],
  },
  {
    key: 'quoted',
    aliases: ['bid_received'],
    customerLabel: 'Quoted',
    companyLabel: 'Quotes Received',
    tone: 'orange',
    workflowGroup: 'market',
    terminal: false,
    permittedActions: ['view', 'award', 'cancel'],
  },
  {
    key: 'awarded',
    aliases: ['accepted'],
    customerLabel: 'Awarded',
    companyLabel: 'Awarded',
    tone: 'purple',
    workflowGroup: 'awarded',
    terminal: false,
    permittedActions: ['view', 'reassign_driver', 'raise_dispute', 'cancel'],
  },
  {
    key: 'allocated',
    aliases: ['assigned', 'driver_assigned'],
    customerLabel: 'Allocated',
    companyLabel: 'Driver Allocated',
    tone: 'blue',
    workflowGroup: 'operational',
    terminal: false,
    permittedActions: ['view', 'reassign_driver', 'raise_dispute'],
  },
  {
    key: 'collected',
    aliases: ['picked_up'],
    customerLabel: 'Collected',
    companyLabel: 'Collected',
    tone: 'blue',
    workflowGroup: 'operational',
    terminal: false,
    permittedActions: ['view', 'raise_dispute'],
  },
  {
    key: 'in_transit',
    aliases: ['en_route', 'in_progress'],
    customerLabel: 'In Transit',
    companyLabel: 'In Transit',
    tone: 'blue',
    workflowGroup: 'operational',
    terminal: false,
    permittedActions: ['view', 'raise_dispute'],
  },
  {
    key: 'delivered',
    aliases: ['complete', 'completed', 'done'],
    customerLabel: 'Delivered',
    companyLabel: 'Delivered',
    tone: 'green',
    workflowGroup: 'complete',
    terminal: false,
    permittedActions: ['view', 'raise_dispute'],
  },
  {
    key: 'invoiced',
    aliases: ['invoice_raised'],
    customerLabel: 'Invoiced',
    companyLabel: 'Invoiced',
    tone: 'orange',
    workflowGroup: 'complete',
    terminal: false,
    permittedActions: ['view'],
  },
  {
    key: 'paid',
    aliases: ['payment_received'],
    customerLabel: 'Paid',
    companyLabel: 'Paid',
    tone: 'green',
    workflowGroup: 'complete',
    terminal: true,
    permittedActions: ['view'],
  },
  {
    key: 'cancelled',
    aliases: ['canceled', 'void', 'withdrawn'],
    customerLabel: 'Cancelled',
    companyLabel: 'Cancelled',
    tone: 'red',
    workflowGroup: 'exception',
    terminal: true,
    permittedActions: ['view'],
  },
  {
    key: 'disputed',
    aliases: ['in_dispute', 'dispute'],
    customerLabel: 'Disputed',
    companyLabel: 'Disputed',
    tone: 'red',
    workflowGroup: 'exception',
    terminal: false,
    permittedActions: ['view'],
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────

/** Fast key → entry lookup (canonical keys + all aliases). */
const _byKey = new Map<string, JobStatusEntry>();
for (const entry of STATUS_REGISTRY) {
  _byKey.set(entry.key, entry);
  for (const alias of entry.aliases) {
    _byKey.set(alias, entry);
  }
}

/**
 * Returns the registry entry for a status value (canonical or alias).
 * Returns `undefined` for unknown values — callers should handle this case.
 */
export function getStatusEntry(status: unknown): JobStatusEntry | undefined {
  if (typeof status !== 'string' || !status.trim()) return undefined;
  return _byKey.get(status.trim().toLowerCase());
}

/**
 * Returns the company-facing label for a status.
 * Falls back to title-casing the raw value so nothing renders as a raw slug.
 */
export function getStatusLabel(status: unknown): string {
  const entry = getStatusEntry(status);
  if (entry) return entry.companyLabel;
  const s = typeof status === 'string' ? status.trim() : '';
  if (!s) return 'Unknown';
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Returns the semantic tone for a status (for badge coloring).
 * Defaults to 'grey' for unknown values.
 */
export function getStatusTone(status: unknown): StatusTone {
  return getStatusEntry(status)?.tone ?? 'grey';
}

/**
 * Returns the permitted actions for a company_owner at the given status.
 */
export function getPermittedActions(status: unknown): CompanyJobAction[] {
  return getStatusEntry(status)?.permittedActions ?? ['view'];
}

/**
 * True if the status represents a terminal (no further transitions) state.
 */
export function isTerminalStatus(status: unknown): boolean {
  return getStatusEntry(status)?.terminal ?? false;
}

/**
 * True if the job is "active" — i.e. in an operational or awarded group.
 */
export function isActiveStatus(status: unknown): boolean {
  const entry = getStatusEntry(status);
  if (!entry) return false;
  return entry.workflowGroup === 'operational' || entry.workflowGroup === 'awarded';
}

/** Exported registry for iteration (e.g. building filter dropdowns). */
export { STATUS_REGISTRY };
