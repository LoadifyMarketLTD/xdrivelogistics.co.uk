'use client';

import WorkspaceRestrictionBanner from './WorkspaceRestrictionBanner';

import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { BellRing, ChevronDown, CircleAlert, FileText, ListChecks, MapPin, MessageSquare, RefreshCw } from 'lucide-react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '../AuthContext';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import {
  getVisibleWorkspaceNav,
  getWorkspaceDefinition,
  hasWorkspaceCapability,
  resolveWorkspaceRole,
  resolveWorkspaceSurfaceRole,
  type WorkspaceNavGroup,
  type WorkspaceNavItem,
  type WorkspaceRole,
} from '../../../lib/workspaceRole';
import { isCapabilityAllowedForPath } from '../../../lib/roleCapabilities';
import {
  getNotificationsRoute,
  resolveActionCentreRole,
} from './actionCentreConfig';

const FREIGHT_VISION_ROLES = new Set<WorkspaceRole>([
  'company_owner',
  'company_admin',
  'carrier_admin',
  'fleet_manager',
  'dispatcher',
]);

const FLEET_OPERATION_ROLES = new Set<WorkspaceRole>([
  'company_owner',
  'company_admin',
  'carrier_admin',
  'fleet_manager',
  'dispatcher',
]);

const CARRIER_NAV_ROLES = new Set<WorkspaceRole>([
  'company_owner',
  'company_admin',
  'carrier_admin',
]);


const MESSAGE_HREFS: Partial<Record<WorkspaceRole, string>> = {
  company_owner: '/admin/messages',
  company_admin: '/admin/messages',
  carrier_admin: '/admin/messages',
  fleet_manager: '/admin/messages',
  dispatcher: '/admin/messages',
  broker: '/broker/messages',
  customer: '/customer/messages',
  driver: '/driver/messages',
  owner_driver: '/driver/messages',
};

const EVENT_LOG_HREFS: Partial<Record<WorkspaceRole, string>> = {
  company_owner: '/admin/event-log',
  company_admin: '/admin/event-log',
  carrier_admin: '/admin/event-log',
  fleet_manager: '/admin/event-log',
  dispatcher: '/admin/event-log',
  finance: '/admin/event-log',
  compliance: '/admin/event-log',
  viewer: '/admin/event-log',
  broker: '/broker/event-log',
  customer: '/customer/event-log',
  driver: '/driver/event-log',
  owner_driver: '/driver/event-log',
};

function uniqueNavItems(groups: WorkspaceNavGroup[]) {
  const byHref = new Map<string, WorkspaceNavItem>();
  for (const group of groups) {
    for (const item of group.items) {
      if (!byHref.has(item.href)) byHref.set(item.href, item);
    }
  }
  return byHref;
}

function singleGroup(id: string, label: string, item: WorkspaceNavItem): WorkspaceNavGroup {
  return { id, label, items: [{ ...item, label }] };
}

export function composeCarrierPrimaryNav(groups: WorkspaceNavGroup[]) {
  const items = uniqueNavItems(groups);
  const direct: Array<[string, string, string]> = [
    ['carrier-dashboard', 'Dashboard', '/admin'],
    ['carrier-directory', 'Directory', '/admin/marketplace/directory'],
    ['carrier-live-availability', 'Live Availability', '/admin/live-availability'],
    ['carrier-my-fleet', 'My Fleet', '/admin/fleet'],
    ['carrier-return-journeys', 'Return Journeys', '/admin/fleet/returns'],
    ['carrier-loads', 'Loads', '/admin/marketplace'],
    ['carrier-quotes', 'Quotes', '/admin/exchange-quotes'],
    ['carrier-diary', 'Diary', '/admin/diary'],
    ['carrier-freight-vision', 'Freight Vision', '/admin/freight-vision'],
    ['carrier-drivers-vehicles', 'Drivers & Vehicles', '/admin/fleet/resources'],
    ['carrier-settings', 'Settings', '/admin/settings'],
  ];

  const directHrefs = new Set(direct.map(([, , href]) => href));
  const primary = direct.flatMap(([id, label, href]) => {
    const item = items.get(href);
    return item ? [singleGroup(id, label, item)] : [];
  });

  const morePreferred = [
    '/admin/bulk-import',
    '/admin/won-work',
    '/admin/jobs',
    '/admin/fleet/assignments',
    '/admin/pod',
    '/admin/quotes',
    '/admin/invoices',
    '/admin/documents',
    '/admin/messages',
    '/admin/event-log',
    '/admin/team',
    '/admin/fleet/managers',
    '/admin/dispatchers',
    '/admin/settings/billing',
  ];
  const more: WorkspaceNavItem[] = [
    { id: 'action-centre', label: 'Action Centre', href: '/admin/action-centre', icon: '!' },
    ...morePreferred.flatMap((href) => {
      const item = items.get(href);
      return item && !directHrefs.has(href) ? [item] : [];
    }),
  ];
  const represented = new Set([...directHrefs, ...more.map((item) => item.href)]);
  for (const [href, item] of items) {
    if (!represented.has(href)) {
      more.push(item);
      represented.add(href);
    }
  }

  return more.length ? [...primary, { id: 'carrier-more', label: 'More', items: more }] : primary;
}

