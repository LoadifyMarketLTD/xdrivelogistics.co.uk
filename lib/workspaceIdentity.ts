export type WorkspaceIdentityInput = {
  appMetadata?: Record<string, unknown> | null;
  fallbackRole?: string | null;
  profileRole?: string | null;
  userMetadata?: Record<string, unknown> | null;
};

const normalizeIdentity = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase().trim().replace(/[-\s]+/g, '_');
  return normalized || null;
};

const readMetadataIdentity = (
  metadata: Record<string, unknown> | null | undefined,
  key: string
): string | null => normalizeIdentity(metadata?.[key]);

const FLEET_IDENTITIES = new Set([
  'fleet_courier',
  'fleet_operator',
  'fleet_manager',
  'fleet_admin',
]);

/**
 * Resolve the raw workspace identity used by both client auth hydration and
 * middleware. profiles.role remains authoritative for the application role;
 * metadata may only refine a company_admin into the Fleet workspace when it
 * contains an explicit fleet identity.
 */
export const resolveWorkspaceRawRole = ({
  appMetadata,
  fallbackRole,
  profileRole,
  userMetadata,
}: WorkspaceIdentityInput): string | null => {
  const normalizedProfileRole = normalizeIdentity(profileRole);
  const normalizedFallbackRole = normalizeIdentity(fallbackRole);

  if (normalizedProfileRole && normalizedProfileRole !== 'company_admin') {
    return normalizedProfileRole;
  }

  if (!normalizedProfileRole && normalizedFallbackRole !== 'company_admin') {
    return normalizedFallbackRole;
  }

  const candidates = [
    readMetadataIdentity(userMetadata, 'requested_role'),
    readMetadataIdentity(appMetadata, 'requested_role'),
    readMetadataIdentity(userMetadata, 'account_type'),
    readMetadataIdentity(appMetadata, 'account_type'),
    readMetadataIdentity(userMetadata, 'workspace_mode'),
    readMetadataIdentity(appMetadata, 'workspace_mode'),
  ];

  const fleetIdentity = candidates.find(
    (candidate): candidate is string => Boolean(candidate && FLEET_IDENTITIES.has(candidate))
  );

  return fleetIdentity ?? normalizedProfileRole ?? normalizedFallbackRole;
};
