export type SmartDestinationCandidate = {
  destinationPriority: boolean;
  miles: number | null;
  pickupMs: number | null;
  originalIndex: number;
};

/**
 * Promotes feasible destination-area pickups without removing or reordering
 * the rest of the marketplace feed.
 */
export function sortSmartDestinationCandidates<T extends SmartDestinationCandidate>(items: T[]) {
  return [...items].sort((a, b) => {
    if (a.destinationPriority !== b.destinationPriority) return a.destinationPriority ? -1 : 1;
    if (!a.destinationPriority) return a.originalIndex - b.originalIndex;
    const distanceOrder = (a.miles ?? Number.MAX_SAFE_INTEGER) - (b.miles ?? Number.MAX_SAFE_INTEGER);
    if (distanceOrder !== 0) return distanceOrder;
    const timeOrder = (a.pickupMs ?? Number.MAX_SAFE_INTEGER) - (b.pickupMs ?? Number.MAX_SAFE_INTEGER);
    return timeOrder !== 0 ? timeOrder : a.originalIndex - b.originalIndex;
  });
}