export function composeFleetPrimaryNav(groups: WorkspaceNavGroup[]) {
  const items = uniqueNavItems(groups);
  const direct: Array<[string, string, string]> = [
    ['fleet-dashboard', 'Dashboard', '/admin/fleet'],
    ['fleet-live-availability', 'Live Availability', '/admin/live-availability'],
    ['fleet-my-fleet', 'My Fleet', '/admin/fleet/vehicles'],
    ['fleet-return-journeys', 'Return Journeys', '/admin/fleet/returns'],
    ['fleet-jobs', 'Jobs', '/admin/fleet/jobs'],
    ['fleet-diary', 'Diary', '/admin/diary'],
    ['fleet-freight-vision', 'Freight Vision', '/admin/freight-vision'],
    ['fleet-drivers-vehicles', 'Drivers & Vehicles', '/admin/fleet/resources'],
  ];

  const used = new Set<string>();
  const primary: WorkspaceNavGroup[] = [];
  for (const [id, label, href] of direct) {
    if (used.has(href)) continue;
    const item = items.get(href);
    if (!item) continue;
    used.add(href);
    primary.push(singleGroup(id, label, item));
  }

  const morePreferred = [
    '/admin/fleet/assignments',
    '/admin/fleet/availability',
    '/admin/fleet/future-availability',
    '/admin/fleet/positions',
    '/admin/fleet/maintenance',
    '/admin/incidents',
    '/admin/messages',
    '/admin/event-log',
    '/admin/invoices',
    '/admin/fleet/compliance',
  ];
  const more: WorkspaceNavItem[] = [
    { id: 'action-centre', label: 'Action Centre', href: '/admin/action-centre', icon: '!' },
    ...morePreferred.flatMap((href) => {
      const item = items.get(href);
      return item && !used.has(href) ? [item] : [];
    }),
  ];
  const represented = new Set([...used, ...more.map((item) => item.href)]);
  for (const [href, item] of items) {
    if (!represented.has(href)) {
      more.push(item);
      represented.add(href);
    }
  }
  return more.length ? [...primary, { id: 'fleet-more', label: 'More', items: more }] : primary;
}

type PrimaryNavEntry = [id: string, label: string, href: string];

export function composeRolePrimaryNav(
  groups: WorkspaceNavGroup[],
  direct: PrimaryNavEntry[],
  moreId: string,
  moreLabel = 'More',
  moreHrefs?: readonly string[],
) {
  const items = uniqueNavItems(groups);
  const used = new Set<string>();
  const primary: WorkspaceNavGroup[] = [];

  for (const [id, label, href] of direct) {
    const item = items.get(href);
    if (!item || used.has(href)) continue;
    used.add(href);
    primary.push(singleGroup(id, label, item));
  }

  const more: WorkspaceNavItem[] = [];
  const moreUsed = new Set<string>();
  const secondaryEntries = moreHrefs
    ? moreHrefs.map((href) => [href, items.get(href)] as const)
    : [...items.entries()];
  for (const [href, item] of secondaryEntries) {
    if (item && !used.has(href) && !moreUsed.has(href)) {
      more.push(item);
      moreUsed.add(href);
    }
  }
  if (moreHrefs) {
    for (const [href, item] of items) {
      if (!used.has(href) && !moreUsed.has(href)) {
        more.push(item);
        moreUsed.add(href);
      }
    }
  }

  return more.length ? [...primary, { id: moreId, label: moreLabel, items: more }] : primary;
}

export function composeCustomerPrimaryNav(groups: WorkspaceNavGroup[]) {
  return composeRolePrimaryNav(groups, [
    ['customer-dashboard-primary', 'Dashboard', '/customer'],
    ['customer-post-load-primary', 'Post Load', '/customer/post-load'],
    ['customer-loads-primary', 'Loads', '/customer/loads'],
    ['customer-quotes-primary', 'Quotes', '/customer/quotes'],
    ['customer-bookings-primary', 'Bookings', '/customer/bookings'],
    ['customer-diary-primary', 'Diary', '/customer/diary'],
    ['customer-tracking-primary', 'Tracking', '/customer/tracking'],
    ['customer-network-primary', 'Network', '/customer/network'],
    ['customer-action-centre-primary', 'Action Centre', '/customer/action-centre'],
  ], 'customer-more');
}

export function composeBrokerPrimaryNav(groups: WorkspaceNavGroup[]) {
  return composeRolePrimaryNav(groups, [
    ['broker-dashboard-primary', 'Dashboard', '/broker'],
    ['broker-action-centre-primary', 'Action Centre', '/broker/action-centre'],
    ['broker-enquiries-primary', 'Enquiries', '/broker/enquiries'],
    ['broker-loads-primary', 'Loads', '/broker/loads'],
    ['broker-quotes-primary', 'Carrier Quotes', '/broker/bids'],
    ['broker-jobs-primary', 'Jobs', '/broker/jobs'],
    ['broker-diary-primary', 'Diary', '/broker/diary'],
    ['broker-pod-primary', 'POD Review', '/broker/pod-review'],
    ['broker-finance-primary', 'Finance', '/broker/finance'],
    ['broker-settings-primary', 'Settings', '/broker/settings'],
  ], 'broker-more');
}

