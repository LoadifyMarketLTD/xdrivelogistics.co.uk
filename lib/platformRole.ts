/**
 * Platform ownership is stored only in profiles.role.
 * Ordinary company ownership is stored separately in company_memberships.role
 * and must never satisfy this predicate.
 */
export const isPlatformOwnerProfileRole = (role: unknown): role is 'owner' => role === 'owner';
