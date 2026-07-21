export const ACCOUNT_TYPES = ['customer', 'broker', 'fleet_operator', 'owner_driver'] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];
export type StoredOnboardingAccountType =
  | 'customer_shipper'
  | 'broker_shipper'
  | 'fleet_courier'
  | 'owner_driver';
export type AccountAppRole = 'customer' | 'broker' | 'company_admin' | 'driver';
export type AccountWorkspaceMode = 'customer' | 'broker' | 'company' | 'owner_driver';
export type OnboardingRouteSegment = 'customer' | 'broker' | 'fleet' | 'owner-driver';

type AccountTypeConfig = {
  label: string;
  appRole: AccountAppRole;
  workspaceMode: AccountWorkspaceMode;
  ownerDriverWorkspace: boolean;
  storedAccountType: StoredOnboardingAccountType;
  onboardingRouteSegment: OnboardingRouteSegment;
  onboardingPath: string;
};

export const ACCOUNT_TYPE_CONFIG: Record<AccountType, AccountTypeConfig> = {
  customer: {
    label: 'Customer / Shipper',
    appRole: 'customer',
    workspaceMode: 'customer',
    ownerDriverWorkspace: false,
    storedAccountType: 'customer_shipper',
    onboardingRouteSegment: 'customer',
    onboardingPath: '/onboarding/customer/resume',
  },
  broker: {
    label: 'Transport Broker',
    appRole: 'broker',
    workspaceMode: 'broker',
    ownerDriverWorkspace: false,
    storedAccountType: 'broker_shipper',
    onboardingRouteSegment: 'broker',
    onboardingPath: '/onboarding/broker/resume',
  },
  fleet_operator: {
    label: 'Fleet Operator',
    appRole: 'company_admin',
    workspaceMode: 'company',
    ownerDriverWorkspace: false,
    storedAccountType: 'fleet_courier',
    onboardingRouteSegment: 'fleet',
    onboardingPath: '/onboarding/fleet/resume',
  },
  owner_driver: {
    label: 'Owner Driver',
    appRole: 'driver',
    workspaceMode: 'owner_driver',
    ownerDriverWorkspace: true,
    storedAccountType: 'owner_driver',
    onboardingRouteSegment: 'owner-driver',
    onboardingPath: '/onboarding/owner-driver/resume',
  },
};

export const ACCOUNT_TYPE_OPTIONS = ACCOUNT_TYPES.map((value) => ({
  value,
  label: ACCOUNT_TYPE_CONFIG[value].label,
}));

const ACCOUNT_TYPE_ALIASES: Record<string, AccountType> = {
  customer: 'customer',
  customer_shipper: 'customer',
  shipper: 'customer',
  client: 'customer',

  broker: 'broker',
  broker_shipper: 'broker',
  transport_broker: 'broker',
  freight_broker: 'broker',

  fleet_operator: 'fleet_operator',
  fleet_courier: 'fleet_operator',
  'fleet/courier': 'fleet_operator',
  company_admin: 'fleet_operator',

  owner_driver: 'owner_driver',
  'owner-driver': 'owner_driver',
  owner_operator: 'owner_driver',
  'owner-operator': 'owner_driver',
  sole_trader: 'owner_driver',
};

export const normalizeAccountType = (raw: unknown): AccountType | null => {
  if (typeof raw !== 'string') return null;
  return ACCOUNT_TYPE_ALIASES[raw.trim().toLowerCase()] ?? null;
};

export const toStoredOnboardingAccountType = (
  accountType: AccountType
): StoredOnboardingAccountType => ACCOUNT_TYPE_CONFIG[accountType].storedAccountType;

export const fromStoredOnboardingAccountType = (
  raw: unknown
): AccountType | null => normalizeAccountType(raw);

export const getOnboardingPathForAccountType = (accountType: AccountType): string =>
  ACCOUNT_TYPE_CONFIG[accountType].onboardingPath;
