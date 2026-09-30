import type { ReactNode } from 'react';
import styles from './CarrierMapRegisterSplit.module.css';

/** Carrier blueprint section 18: shared map/register geometry. */
export default function CarrierMapRegisterSplit({ mapTitle, registerTitle, map, register, meta }: {
  mapTitle: string;
  registerTitle: string;
  map: ReactNode;
  register: ReactNode;
  meta?: ReactNode;
}) {
  return <div className={styles.split} data-testid="carrier-map-register-split">
    <section className={styles.panel} aria-label={mapTitle}>
      <header className={styles.header}><h2>{mapTitle}</h2></header>
      <div className={`${styles.body} ${styles.map}`} data-testid="carrier-map-body">{map}</div>
    </section>
    <section className={styles.panel} aria-label={registerTitle}>
      <header className={styles.header}><h2>{registerTitle}</h2>{meta}</header>
      <div className={styles.body} data-testid="carrier-register-body">{register}</div>
    </section>
  </div>;
}
