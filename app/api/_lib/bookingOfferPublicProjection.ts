/**
 * Carrier-facing projection for an unaccepted booking offer.
 * Keep this an explicit allowlist: adding columns to jobs must never leak them.
 * Only a fully accepted booking unlocks its underlying job details.
 */
const value = (input: unknown): string | null =>
  typeof input === 'string' && input.trim() ? input.trim() : null;

const outcode = (input: unknown): string | null => {
  const text = value(input);
  return text ? text.split(/\s+/)[0] ?? null : null;
};

export function bookingOfferVisibleJob<T extends Record<string, unknown>>(
  job: T | null,
  status: string,
) {
  if (!job) return null;
  if (status === 'accepted') return job;

  const pickupCity = value(job.pickup_city);
  const deliveryCity = value(job.delivery_city);
  const pickupOutcode = outcode(job.pickup_postcode);
  const deliveryOutcode = outcode(job.delivery_postcode);

  return {
    id: job.id,
    pickup_location: pickupCity ?? pickupOutcode ?? 'Collection area',
    pickup_city: pickupCity,
    pickup_postcode: pickupOutcode,
    delivery_location: deliveryCity ?? deliveryOutcode ?? 'Delivery area',
    delivery_city: deliveryCity,
    delivery_postcode: deliveryOutcode,
    pickup_datetime: job.pickup_datetime ?? null,
    delivery_datetime: job.delivery_datetime ?? null,
    payment_terms: job.payment_terms ?? null,
    load_id: job.load_id ?? null,
    vehicle_type: job.vehicle_type ?? null,
    requested_vehicle_label: job.requested_vehicle_label ?? null,
    job_distance_miles: job.job_distance_miles ?? null,
    job_distance_minutes: job.job_distance_minutes ?? null,
    pickup_lat: null,
    pickup_lng: null,
    delivery_lat: null,
    delivery_lng: null,
  };
}
