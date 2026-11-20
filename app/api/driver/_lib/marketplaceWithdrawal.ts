export function canWithdrawMarketplaceBid(
  bid: { id: string; status: string | null; bidder_user_id: string | null; bidder_driver_id: string | null },
  job: { awarded_carrier_company_id?: unknown; assigned_company_id?: unknown; assigned_driver_id?: unknown },
  viewer: { userId: string; driverId: string },
  blockedBidIds: ReadonlySet<string>,
): boolean {
  return bid.status === 'submitted' && bid.bidder_user_id === viewer.userId &&
    (!bid.bidder_driver_id || bid.bidder_driver_id === viewer.driverId) &&
    !job.awarded_carrier_company_id && !job.assigned_company_id && !job.assigned_driver_id &&
    !blockedBidIds.has(bid.id);
}
