/**
 * A shipper/carrier may post a load fulfilled by another carrier.
 * It is visible as externally fulfilled for the posting company, never as
 * one of its own fleet bookings or assignable driver operations.
 */
export function isExternallyFulfilledPostedJob(
  job: { company_id: string | null; awarded_carrier_company_id: string | null; assigned_company_id: string | null },
  activeCompanyId: string | null,
): boolean {
  if (!activeCompanyId || job.company_id !== activeCompanyId) return false;
  if (job.awarded_carrier_company_id) return job.awarded_carrier_company_id !== activeCompanyId;
  return Boolean(job.assigned_company_id && job.assigned_company_id !== activeCompanyId);
}
