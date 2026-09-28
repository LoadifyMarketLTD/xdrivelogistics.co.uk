import Link from 'next/link';
import { ShieldCheck, UserCog, Users } from 'lucide-react';
import styles from '../_components/SuperAdminCardNavigationShell.module.css';

const DESTINATIONS = [
  { href: '/super-admin/users/company-owners', label: 'Company Owners', description: 'Company-level owners and the businesses they administer.' },
  { href: '/super-admin/users/customers', label: 'Customers', description: 'Customer identities and company context.' },
  { href: '/super-admin/users/dispatchers', label: 'Dispatchers', description: 'Operational dispatch users across member companies.' },
  { href: '/super-admin/users/drivers', label: 'Drivers', description: 'Driver identities, access and operational availability.' },
  { href: '/super-admin/users/platform-admins', label: 'Platform Administrators', description: 'Authoritative Platform Owner registry.' },
  { href: '/super-admin/settings/roles-permissions', label: 'Roles & Permissions', description: 'Read-only canonical role and capability matrix.' },
];

export default function Page() {
  return <section className={styles.platformPage}>
    <div className={styles.directoryHeader}>
      <span>PLATFORM</span>
      <h1>Users & Access</h1>
      <p>Identity oversight is kept separate from the read-only Roles & Permissions authority matrix.</p>
    </div>
    <div className={styles.platformGrid}>
      {DESTINATIONS.map((item, index) => (
        <Link key={item.href} href={item.href} className={styles.platformCard}>
          {index === 4 ? <ShieldCheck size={20} aria-hidden="true" /> : index === 5 ? <UserCog size={20} aria-hidden="true" /> : <Users size={20} aria-hidden="true" />}
          <strong>{item.label}</strong>
          <span>{item.description}</span>
        </Link>
      ))}
    </div>
  </section>;
}
