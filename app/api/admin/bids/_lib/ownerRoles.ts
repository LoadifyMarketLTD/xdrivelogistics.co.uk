export const BID_DECISION_ROLES = new Set(['owner', 'admin', 'dispatcher']);

export const hasBidDecisionRole = (role: string | null | undefined) =>
  Boolean(role && BID_DECISION_ROLES.has(role));
