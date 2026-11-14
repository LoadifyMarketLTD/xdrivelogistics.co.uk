import type { AssignedJob, DriverBid, MarketplaceJob, RealDriverSnapshot } from './realApi'
import type { JobStatus } from './workflow'

/** The approved UI's minimal view-model. Only actual API fields are mapped. */
export type DriverLoadView = {
  id: string
  from: string
  to: string
  pickup: string
  delivery: string
  vehicle: string
  weight: number
  notes: string
  status: JobStatus
  quote?: number
  quoteOutcome?: 'UNSUCCESSFUL' | 'CANCELLED' | 'AWARDED'
  company?: string
  distanceMiles?: number
}

const bookingStatuses: Record<string, JobStatus> = {
  allocated: 'ALLOCATED', assigned: 'ALLOCATED',
  on_way_to_pickup: 'ON_WAY_TO_PICKUP', en_route_to_pickup: 'ON_WAY_TO_PICKUP',
  on_site_pickup: 'ON_SITE_PICKUP', arrived_collection: 'ON_SITE_PICKUP',
  loaded: 'LOADED', collected: 'LOADED',
  on_way_to_delivery: 'ON_WAY_TO_DELIVERY',
  on_site_delivery: 'ON_SITE_DELIVERY',
  pod_submitted: 'POD_SUBMITTED', delivered: 'DELIVERED', completed: 'DELIVERED',
}
const label = (value: string | null | undefined, fallback: string) => value?.trim() || fallback
const when = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB') : 'Time not specified'

function mapMarketplace(job: MarketplaceJob): DriverLoadView {
  return {
    id: job.id,
    from: label(job.pickup_location, 'Collection area unavailable'),
    to: label(job.delivery_location, 'Delivery area unavailable'),
    pickup: when(job.pickup_datetime),
    delivery: when(job.delivery_datetime),
    vehicle: label(job.requested_vehicle_label ?? job.vehicle_type, 'Vehicle not specified'),
    weight: Number.isFinite(job.weight_kg) ? Number(job.weight_kg) : 0,
    notes: job.load_details ?? '',
    status: 'OPEN',
    company: label(job.posterName, 'Marketplace member'),
    ...(job.journeyDistanceMiles != null ? { distanceMiles: job.journeyDistanceMiles } : {}),
  }
}
function mapBooking(job: AssignedJob): DriverLoadView {
  const status = bookingStatuses[(job.canonicalStatus ?? job.current_status ?? job.status ?? '').toLowerCase()]
  if (!status) throw new Error(`Unknown assigned job status for ${job.id}; refusing to simulate a booking.`)
  return {
    id: job.id,
    from: label(job.pickupLocation, 'Collection location unavailable'),
    to: label(job.deliveryLocation, 'Delivery location unavailable'),
    pickup: when(job.pickupTime),
    delivery: 'Time not specified',
    vehicle: label(job.vehicleType, 'Vehicle not specified'),
    weight: 0,
    notes: '',
    status,
    ...(job.jobDistanceMiles != null ? { distanceMiles: job.jobDistanceMiles } : {}),
  }
}
function bidOutcome(bid: DriverBid): DriverLoadView['quoteOutcome'] {
  switch (bid.status.toLowerCase()) {
    case 'accepted': case 'awarded': return 'AWARDED'
    case 'rejected': case 'unsuccessful': return 'UNSUCCESSFUL'
    case 'cancelled': case 'withdrawn': return 'CANCELLED'
    default: return undefined
  }
}
export function mapRealDriverSnapshot(snapshot: RealDriverSnapshot): DriverLoadView[] {
  const jobs = new Map<string, DriverLoadView>()
  for (const job of snapshot.marketplace) jobs.set(job.id, mapMarketplace(job))
  for (const job of snapshot.bookings) jobs.set(job.id, mapBooking(job))
  for (const bid of snapshot.bids) {
    const current = jobs.get(bid.jobId)
    if (!current) continue // Never invent a load from a bid without verified job data.
    jobs.set(bid.jobId, {
      ...current,
      ...(bid.amount != null ? { quote: bid.amount } : {}),
      ...(bidOutcome(bid) ? { quoteOutcome: bidOutcome(bid) } : {}),
    })
  }
  return [...jobs.values()]
}