export function composeDriverPrimaryNav(groups: WorkspaceNavGroup[], ownerDriver: boolean) {
  if (!ownerDriver) {
    return composeRolePrimaryNav(groups, [
      ['driver-dashboard-primary', 'Dashboard', '/driver'],
      ['driver-action-centre-primary', 'Action Centre', '/driver/action-centre'],
      ['driver-jobs-primary', 'My Jobs', '/driver/jobs'],
      ['driver-diary-primary', 'Diary', '/driver/history'],
      ['driver-availability-primary', 'Availability', '/driver/availability'],
      ['driver-vehicle-primary', 'Vehicle', '/driver/vehicles'],
      ['driver-documents-primary', 'Documents', '/driver/documents'],
      ['driver-settings-primary', 'Settings', '/driver/settings'],
    ], 'driver-more');
  }

  const items = uniqueNavItems(groups);
  const primarySpec: Array<[string, string, string]> = [
    ['owner-driver-dashboard-primary', 'Dashboard', '/driver'],
    ['owner-driver-loads-primary', 'Loads', '/driver/loads'],
    ['owner-driver-quotes-primary', 'Quotes', '/driver/quotes'],
    ['owner-driver-jobs-primary', 'My Jobs', '/driver/jobs'],
    ['owner-driver-diary-primary', 'Diary', '/driver/history'],
    ['owner-driver-availability-primary', 'Availability', '/driver/availability'],
    ['owner-driver-returns-primary', 'Return Journeys', '/driver/returns'],
    ['owner-driver-directory-primary', 'Directory', '/driver/directory'],
  ];
  const moreSpec: Array<[string, string]> = [
    ['/driver/load-alerts', 'Load Alerts'],
    ['/driver/nearby', "Who's Nearby"],
    ['/driver/messages', 'Messages'],
    ['/driver/vehicles', 'My Vehicle'],
    ['/driver/finance', 'Finance'],
    ['/driver/documents', 'Documents'],
    ['/driver/settings', 'Account / Settings'],
  ];

  const primary = primarySpec.flatMap(([id, label, href]) => {
    const item = items.get(href);
    return item ? [singleGroup(id, label, { ...item, label })] : [];
  });
  const moreItems = moreSpec.flatMap(([href, label]) => {
    const item = items.get(href);
    return item ? [{ ...item, label }] : [];
  });

  return moreItems.length
    ? [...primary, { id: 'owner-driver-more', label: 'More', items: moreItems }]
    : primary;
}

export function composeDispatcherPrimaryNav(groups: WorkspaceNavGroup[]) {
  return composeRolePrimaryNav(groups, [
    ['dispatcher-dashboard-primary', 'Dashboard', '/admin'],
    ['dispatcher-diary-primary', 'Diary', '/admin/diary'],
    ['dispatcher-unallocated-primary', 'Unallocated', '/admin/fleet/assignments'],
    ['dispatcher-active-primary', 'Active Jobs', '/admin/fleet/active-jobs'],
    ['dispatcher-collections-primary', 'Collections', '/admin/collections'],
    ['dispatcher-deliveries-primary', 'Deliveries', '/admin/deliveries'],
    ['dispatcher-positions-primary', 'Live Positions', '/admin/fleet/positions'],
    ['dispatcher-settings-primary', 'Settings', '/admin/settings'],
  ], 'dispatcher-more', 'More', [
    '/admin/action-centre',
    '/admin/bulk-import',
    '/admin/incidents',
    '/admin/pod',
    '/admin/freight-vision',
    '/admin/live-availability',
    '/admin/fleet/resources',
    '/admin/messages',
    '/admin/event-log',
  ]);
}

function composeFinancePrimaryNav(groups: WorkspaceNavGroup[]) {
  return composeRolePrimaryNav(groups, [
    ['finance-dashboard-primary', 'Dashboard', '/admin/invoices'],
    ['finance-customer-primary', 'Customer Invoices', '/admin/finance/customer-invoices'],
    ['finance-carrier-primary', 'Carrier Invoices', '/admin/finance/carrier-invoices'],
    ['finance-payments-primary', 'Payments', '/admin/finance/payments'],
    ['finance-balances-primary', 'Balances', '/admin/finance/balances'],
    ['finance-reports-primary', 'Reports', '/admin/finance/reports'],
    ['finance-settings-primary', 'Settings', '/admin/settings'],
  ], 'finance-more');
}

function composeCompliancePrimaryNav(groups: WorkspaceNavGroup[]) {
  return composeRolePrimaryNav(groups, [
    ['compliance-dashboard-primary', 'Dashboard', '/admin/documents'],
    ['compliance-driver-primary', 'Driver Docs', '/admin/documents?type=driver'],
    ['compliance-vehicle-primary', 'Vehicle Docs', '/admin/documents?type=vehicle'],
    ['compliance-company-primary', 'Company Docs', '/admin/documents/company'],
    ['compliance-verification-primary', 'Verification', '/admin/documents?view=pending'],
    ['compliance-expiry-primary', 'Expiry', '/admin/documents/expiry'],
    ['compliance-incidents-primary', 'Incidents', '/admin/incidents'],
    ['compliance-settings-primary', 'Settings', '/admin/settings'],
  ], 'compliance-more');
}

const OWNER_DRIVER_MORE_ICONS = {
  '/driver/load-alerts': BellRing,
  '/driver/nearby': MapPin,
  '/driver/documents': FileText,
  '/driver/messages': MessageSquare,
} as const;

function OwnerDriverMoreIcon({ item }: { item: WorkspaceNavItem }) {
  const Icon = OWNER_DRIVER_MORE_ICONS[item.href as keyof typeof OWNER_DRIVER_MORE_ICONS];
  return Icon ? <Icon aria-hidden="true" size={14} strokeWidth={1.8} /> : null;
}
const OWNER_DRIVER_MORE_SECTIONS: Record<string, string> = {
  '/driver/load-alerts': 'Matching & Availability',
  '/driver/nearby': 'Matching & Availability',
  '/driver/messages': 'Business',
  '/driver/vehicles': 'Business',
  '/driver/finance': 'Business',
  '/driver/documents': 'Compliance',
  '/driver/settings': 'Account',
};

