import type { WorkspaceRole } from '../../../lib/workspaceRole';

export type ActionCentreRole = 'admin' | 'broker' | 'customer' | 'driver' | 'platform_owner';

const ACTION_CENTRE_ROOT: Record<ActionCentreRole, string> = {
  admin: '/admin/action-centre',
  broker: '/broker/action-centre',
  customer: '/customer/action-centre',
  driver: '/driver/action-centre',
  platform_owner: '/super-admin/action-centre',
};

const NOTIFICATIONS_ROOT: Record<ActionCentreRole, string> = {
  admin: '/admin/notifications',
  broker: '/broker/notifications',
  customer: '/customer/notifications',
  driver: '/driver/notifications',
  platform_owner: '/super-admin/notifications',
};

const ENTITY_ROUTE_MAP: Record<ActionCentreRole, Partial<Record<string, string>>> = {
  admin: {
    job: '/admin/jobs',
    quote: '/admin/quotes',
    invoice: '/admin/invoices',
    dispute: '/admin/disputes',
    vehicle: '/admin/vehicles',
    driver: '/admin/drivers',
    document: '/admin/documents',
  },
  broker: {
    job: '/broker/jobs',
    quote: '/broker/bids',
    invoice: '/broker/customer-invoices',
    dispute: '/broker/disputes',
    customer: '/broker/customers',
    load: '/broker/loads',
  },
  customer: {
    job: '/customer/deliveries',
    quote: '/customer/quotes',
    invoice: '/customer/invoices',
    load: '/customer/loads',
    document: '/customer/documents',
  },
  driver: {
    job: '/driver/jobs',
    quote: '/driver/quotes',
    invoice: '/driver/finance',
    vehicle: '/driver/vehicles',
    document: '/driver/documents',
  },
  platform_owner: {
    job: '/super-admin/operations/jobs',
    quote: '/super-admin/operations/quotes',
    invoice: '/super-admin/finance/invoices',
    dispute: '/super-admin/operations/disputes',
    driver: '/super-admin/users/drivers',
    document: '/super-admin/compliance/documents',
    company: '/super-admin/companies',
    fraud_case: '/super-admin/compliance/fraud-cases',
    support_ticket: '/super-admin/support/tickets',
  },
};

const ADMIN_ONLY_ENTITY_TYPES = new Set([
  'fraud_case',
  'compliance_case',
  'membership',
  'member',
  'settings',
  'platform',
]);

const ADMIN_ONLY_EVENT_PREFIXES = ['admin_', 'owner_', 'fraud_', 'compliance_'];

const DRIVER_ALLOWED_ENTITY_TYPES = new Set(['job', 'quote', 'invoice', 'vehicle', 'document']);
const CUSTOMER_ALLOWED_ENTITY_TYPES = new Set(['job', 'quote', 'invoice', 'load', 'document']);
const BROKER_ALLOWED_ENTITY_TYPES = new Set(['job', 'quote', 'invoice', 'dispute', 'customer', 'load']);

export function resolveActionCentreRole(role: WorkspaceRole): ActionCentreRole {
  if (role === 'platform_owner') return 'platform_owner';
  if (role === 'broker') return 'broker';
  if (role === 'customer') return 'customer';
  if (role === 'driver' || role === 'owner_driver') return 'driver';
  return 'admin';
}

export function getActionCentreRoute(role: ActionCentreRole, eventId?: string | null): string {
  const base = ACTION_CENTRE_ROOT[role];
  return eventId ? `${base}?event=${encodeURIComponent(eventId)}` : base;
}

export function getNotificationsRoute(role: ActionCentreRole): string {
  return NOTIFICATIONS_ROOT[role];
}

const normalize = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';

export function isActionCentreEventVisibleToRole(
  role: ActionCentreRole,
  eventType: string | null | undefined,
  entityType: string | null | undefined,
): boolean {
  if (role === 'admin' || role === 'platform_owner') return true;

  const normalisedEventType = normalize(eventType);
  const normalisedEntityType = normalize(entityType);

  if (ADMIN_ONLY_EVENT_PREFIXES.some((prefix) => normalisedEventType.startsWith(prefix))) {
    return false;
  }
  if (ADMIN_ONLY_ENTITY_TYPES.has(normalisedEntityType)) {
    return false;
  }

  if (!normalisedEntityType) return true;

  if (role === 'driver') return DRIVER_ALLOWED_ENTITY_TYPES.has(normalisedEntityType);
  if (role === 'customer') return CUSTOMER_ALLOWED_ENTITY_TYPES.has(normalisedEntityType);
  return BROKER_ALLOWED_ENTITY_TYPES.has(normalisedEntityType);
}

export function resolveRoleScopedHref(
  role: ActionCentreRole,
  entityType: string | null | undefined,
  eventId?: string | null,
): string {
  const normalisedEntityType = normalize(entityType);
  const route = ENTITY_ROUTE_MAP[role][normalisedEntityType];
  if (route) return route;
  return getActionCentreRoute(role, eventId ?? null);
}

export const ACTION_CENTRE_ROLE_PREFIX: Record<ActionCentreRole, string> = {
  admin: '/admin/',
  broker: '/broker/',
  customer: '/customer/',
  driver: '/driver/',
  platform_owner: '/super-admin/',
};
