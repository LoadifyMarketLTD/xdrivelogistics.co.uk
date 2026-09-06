import Link from 'next/link';
import { Layers3 } from 'lucide-react';

import { SUPER_ADMIN_WORKSPACE_DEFINITION } from '../_components/SuperAdminWorkspaceShell';
import styles from '../_components/SuperAdminCardNavigationShell.module.css';

export default function SuperAdminDirectoryPage() {
  return (
    <section className={styles.directoryPage}>
      <div className={styles.directoryHeader}>
        <span>SUPER ADMIN DIRECTORY</span>
        <h1>Explore all areas</h1>
        <p>Every Super Admin area and sub-area is visible here without hidden navigation.</p>
      </div>

      <div className={styles.areaGrid}>
        {SUPER_ADMIN_WORKSPACE_DEFINITION.nav.map((group) => (
          <article key={group.id} className={styles.areaCard}>
            <div className={styles.areaCardHead}>
              <span className={styles.areaIcon}><Layers3 size={24} aria-hidden="true" /></span>
              <div>
                <strong>{group.label}</strong>
                <p>{group.items.length} platform destinations</p>
              </div>
            </div>
            <div className={styles.areaLinks}>
              {group.items.map((item) => (
                <Link key={item.id} href={item.href}>{item.label}<span aria-hidden="true">→</span></Link>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