const CUSTOMER_MORE_ICONS = {
  '/customer/updates': RefreshCw,
  '/customer/disputes': CircleAlert,
  '/customer/event-log': ListChecks,
} as const;

const CUSTOMER_MORE_SECTIONS: Record<string, string> = {
  '/customer/bulk-import': 'Loads',
  '/customer/deliveries': 'Operations',
  '/customer/documents': 'Operations',
  '/customer/updates': 'Operations',
  '/customer/messages': 'Collaboration',
  '/customer/disputes': 'Collaboration',
  '/customer/event-log': 'Collaboration',
  '/customer/invoices': 'Finance',
  '/customer/team': 'Administration',
  '/customer/settings': 'Administration',
};
function CustomerMoreIcon({ item }: { item: WorkspaceNavItem }) {
  const Icon = CUSTOMER_MORE_ICONS[item.href as keyof typeof CUSTOMER_MORE_ICONS];
  return Icon ? <Icon aria-hidden="true" size={14} strokeWidth={1.8} /> : null;
}

function moreMenuSectionLabel(groupId: string, href: string, previousHref?: string) {
  const sections = groupId === 'owner-driver-more'
    ? OWNER_DRIVER_MORE_SECTIONS
    : groupId === 'customer-more'
      ? CUSTOMER_MORE_SECTIONS
      : null;
  if (!sections) return null;
  const section = sections[href] ?? null;
  if (!section) return null;
  const previousSection = previousHref ? sections[previousHref] ?? null : null;
  return section !== previousSection ? section : null;
}

export function composeBrokerPrototypeNav(): WorkspaceNavGroup[] {
  return [
    { id: 'broker-home', label: 'Broker', items: [
      { id: 'broker-dashboard', label: 'Broker Dashboard', href: '/broker', icon: 'HOME' },
      { id: 'broker-action-centre', label: 'Action Centre', href: '/broker/action-centre', icon: '!' },
      { id: 'broker-enquiries', label: 'Enquiries', href: '/broker/enquiries', icon: 'ENQ' },
    ] },
    { id: 'broker-customers-loads', label: 'Customers & Loads', items: [
      { id: 'broker-customers', label: 'Customers', href: '/broker/customers', icon: 'CUS' },
      { id: 'broker-customer-loads', label: 'Customer Loads', href: '/broker/loads', icon: 'LOAD' },
      { id: 'broker-bulk-import', label: 'Bulk Import', href: '/broker/bulk-import', icon: 'IMPORT' },
    ] },
    { id: 'broker-commercial', label: 'Commercial', items: [
      { id: 'broker-carrier-quotes', label: 'Carrier Quotes', href: '/broker/bids', icon: 'QUOTE' },
      { id: 'broker-margin', label: 'Margin / Profit', href: '/broker/margins', icon: '%' },
    ] },
    { id: 'broker-operations', label: 'Operations', items: [
      { id: 'broker-active-jobs', label: 'Active Jobs', href: '/broker/jobs', icon: 'JOB' },
      { id: 'broker-diary', label: 'Diary', href: '/broker/diary', icon: 'DIARY' },
      { id: 'broker-pod-review', label: 'POD Review', href: '/broker/pod-review', icon: 'POD' },
      { id: 'broker-disputes', label: 'Disputes', href: '/broker/disputes', icon: '!' },
    ] },
    { id: 'broker-collaboration', label: 'Collaboration', items: [
      { id: 'broker-messages', label: 'Messages', href: '/broker/messages', icon: 'MSG' },
      { id: 'broker-event-log', label: 'Event Log', href: '/broker/event-log', icon: 'LOG' },
      { id: 'broker-network', label: 'Directory', href: '/broker/carrier-network', icon: 'DIR' },
    ] },
    { id: 'broker-finance', label: 'Finance', items: [
      { id: 'broker-finance-home', label: 'Finance', href: '/broker/finance', icon: 'GBP' },
      { id: 'broker-customer-invoices', label: 'Customer Invoices', href: '/broker/customer-invoices', icon: 'GBP' },
      { id: 'broker-carrier-costs', label: 'Carrier Costs', href: '/broker/carrier-costs', icon: 'GBP' },
      { id: 'broker-reports', label: 'Reports & Data', href: '/broker/reports', icon: 'XLSX' },
    ] },
    { id: 'broker-administration', label: 'Administration', items: [
      { id: 'broker-team', label: 'Team', href: '/broker/team', icon: 'TEAM' },
      { id: 'broker-settings', label: 'Settings', href: '/broker/settings', icon: 'SET' },
    ] },
  ];
}

export function mergeCanonicalNavFallback(
  preferred: WorkspaceNavGroup[],
  canonical: WorkspaceNavGroup[],
): WorkspaceNavGroup[] {
  const seen = new Set(preferred.flatMap((group) => group.items.map((item) => item.href)));
  const fallback = canonical.flatMap((group) =>
    group.items.filter((item) => {
      if (seen.has(item.href)) return false;
      seen.add(item.href);
      return true;
    }),
  );
  return fallback.length
    ? [...preferred, { id: 'canonical-nav-fallback', label: 'More', items: fallback }]
    : preferred;
}

