import Link from 'next/link';

import { SUPER_ADMIN_WORKSPACE_DEFINITION } from '../_components/SuperAdminWorkspaceShell';
import styles from '../_components/SuperAdminCardNavigationShell.module.css';

export default function PlatformOverviewPage() {
  const platform = SUPER_ADMIN_WORKSPACE_DEFINITION.nav.find((group) => group.id === 'platform');

  return (
    <section className={styles.platformPage}>
      <div className={styles.directoryHeader}>
        <span>PLATFORM</span>
        <h1>Platform Overview</h1>
        <p>Platform-wide governance destinations available to the Platform Owner.</p>
      </div>
      <div className={styles.platformGrid}>
        {platform?.items.map((item) => (
          <Link key={item.id} href={item.href} className={styles.platformCard}>
            <strong>{item.label}</strong>
            <span>Open {item.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
