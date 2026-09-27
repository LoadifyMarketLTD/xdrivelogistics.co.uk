'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ComponentType } from 'react';
import {
  Activity, AlertTriangle, BadgeCheck, Ban, BarChart3, Bell, Briefcase,
  Building2, CalendarClock, CheckCircle2, ClipboardCheck, CreditCard,
  FileCheck2, FileSignature, FileText, Files, Flag, Grid3X3, HeartPulse,
  KeyRound, LayoutDashboard, LifeBuoy, LockKeyhole, Map, MessageCircle, MessageSquare,
  Navigation, Network, Percent, Receipt, RefreshCw, Route, Scale, Search,
  Settings, ShieldAlert, ShieldCheck, Shuffle, Store, Truck, UserCheck,
  UserCog, Users, Wallet, Webhook,
} from 'lucide-react';
import type { WorkspaceDefinition } from '../../../lib/workspaceRole';
import styles from './SuperAdminCardNavigationShell.module.css';

type IconComponent = ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;

type Props = {
  definition: WorkspaceDefinition;
  pathname: string;
  collapsed: boolean;
  mobileOpen: boolean;
  onNavigate: () => void;
};
const ICONS: Record<string, IconComponent> = {
  'command-centre': LayoutDashboard,
  'action-centre': AlertTriangle,
  'live-operations-map': Map,
  'global-search': Search,
  analytics: BarChart3,
  directory: Grid3X3,
  marketplace: Store,
  jobs: Briefcase,
  'active-jobs': Activity,
  'pending-jobs': CalendarClock,
  'completed-jobs': CheckCircle2,
  quotes: MessageSquare,
  allocations: Shuffle,
  deliveries: Route,
  disputes: Scale,
  'secure-loads': LockKeyhole,
  'pod-queue': FileCheck2,
  'jobs-at-risk': AlertTriangle,
  'tracking-eta': Navigation,
  'delivery-evidence': Files,
  'fleet-positions': Navigation,
  drivers: Users,
  'driver-availability': UserCheck,
  vehicles: Truck,
  'return-journeys': RefreshCw,
  'fleet-compliance': ShieldCheck,
  companies: Building2,
  brokers: Network,
  memberships: BadgeCheck,
  approvals: ClipboardCheck,
  'active-companies': CheckCircle2,
  'suspended-companies': Ban,
  verification: BadgeCheck,
  'company-compliance': ShieldCheck,
  'finance-overview': Wallet,
  invoices: Receipt,
  payments: CreditCard,
  revenue: BarChart3,
  subscriptions: RefreshCw,
  'stripe-webhooks': Webhook,
  fees: Percent,
  'fraud-cases': ShieldAlert,
  insurance: ShieldCheck,
  'operator-licences': FileSignature,
  expiries: CalendarClock,
  documents: Files,
  tickets: LifeBuoy,
  complaints: MessageCircle,
  'support-disputes': Scale,
  'platform-overview': LayoutDashboard,
  'compliance-overview': ShieldCheck,
  'users-access': UserCog,
  'roles-permissions': KeyRound,
  notifications: Bell,
  health: HeartPulse,
  audit: FileText,
  'global-settings': Settings,
  'legal-agreements': FileSignature,
  'feature-flags': Flag,
};
function baseHref(href: string) {
  return href.split('?')[0] ?? href;
}

function activeHrefForPath(pathname: string, definition: WorkspaceDefinition) {
  return definition.nav
    .flatMap((group) => group.items.map((item) => baseHref(item.href)))
    .filter((target) => target === definition.homeHref ? pathname === target : pathname === target || pathname.startsWith(`${target}/`))
    .sort((a, b) => b.length - a.length)[0] ?? null;
}

export default function SuperAdminSidebar({
  definition,
  pathname,
  collapsed,
  mobileOpen,
  onNavigate,
}: Props) {
  const activeHref = activeHrefForPath(pathname, definition);
  return (
    <aside
      className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''} ${mobileOpen ? styles.sidebarMobileOpen : ''}`}
      aria-label="Super Admin navigation"
    >
      <Link href={definition.homeHref} className={styles.sidebarBrand} onClick={onNavigate}>
        <Image src="/icon-192.png" alt="" width={36} height={36} priority />
        <span className={styles.sidebarBrandCopy}>
          <strong>XDrive</strong>
          <small>Platform Control</small>
        </span>
      </Link>
      <nav className={styles.sidebarScroll}>
        {definition.nav.map((group) => {
          const groupActive = group.items.some((item) => baseHref(item.href) === activeHref);
          return (
            <section key={group.id} className={styles.sidebarGroup} data-active={groupActive ? 'true' : 'false'}>
              <div className={styles.sidebarGroupLabel}>{group.label}</div>
              <div className={styles.sidebarGroupItems}>
                {group.items.map((item) => {
                  const active = baseHref(item.href) === activeHref;
                  const Icon = ICONS[item.id] ?? Activity;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`${styles.sidebarLink} ${active ? styles.sidebarLinkActive : ''}`}
                      aria-current={active ? 'page' : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      title={collapsed ? item.label : undefined}
                      onClick={onNavigate}
                    >
                      <Icon size={20} aria-hidden={true} />
                      <span className={styles.sidebarLinkLabel}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </nav>
    </aside>
  );
}