function filterWorkspaceNavByAccess(
  groups: WorkspaceNavGroup[],
  role: WorkspaceRole,
  user: ReturnType<typeof useAuth>['user'],
): WorkspaceNavGroup[] {
  if (!user) return groups;
  const context = {
    membershipId: user.membershipId,
    membershipRole: user.membershipRole,
    financeAccess: user.financeAccess,
    rawRole: user.rawRole,
    workspaceRole: role,
    driverId: user.driverId,
    canCommercialBid: user.canCommercialBid,
    driverStatus: user.driverStatus,
    appAccess: user.appAccess,
    accountStatus: user.accountStatus,
    companyStatus: user.companyStatus,
    ownerDriverWorkspace: user.ownerDriverWorkspace,
    ownerDriverExecutionMode: user.ownerDriverExecutionMode,
    canAccessDriverMode: user.canAccessDriverMode,
  };

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        isCapabilityAllowedForPath(item.href, user.role === 'guest' ? null : user.role, context)),
    }))
    .filter((group) => group.items.length > 0);
}

export function composeCustomerPrototypeNav(): WorkspaceNavGroup[] {
  return [
    { id: 'customer-home', label: 'Customer', items: [
      { id: 'customer-dashboard', label: 'Customer Dashboard', href: '/customer', icon: 'HOME' },
      { id: 'customer-action-centre', label: 'Action Centre', href: '/customer/action-centre', icon: '!' },
    ] },
    { id: 'customer-loads', label: 'My Loads', items: [
      { id: 'customer-my-loads', label: 'My Loads', href: '/customer/loads', icon: 'LOAD' },
      { id: 'customer-bulk-import', label: 'Bulk Import', href: '/customer/bulk-import', icon: 'IMPORT' },
    ] },
    { id: 'customer-quotes', label: 'Quotes', items: [
      { id: 'customer-quotes-page', label: 'Quotes', href: '/customer/quotes', icon: 'QUOTE' },
    ] },
    { id: 'customer-bookings', label: 'Bookings', items: [
      { id: 'customer-bookings-page', label: 'Bookings', href: '/customer/bookings', icon: 'BOOK' },
    ] },
    { id: 'customer-delivery', label: 'Delivery', items: [
      { id: 'customer-deliveries', label: 'Deliveries', href: '/customer/deliveries', icon: 'DEL' },
      { id: 'customer-tracking', label: 'Tracking', href: '/customer/tracking', icon: 'GPS' },
      { id: 'customer-pod-docs', label: 'POD & Documents', href: '/customer/documents', icon: 'POD' },
      { id: 'customer-diary', label: 'Diary', href: '/customer/diary', icon: 'DIARY' },
      { id: 'customer-updates', label: 'Updates', href: '/customer/updates', icon: 'NEW' },
    ] },
    { id: 'customer-collaboration', label: 'Collaboration', items: [
      { id: 'customer-network', label: 'Directory', href: '/customer/network', icon: 'DIR' },
      { id: 'customer-messages', label: 'Messages', href: '/customer/messages', icon: 'MSG' },
      { id: 'customer-disputes', label: 'Disputes', href: '/customer/disputes', icon: '!' },
      { id: 'customer-event-log', label: 'Event Log', href: '/customer/event-log', icon: 'LOG' },
    ] },
    { id: 'customer-finance', label: 'Finance', items: [{ id: 'customer-invoices', label: 'Invoices', href: '/customer/invoices', icon: 'GBP' }] },
    { id: 'customer-administration', label: 'Administration', items: [
      { id: 'customer-team', label: 'Team', href: '/customer/team', icon: 'TEAM' },
      { id: 'customer-settings', label: 'Settings', href: '/customer/settings', icon: 'SET' },
    ] },
  ];
}

