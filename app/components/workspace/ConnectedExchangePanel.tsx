'use client';

import { useRouter } from 'next/navigation';

export type ConnectedExchangeRole =
  | 'broker'
  | 'customer'
  | 'driver'
  | 'fleet'
  | 'carrier'
  | 'super-admin';

type ExchangeLink = {
  key: string;
  label: string;
  detail: string;
  href: string;
};

const ROLE_LINKS: Record<ConnectedExchangeRole, ExchangeLink[]> = {
  broker: [
    { key: 'directory', label: 'Directory', detail: 'Carrier network, trust and commercial profile', href: '/broker/carrier-network' },
    { key: 'loads', label: 'Loads', detail: 'Customer work and sourcing pipeline', href: '/broker/loads' },
    { key: 'quotes', label: 'Quotes', detail: 'Compare carrier offers and award decisions', href: '/broker/compare-quotes' },
    { key: 'jobs', label: 'Live execution', detail: 'Awarded work, delivery progress and exceptions', href: '/broker/jobs' },
    { key: 'diary', label: 'Diary', detail: 'Operational history, POD and booking evidence', href: '/broker/diary' },
    { key: 'messages', label: 'Messages', detail: 'Participant-scoped freight conversations', href: '/broker/messages' },
    { key: 'events', label: 'Event Log', detail: 'Searchable operational audit trail', href: '/broker/event-log' },
    { key: 'finance', label: 'Finance', detail: 'Receivables, carrier cost and margin', href: '/broker/finance' },
  ],
  customer: [
    { key: 'directory', label: 'Directory', detail: 'Approved carrier network and member profiles', href: '/customer/network' },
    { key: 'loads', label: 'Loads', detail: 'Post and manage transport requests', href: '/customer/loads' },
    { key: 'quotes', label: 'Quotes', detail: 'Compare price, member identity and award state', href: '/customer/quotes' },
    { key: 'tracking', label: 'Live tracking', detail: 'Track awarded bookings without exposing unrelated drivers', href: '/customer/tracking' },
    { key: 'bookings', label: 'Bookings', detail: 'POD, order, documents and completed work', href: '/customer/bookings' },
    { key: 'diary', label: 'Diary', detail: 'Operational timeline and historical bookings', href: '/customer/diary' },
    { key: 'messages', label: 'Messages', detail: 'Participant-scoped freight conversations', href: '/customer/messages' },
    { key: 'events', label: 'Event Log', detail: 'Searchable account and transport audit trail', href: '/customer/event-log' },
    { key: 'finance', label: 'Invoices', detail: 'Invoice position and payment status', href: '/customer/invoices' },
  ],
  driver: [
    { key: 'directory', label: 'Directory', detail: 'Search the authenticated member network', href: '/driver/directory' },
    { key: 'availability', label: 'Availability', detail: 'Current status and future position', href: '/driver/availability' },
    { key: 'returns', label: 'Return Journeys', detail: 'Advertise empty capacity and future route', href: '/driver/returns' },
    { key: 'nearby', label: "Who's Nearby?", detail: 'Privacy-scoped local capacity awareness', href: '/driver/nearby' },
    { key: 'loads', label: 'Loads', detail: 'Vehicle-matched exchange opportunities', href: '/driver/loads' },
    { key: 'quotes', label: 'Quotes', detail: 'Submitted pricing and quote outcomes', href: '/driver/quotes' },
    { key: 'diary', label: 'Diary', detail: 'Jobs, completion evidence and history', href: '/driver/history' },
    { key: 'messages', label: 'Messages', detail: 'Verified participant conversations', href: '/driver/messages' },
    { key: 'events', label: 'Event Log', detail: 'Searchable operational activity', href: '/driver/event-log' },
    { key: 'finance', label: 'Payment Report', detail: 'Completed-work invoice and payment position', href: '/driver/finance' },
  ],
  fleet: [
    { key: 'availability', label: 'Live Availability', detail: 'Available drivers, positions and resource readiness', href: '/admin/live-availability' },
    { key: 'fleet', label: 'Drivers & Vehicles', detail: 'Canonical fleet resources and assignments', href: '/admin/fleet/resources' },
    { key: 'returns', label: 'Return Journeys', detail: 'Future capacity and return-lane opportunities', href: '/admin/fleet/returns' },
    { key: 'jobs', label: 'Jobs', detail: 'Allocation, active execution and delivery state', href: '/admin/fleet/jobs' },
    { key: 'diary', label: 'Diary', detail: 'Booking lifecycle and completed operational evidence', href: '/admin/diary' },
    { key: 'vision', label: 'Freight Vision', detail: 'Live execution and fleet-position control', href: '/admin/freight-vision' },
    { key: 'messages', label: 'Messages', detail: 'Participant-scoped operations conversations', href: '/admin/messages' },
    { key: 'events', label: 'Event Log', detail: 'Tracking and account activity history', href: '/admin/event-log' },
    { key: 'finance', label: 'Finance', detail: 'Invoices, balances and operational finance', href: '/admin/finance' },
  ],
  carrier: [
    { key: 'directory', label: 'Directory', detail: 'Member network, capability and trust signals', href: '/admin/marketplace/directory' },
    { key: 'availability', label: 'Live Availability', detail: 'Available drivers and current fleet positions', href: '/admin/live-availability' },
    { key: 'fleet', label: 'My Fleet', detail: 'Drivers, vehicles and assignment readiness', href: '/admin/fleet' },
    { key: 'returns', label: 'Return Journeys', detail: 'Future capacity and return-lane opportunities', href: '/admin/fleet/returns' },
    { key: 'loads', label: 'Loads', detail: 'Marketplace work matched to carrier capability', href: '/admin/marketplace' },
    { key: 'quotes', label: 'Quotes', detail: 'Submitted commercial offers and outcomes', href: '/admin/quotes' },
    { key: 'diary', label: 'Diary', detail: 'Awarded work, POD and booking history', href: '/admin/diary' },
    { key: 'messages', label: 'Messages', detail: 'Participant-scoped freight conversations', href: '/admin/messages' },
    { key: 'events', label: 'Event Log', detail: 'Searchable transport and account activity', href: '/admin/event-log' },
    { key: 'finance', label: 'Finance', detail: 'Carrier invoices, payment status and exposure', href: '/admin/invoices' },
  ],
  'super-admin': [
    { key: 'directory', label: 'Directory', detail: 'Platform-wide companies, drivers and account oversight', href: '/super-admin/companies' },
    { key: 'capacity', label: 'Live Capacity', detail: 'Driver availability plus execution tracking', href: '/super-admin/operations/driver-availability' },
    { key: 'marketplace', label: 'Marketplace', detail: 'Posted, quoted and awarded exchange activity', href: '/super-admin/marketplace' },
    { key: 'operations', label: 'Operations', detail: 'Jobs, drivers, fleet and operational exceptions', href: '/super-admin/operations/jobs' },
    { key: 'fleet', label: 'Fleet', detail: 'Vehicle registry and platform fleet truth', href: '/super-admin/operations/fleet-positions' },
    { key: 'finance', label: 'Finance', detail: 'Platform invoice and settlement oversight', href: '/super-admin/finance' },
    { key: 'compliance', label: 'Compliance', detail: 'Insurance, licences and document readiness', href: '/super-admin/compliance/insurance' },
    { key: 'audit', label: 'Audit Logs', detail: 'Platform governance and administrative history', href: '/super-admin/settings/audit-logs' },
    { key: 'support', label: 'Support', detail: 'Operational support and resolution queue', href: '/super-admin/support/tickets' },
  ],
};

