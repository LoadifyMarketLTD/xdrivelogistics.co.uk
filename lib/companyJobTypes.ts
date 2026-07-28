/**
 * Canonical company workspace job model.
 *
 * All admin/company workspace pages (Dashboard, Marketplace, Quotes, Won Work,
 * Jobs, Diary, Live Operations) must use this single view-model instead of
 * their own local type definitions.  Production pages never render the raw DB
 * row – they always go through the adapter in companyJobAdapter.ts.
 */

// ── Permitted workflow actions ────────────────────────────────────────────────

export type CompanyJobAction =
  | 'view'
  | 'edit'
  | 'post_to_exchange'
  | 'direct_invite'
  | 'withdraw_from_exchange'
  | 'award'
  | 'cancel'
  | 'reassign_driver'
  | 'raise_dispute';

// ── Canonical view-model ──────────────────────────────────────────────────────

export interface CompanyJobListItem {
  /** Stable surrogate key. */
  id: string;

  /** Human-readable reference (e.g. "JOB-0001"). Falls back to short id. */
  jobRef: string;

  // ── Owner / customer identity ─────────────────────────────────────────────
  companyId: string;
  companyName: string;

  // ── Route ─────────────────────────────────────────────────────────────────
  pickupSummary: string;      // formatted city/town
  pickupPostcode: string;     // uppercase
  pickupDatetime: string | null;  // ISO-8601

  deliverySummary: string;
  deliveryPostcode: string;
  deliveryDatetime: string | null;

  /** Formatted route string, e.g. "Manchester → London". */
  routeDisplay: string;

  distanceMiles: number | null;

  // ── Vehicle & cargo ───────────────────────────────────────────────────────
  vehicleTypeKey: string;
  vehicleLabel: string;
  cargoSummary: string;
  weightKg: number | null;
  pallets: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  cargoValueGbp: number | null;
  palletType: string | null;
  palletStackable: boolean | null;

  // ── References ────────────────────────────────────────────────────────────
  customerReference: string | null;
  purchaseOrderNumber: string | null;
  bookingReference: string | null;

  // ── Client info (company-facing only, never leak to marketplace) ──────────
  clientName: string;
  clientEmail: string;
  clientPhone: string;

  // ── Commercial ────────────────────────────────────────────────────────────
  budgetAmountGbp: number | null;
  isFixedPrice: boolean;
  currency: string;

  // ── Bidding / marketplace ─────────────────────────────────────────────────
  bidCount: number;
  /** The company's own bid on this load (null when not yet bid). */
  ownBidAmountGbp: number | null;
  ownBidStatus: string | null;
  ownBidId: string | null;

  // ── Assignment ────────────────────────────────────────────────────────────
  awardedCarrierCompanyId: string | null;
  awardedCarrierName: string | null;
  assignedDriverId: string | null;
  assignedDriverName: string | null;
  assignedVehicleId: string | null;
  assignedVehicleReg: string | null;

  // ── Status ────────────────────────────────────────────────────────────────
  status: string;
  exchangeVisibility: string | null;

  // ── POD / finance ─────────────────────────────────────────────────────────
  hasDeliveryPhotos: boolean;
  invoiceStatus: string | null;

  // ── Workflow ──────────────────────────────────────────────────────────────
  permittedActions: CompanyJobAction[];

  // ── Metadata ─────────────────────────────────────────────────────────────
  createdAt: string;
  updatedAt: string;

  // ── Expanded details (loaded on demand) ──────────────────────────────────
  loadNotes: string | null;
  accessRestrictions: string | null;
  specialRequirements: string | null;
  documentChecklist: string[];

  collectionForkliftAvailable: boolean | null;
  collectionTailLiftRequired: boolean | null;
  collectionHandballRequired: boolean | null;
  deliveryForkliftAvailable: boolean | null;
  deliveryTailLiftRequired: boolean | null;
  deliveryHandballRequired: boolean | null;

  collectionContactName: string | null;
  collectionContactPhone: string | null;
  deliveryContactName: string | null;
  deliveryContactPhone: string | null;
}

// ── Minimal marketplace-safe subset (no client contact info) ─────────────────

export type MarketplaceLoadRow = Omit<
  CompanyJobListItem,
  'clientName' | 'clientEmail' | 'clientPhone' | 'collectionContactName' | 'collectionContactPhone' | 'deliveryContactName' | 'deliveryContactPhone'
>;
