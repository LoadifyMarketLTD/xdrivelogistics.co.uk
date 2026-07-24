export type DriverWorkspaceMode = 'fleet_driver' | 'provider_driver' | 'admin_business';

type DriverWorkspaceModeUser = {
  role?: string | null;
  membershipRole?: string | null;
  ownerDriverWorkspace?: boolean;
  canAccessDriverMode?: boolean;
  ownerDriverExecutionMode?: boolean;
} | null | undefined;

type DriverWorkspaceMetadata = Record<string, unknown> | null | undefined;

const PROVIDER_WORKSPACE_TAGS = new Set([
  'owner_driver',
  'owner-driver',
  'owner_operator',
  'owner-operator',
  'self_employed',
  'self-employed',
  'self_employed_driver',
  'sole_trader',
]);

const INDIVIDUAL_DRIVER_TAGS = new Set([
  'individual_driver',
  'individual-driver',
  'driver_only',
  'driver-only',
  'fleet_driver',
]);

const DRIVER_EXECUTION_MODE_TAGS = new Set(['driver', 'driver_mode', 'execution']);

const readMetadataText = (metadata: DriverWorkspaceMetadata, key: string) => {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

const readMetadataFlag = (metadata: DriverWorkspaceMetadata, key: string) => {
  const value = metadata?.[key];
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;
  const normalized = value.toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const hasExplicitFalseFlag = (metadata: DriverWorkspaceMetadata, key: string) => {
  const value = metadata?.[key];
  if (value === false) return true;
  if (typeof value !== 'string') return false;
  const normalized = value.toLowerCase().trim();
  return normalized === 'false' || normalized === '0' || normalized === 'no';
};

const readNormalizedMetadataTags = (metadata: DriverWorkspaceMetadata, keys: string[]) =>
  keys
    .map((key) => readMetadataText(metadata, key))
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase().trim());

export const isDriverProviderWorkspaceRequested = (
  userMetadata: DriverWorkspaceMetadata,
  appMetadata: DriverWorkspaceMetadata
) => {
  const tags = [
    ...readNormalizedMetadataTags(userMetadata, ['account_type', 'workspace_mode', 'requested_role', 'signup_type', 'role']),
    ...readNormalizedMetadataTags(appMetadata, ['account_type', 'workspace_mode', 'requested_role', 'signup_type', 'role']),
  ];

  const explicitIndividualDriver = tags.some((value) => INDIVIDUAL_DRIVER_TAGS.has(value));
  const driverWorkspaceMode = tags.includes('driver') || tags.includes('fleet_driver');
  const workspaceExplicitlyDisabled =
    hasExplicitFalseFlag(userMetadata, 'owner_driver_workspace') ||
    hasExplicitFalseFlag(appMetadata, 'owner_driver_workspace');

  if (explicitIndividualDriver || (driverWorkspaceMode && workspaceExplicitlyDisabled)) {
    return false;
  }

  return (
    readMetadataFlag(userMetadata, 'owner_driver_workspace') ||
    readMetadataFlag(appMetadata, 'owner_driver_workspace') ||
    tags.some((value) => PROVIDER_WORKSPACE_TAGS.has(value))
  );
};

export const isDriverExecutionModeRequested = (
  userMetadata: DriverWorkspaceMetadata,
  appMetadata: DriverWorkspaceMetadata
) => {
  const tags = [
    ...readNormalizedMetadataTags(userMetadata, ['workspace_mode', 'execution_mode']),
    ...readNormalizedMetadataTags(appMetadata, ['workspace_mode', 'execution_mode']),
  ];

  return (
    readMetadataFlag(userMetadata, 'owner_driver_execution_mode') ||
    readMetadataFlag(appMetadata, 'owner_driver_execution_mode') ||
    tags.some((value) => DRIVER_EXECUTION_MODE_TAGS.has(value))
  );
};

const BUSINESS_MEMBERSHIP_ROLES = new Set(['owner', 'admin']);

export const DRIVER_WORKSPACE_MODE_LABELS: Record<DriverWorkspaceMode, string> = {
  fleet_driver: 'Fleet Driver',
  provider_driver: 'Owner Operator',
  admin_business: 'Business Admin',
};

export const resolveDriverWorkspaceMode = (user: DriverWorkspaceModeUser): DriverWorkspaceMode => {
  if (!user) return 'fleet_driver';

  const providerWorkspace =
    user.ownerDriverWorkspace === true ||
    user.ownerDriverExecutionMode === true ||
    (user.canAccessDriverMode === true && user.role !== 'driver');

  if (!providerWorkspace) return 'fleet_driver';

  const businessMembership = BUSINESS_MEMBERSHIP_ROLES.has(String(user.membershipRole ?? '').trim().toLowerCase());
  const businessRole = user.role === 'company_admin' || user.role === 'owner';

  if (businessMembership || businessRole) return 'admin_business';

  return 'provider_driver';
};

export const isFleetDriverWorkspaceMode = (mode: DriverWorkspaceMode) => mode === 'fleet_driver';