export function ConnectedExchangePanel({
  role,
  title = 'Connected Exchange',
  variant = 'workspace',
}: {
  role: ConnectedExchangeRole;
  title?: string;
  variant?: 'workspace' | 'super-admin';
}) {
  const router = useRouter();
  const links = ROLE_LINKS[role];
  const superAdmin = variant === 'super-admin';
  return (
    <section
      aria-label={`${title} navigation`}
      data-testid={`connected-exchange-${role}`}
      style={{
        marginBottom: superAdmin ? 24 : 12,
        padding: superAdmin ? 24 : 12,
        border: '1px solid #E5E7EB',
        borderRadius: superAdmin ? 8 : 4,
        background: '#FFFFFF',
        boxShadow: superAdmin ? '0px 2px 6px rgba(0,0,0,0.08)' : 'none',
      }}
    >
      <div style={{ marginBottom: superAdmin ? 16 : 8 }}>
        <h2 style={{ margin: 0, color: '#0A234F', fontSize: superAdmin ? 20 : 14, lineHeight: superAdmin ? '26px' : '19px', fontWeight: 700 }}>{title}</h2>
        <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: superAdmin ? 14 : 11, lineHeight: superAdmin ? '20px' : '15px' }}>
          Directory and trust → capacity → return journeys → loads → quotes → execution and diary → messaging and audit → finance.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: superAdmin ? 'repeat(3, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(190px, 1fr))', gap: superAdmin ? 12 : 8 }}>
        {links.map((link) => (
          <button
            key={link.key}
            type="button"
            onClick={() => router.push(link.href)}
            style={{
              minHeight: superAdmin ? 88 : 62,
              padding: superAdmin ? '12px 18px' : '8px 10px',
              border: '1px solid #E5E7EB',
              borderRadius: superAdmin ? 8 : 4,
              background: '#FFFFFF',
              boxShadow: superAdmin ? '0px 2px 6px rgba(0,0,0,0.08)' : 'none',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <strong style={{ display: 'block', color: '#1D57D8', fontSize: superAdmin ? 16 : 12, lineHeight: superAdmin ? '22px' : '16px', fontWeight: superAdmin ? 500 : 750 }}>{link.label}</strong>
            <span style={{ display: 'block', marginTop: 3, color: '#64748B', fontSize: superAdmin ? 13 : 10, lineHeight: superAdmin ? '18px' : '14px' }}>{link.detail}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