export default function TopWorkspaceShell({
  children,
  forcedRole,
}: {
  children: ReactNode;
  forcedRole?: WorkspaceRole;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const resolvedRole = forcedRole ?? resolveWorkspaceRole(user);
  const role = resolveWorkspaceSurfaceRole(pathname ?? '/', resolvedRole);
  const definition = getWorkspaceDefinition(role);
  const nav = useMemo(() => {
    const base = getVisibleWorkspaceNav(role).map((group) => ({ ...group, items: [...group.items] }));

    if (CARRIER_NAV_ROLES.has(role)) {
      const customerQuotesHref = '/admin/quotes';
      const customerQuotesPresent = base.some((group) => group.items.some((candidate) => candidate.href === customerQuotesHref));
      if (!customerQuotesPresent && hasWorkspaceCapability(role, 'quotes.submit')) {
        base.push({
          id: 'carrier-customer-quotes',
          label: 'Customer Quotes',
          items: [{ id: 'customer-quotes', label: 'Customer Quotes', href: customerQuotesHref, icon: 'QUOTE', capability: 'quotes.submit' }],
        });
      }

      const directoryHref = '/admin/marketplace/directory';
      const alreadyPresent = base.some((group) => group.items.some((candidate) => candidate.href === directoryHref));
      if (!alreadyPresent) {
        const marketplaceIndex = base.findIndex((group) => group.id === 'carrier-marketplace');
        const insertAt = marketplaceIndex >= 0 ? marketplaceIndex + 1 : Math.min(1, base.length);
        base.splice(insertAt, 0, {
          id: 'carrier-directory',
          label: 'Directory',
          items: [{ id: 'directory', label: 'Directory', href: directoryHref, icon: 'DIR' }],
        });
      }
    }

    if (FREIGHT_VISION_ROLES.has(role) && hasWorkspaceCapability(role, 'jobs.track')) {
      const item = {
        id: 'freight-vision',
        label: 'Freight Vision',
        href: '/admin/freight-vision',
        icon: 'FV',
        capability: 'jobs.track' as const,
      };
      const alreadyPresent = base.some((group) => group.items.some((candidate) => candidate.href === item.href));
      if (!alreadyPresent) {
        if (CARRIER_NAV_ROLES.has(role)) {
          const financeIndex = base.findIndex((group) => group.id === 'carrier-finance');
          const insertAt = financeIndex >= 0 ? financeIndex : base.length;
          base.splice(insertAt, 0, { id: 'carrier-freight-vision', label: 'Freight Vision', items: [item] });
        } else {
          const operations = base.find((group) => group.id === 'operations');
          if (operations) operations.items.push(item);
          else base.push({ id: 'operations', label: 'Operations', items: [item] });
        }
      }
    }

    if (FLEET_OPERATION_ROLES.has(role) && hasWorkspaceCapability(role, 'fleet.positions.view')) {
      const items: WorkspaceNavItem[] = [
        {
          id: 'live-availability',
          label: 'Live Availability',
          href: '/admin/live-availability',
          icon: 'LIVE',
          capability: 'fleet.positions.view',
        },
        {
          id: 'fleet-resources',
          label: 'Fleet Resources',
          href: '/admin/fleet/resources',
          icon: 'FLEET',
          capability: 'fleet.positions.view',
        },
      ];

      if (hasWorkspaceCapability(role, 'drivers.manage')) {
        items.push({ id: 'fleet-drivers', label: 'Drivers', href: '/admin/fleet/drivers', icon: 'DRV', capability: 'drivers.manage' });
      }
      if (hasWorkspaceCapability(role, 'vehicles.manage')) {
        items.push({ id: 'fleet-vehicles', label: 'Vehicles', href: '/admin/fleet/vehicles', icon: 'VEH', capability: 'vehicles.manage' });
      }

      if (CARRIER_NAV_ROLES.has(role)) {
        const carrierFleet = base.find((group) => group.id === 'carrier-fleet');
        if (carrierFleet) {
          for (const item of items) {
            if (!carrierFleet.items.some((candidate) => candidate.href === item.href)) carrierFleet.items.push(item);
          }
        } else {
          base.push({ id: 'carrier-fleet', label: 'Fleet', items });
        }
      } else {
        const fleet = base.find((group) => group.id === 'fleet');
        if (fleet) {
          for (const item of items) {
            if (!fleet.items.some((candidate) => candidate.href === item.href)) fleet.items.push(item);
          }
        } else {
          base.push({ id: 'fleet', label: 'Fleet', items });
        }
      }
    }

    const messageHref = MESSAGE_HREFS[role];
    if (messageHref) {
      const alreadyPresent = base.some((group) => group.items.some((candidate) => candidate.href === messageHref));
      if (!alreadyPresent) {
        const eventLogIndex = base.findIndex((group) => group.label === 'Event Log' || group.id.endsWith('-event-log'));
        const accountIndex = base.findIndex((group) => group.label === 'Account' || group.id.endsWith('-account'));
        const insertAt = eventLogIndex >= 0 ? eventLogIndex : accountIndex >= 0 ? accountIndex : base.length;
        base.splice(insertAt, 0, {
          id: `${role}-messages`,
          label: 'Messages',
          items: [{ id: 'messages', label: 'Messages', href: messageHref, icon: 'MSG' }],
        });
      }
    }

    const eventLogHref = EVENT_LOG_HREFS[role];
    if (eventLogHref) {
      const alreadyPresent = base.some((group) => group.items.some((candidate) => candidate.href === eventLogHref));
      if (!alreadyPresent) {
        const accountIndex = base.findIndex((group) => group.label === 'Account' || group.id.endsWith('-account'));
        const insertAt = accountIndex >= 0 ? accountIndex : base.length;
        base.splice(insertAt, 0, {
          id: `${role}-event-log`,
          label: 'Event Log',
          items: [{ id: 'event-log', label: 'Event Log', href: eventLogHref, icon: 'LOG' }],
        });
      }
    }

    if (role === 'broker') {
      const preferred = filterWorkspaceNavByAccess(composeBrokerPrototypeNav(), role, user);
      return composeBrokerPrimaryNav(mergeCanonicalNavFallback(preferred, base));
    }
    if (role === 'customer') {
      const preferred = filterWorkspaceNavByAccess(composeCustomerPrototypeNav(), role, user);
      return composeCustomerPrimaryNav(mergeCanonicalNavFallback(preferred, base));
    }
    if (CARRIER_NAV_ROLES.has(role)) return composeCarrierPrimaryNav(base);
    if (role === 'fleet_manager') return composeFleetPrimaryNav(base);
    if (role === 'owner_driver') return composeDriverPrimaryNav(base, true);
    if (role === 'driver') return composeDriverPrimaryNav(base, false);
    if (role === 'dispatcher') return composeDispatcherPrimaryNav(base);
    if (role === 'finance') return composeFinancePrimaryNav(base);
    if (role === 'compliance') return composeCompliancePrimaryNav(base);
    if (role === 'viewer') {
      return composeRolePrimaryNav(base, [
        ['viewer-dashboard-primary', 'Dashboard', '/admin'],
        ['viewer-jobs-primary', 'Jobs', '/admin/jobs'],
      ], 'viewer-more');
    }

    return base;
  }, [role, user]);
  const [companyName, setCompanyName] = useState('XDrive Logistics');
  const [unreadCount, setUnreadCount] = useState(0);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const menuTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const navigationTargets = useMemo(
    () =>
      nav.flatMap((group) =>
        group.items.map((item) => ({
          id: `${group.id}-${item.id}`,
          label: item.label,
          href: item.href,
        })),
      ),
    [nav],
  );

  const activeNavigationHref = useMemo(() => {
    const current = pathname ?? '/';
    if (current === definition.homeHref) return definition.homeHref;

    const candidates = navigationTargets
      .map((target) => target.href.split('?')[0] ?? target.href)
      .filter((href) => href !== definition.homeHref)
      .filter((href) => current === href || current.startsWith(`${href}/`))
      .sort((a, b) => b.length - a.length);

    return candidates[0] ?? null;
  }, [definition.homeHref, navigationTargets, pathname]);

  const actionRole = resolveActionCentreRole(role);
  const notificationsHref = getNotificationsRoute(actionRole);
  const primaryAction =
    !CARRIER_NAV_ROLES.has(role) && role !== 'owner_driver' &&
    definition.primaryAction &&
    (!definition.primaryAction.capability || hasWorkspaceCapability(role, definition.primaryAction.capability))
      ? definition.primaryAction
      : null;
  const routeAccessContext = user ? {
    membershipId: user.membershipId,
    membershipRole: user.membershipRole,
    financeAccess: user.financeAccess,
    rawRole: user.rawRole,
    workspaceRole: role,
    driverId: user.driverId,
    canCommercialBid: user.canCommercialBid,
    driverStatus: user.driverStatus,
    appAccess: user.appAccess,
    accountStatus: user.accountStatus,
    companyStatus: user.companyStatus,
    ownerDriverWorkspace: user.ownerDriverWorkspace,
    ownerDriverExecutionMode: user.ownerDriverExecutionMode,
    canAccessDriverMode: user.canAccessDriverMode,
  } : {};
  const showCarrierPostLoadAction =
    CARRIER_NAV_ROLES.has(role)
    && isCapabilityAllowedForPath('/admin/post-load', user?.role === 'guest' ? null : user?.role ?? null, routeAccessContext);
  const showAdminStaffPostLoadAction =
    (role === 'dispatcher' || role === 'platform_owner')
    && isCapabilityAllowedForPath('/admin/post-load', user?.role === 'guest' ? null : user?.role ?? null, routeAccessContext);
  const showOwnerDriverPostLoadAction = role === 'owner_driver';
  const showPostLoadAction = showCarrierPostLoadAction || showAdminStaffPostLoadAction || showOwnerDriverPostLoadAction;
  const postLoadHref = CARRIER_NAV_ROLES.has(role) ? '/admin/post-load' : '/driver/post-load';
  const postLoadTargetHref = showAdminStaffPostLoadAction ? '/admin/post-load' : postLoadHref;
  const showBookDirectAction =
    CARRIER_NAV_ROLES.has(role) ||
    role === 'owner_driver' ||
    role === 'customer' ||
    role === 'broker' ||
    (role === 'driver' && user?.canCommercialBid === true);
  const bookDirectHref = CARRIER_NAV_ROLES.has(role)
    ? '/admin/marketplace/directory'
    : role === 'customer'
      ? '/customer/network/directory'
      : role === 'broker'
        ? '/broker/carrier-network/directory'
        : '/driver/directory';

  useEffect(() => {
    if (!user?.companyId || !isSupabaseConfigured) {
      if (role === 'customer') setCompanyName('Customer Account');
      else if (role === 'broker') setCompanyName('Broker Company');
      else setCompanyName(user?.email ?? definition.label);
      return;
    }

    let cancelled = false;
    supabase
      .from('companies')
      .select('name')
      .eq('id', user.companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && typeof data?.name === 'string' && data.name.trim()) {
          setCompanyName(data.name.trim());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [definition.label, role, user?.companyId, user?.email]);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    const fetchUnread = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { if (!cancelled) setUnreadCount(0); return; }
      const response = await fetch('/api/workspace/notifications?mode=count', {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as { unreadCount?: number };
      if (!cancelled) setUnreadCount(response.ok ? Number(payload.unreadCount ?? 0) : 0);
    };

    void fetchUnread();
    const timer = window.setInterval(() => void fetchUnread(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user?.id]);

  useEffect(() => {
    setOpenGroupId(null);
  }, [pathname]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !openGroupId) return;
      const trigger = menuTriggerRefs.current[openGroupId];
      setOpenGroupId(null);
      window.requestAnimationFrame(() => trigger?.focus());
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (navRef.current && !navRef.current.contains(event.target)) setOpenGroupId(null);
    };

    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [openGroupId]);

  const isActive = (href: string) => {
    const [baseHref] = href.split('?');
    if (CARRIER_NAV_ROLES.has(role)) return baseHref === activeNavigationHref;
    if (baseHref === definition.homeHref) return pathname === baseHref;
    return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
  };

  const openRoute = (href: string) => {
    setOpenGroupId(null);
    router.push(href);
  };

  const focusMenuItem = (groupId: string, edge: 'first' | 'last' = 'first') => {
    window.requestAnimationFrame(() => {
      const menu = document.getElementById(`workspace-menu-${groupId}`);
      const items = menu
        ? Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
        : [];
      const target = edge === 'last' ? items.at(-1) : items[0];
      target?.focus();
    });
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    if (!items.length) return;
    const currentIndex = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement));
    let nextIndex = currentIndex;
    if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % items.length;
    if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + items.length) % items.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = items.length - 1;
    event.preventDefault();
    items[nextIndex]?.focus();
  };

  const driverPrototypeScope = role === 'driver' || role === 'owner_driver';

  return (
    <div
      className={`top-workspace-shell${driverPrototypeScope ? ' driver-prototype-port' : ''}`}
      data-workspace-role={role}
    >
      <header className="top-workspace-shell__header">
        <div className="top-workspace-shell__brand">
          <button
            type="button"
            className="top-workspace-shell__logo-button"
            onClick={() => router.push(definition.homeHref)}
            aria-label={`Open ${definition.label}`}
          >
            <Image
              src="/xdrive-logo-primary.png"
              alt="XDrive Logistics"
              width={150}
              height={41}
              priority
              className="top-workspace-shell__logo"
            />
          </button>
          <div className="top-workspace-shell__identity">
            <span>{definition.label}</span>
            {role !== 'customer' && !CARRIER_NAV_ROLES.has(role) ? <strong>{companyName}</strong> : null}
          </div>
        </div>

        <div className="top-workspace-shell__actions">
          {showPostLoadAction && (
            <button
              type="button"
              className="top-workspace-action top-workspace-action--primary"
              onClick={() => router.push(postLoadTargetHref)}
            >
              POST LOAD
            </button>
          )}
          {showBookDirectAction && (
            <button
              type="button"
              className="top-workspace-action top-workspace-action--direct"
              onClick={() => router.push(bookDirectHref)}
            >
              BOOK DIRECT
            </button>
          )}
          {primaryAction && (
            <button
              type="button"
              className="top-workspace-action top-workspace-action--primary"
              onClick={() => router.push(primaryAction.href)}
            >
              {primaryAction.label}
            </button>
          )}
          <button
            type="button"
            className="top-workspace-notification"
            onClick={() => router.push(notificationsHref)}
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            title="Notifications"
          >
            <BellRing aria-hidden="true" size={18} strokeWidth={1.8} />
            {unreadCount > 0 && (
              <span className="top-workspace-notification__count">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className="top-workspace-action top-workspace-action--signout"
            onClick={() => void logout()}
          >
            Sign out
          </button>
        </div>
      </header>

      <nav
        ref={navRef}
        className="top-workspace-nav top-workspace-nav--primary"
        aria-label={`${definition.label} navigation`}
      >
        <div className="top-workspace-nav__track">
          {nav.map((group, groupIndex) => {
            const groupActive = group.items.some((item) => isActive(item.href));

            if (group.items.length === 1) {
              const item = group.items[0];
              const active = isActive(item.href);
              return (
                <div
                  key={group.id}
                  className="top-workspace-nav__group"
                  data-first={groupIndex === 0 ? 'true' : 'false'}
                >
                  <button
                    type="button"
                    className="top-workspace-nav__item"
                    data-active={active ? 'true' : 'false'}
                    onClick={() => openRoute(item.href)}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </button>
                </div>
              );
            }

            const open = openGroupId === group.id;
            return (
              <div
                key={group.id}
                className="top-workspace-nav__group top-workspace-nav__group--menu"
                data-first={groupIndex === 0 ? 'true' : 'false'}
                data-group-id={group.id}
              >
                <button
                  type="button"
                  className="top-workspace-nav__item top-workspace-nav__trigger"
                  data-active={groupActive ? 'true' : 'false'}
                  data-open={open ? 'true' : 'false'}
                  id={`workspace-menu-trigger-${group.id}`}
                  ref={(node) => { menuTriggerRefs.current[group.id] = node; }}
                  aria-expanded={open}
                  aria-haspopup="menu"
                  aria-controls={`workspace-menu-${group.id}`}
                  onClick={() => setOpenGroupId(open ? null : group.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      event.preventDefault();
                      setOpenGroupId(group.id);
                      focusMenuItem(group.id, event.key === 'ArrowUp' ? 'last' : 'first');
                    }
                  }}
                >
                  <span>{group.label}</span>
                  <ChevronDown aria-hidden="true" className="top-workspace-nav__caret" size={14} strokeWidth={2} />
                </button>
                {open && (
                  <div
                    id={`workspace-menu-${group.id}`}
                    className="top-workspace-nav__menu"
                    role="menu"
                    aria-labelledby={`workspace-menu-trigger-${group.id}`}
                    onKeyDown={handleMenuKeyDown}
                  >
                    {group.items.map((item, itemIndex) => {
                      const active = isActive(item.href);
                      const sectionLabel = moreMenuSectionLabel(group.id, item.href, group.items[itemIndex - 1]?.href);
                      return (
                        <Fragment key={item.id}>
                          {sectionLabel && (
                            <div className="top-workspace-nav__menu-section" role="presentation">
                              {sectionLabel}
                            </div>
                          )}
                          <button
                            type="button"
                            role="menuitem"
                            className="top-workspace-nav__menu-item"
                            data-active={active ? 'true' : 'false'}
                            data-section-start={group.id === 'owner-driver-more' && (item.href === '/driver/finance' || item.href === '/driver/documents') ? 'true' : undefined}
                            onClick={() => openRoute(item.href)}
                          >
                            <span className="top-workspace-nav__menu-icon" aria-hidden="true">
                              {role === 'owner_driver'
                                ? <OwnerDriverMoreIcon item={item} />
                                : role === 'customer' && group.id === 'customer-more'
                                  ? <CustomerMoreIcon item={item} />
                                  : item.icon ?? null}
                            </span>
                            <span>{item.label}</span>
                          </button>
                        </Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <WorkspaceRestrictionBanner role={role} />

      <main className={`top-workspace-shell__content${driverPrototypeScope ? ' app driver-prototype-app' : ''}`}>{children}</main>
    </div>
  );
}
