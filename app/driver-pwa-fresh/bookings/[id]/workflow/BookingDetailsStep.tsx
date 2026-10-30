'use client';

import styles from './BookingDetailsStep.module.css';

type StopView = {
  key: 'collection' | 'delivery';
  label: string;
  address: string;
  schedule: string;
  contactName?: string | null;
  phone?: string | null;
  navigateHref?: string | null;
};

type Props = {
  bookingReference?: string | null;
  routeLabel: string;
  statusLabel: string;
  agreedRate?: string | null;
  paymentTerms?: string | null;
  customerName?: string | null;
  memberCode?: string | null;
  memberPhone?: string | null;
  stops: StopView[];
  working?: boolean;
  error?: string;
  message?: string;
  onBack: () => void;
  onMessage: () => void;
  onNext: () => void;
};

export default function BookingDetailsStep({
  bookingReference, routeLabel, statusLabel, agreedRate, paymentTerms, customerName, memberCode, memberPhone,
  stops, working = false, error, message, onBack, onMessage, onNext,
}: Props) {
  return (
    <div className={styles.page} data-testid="booking-workflow-page-1">
      <header className={styles.header}>
        <button type="button" className={styles.back} aria-label="Back to Bookings" onClick={onBack}>‹</button>
        <h1>Booking Details</h1>
        <span className={styles.headerSpacer} aria-hidden="true" />
      </header>

      <div className={styles.content}>
        <section className={`${styles.card} ${styles.summary}`} aria-label="Booking summary">
          <div className={styles.summaryTop}>
            {bookingReference&&<span className={styles.bookingRef}>BOOKING {bookingReference}</span>}
            <span className={styles.status}>{statusLabel}</span>
          </div>
          <h2 className={styles.route}>{routeLabel}</h2>
          {(agreedRate || paymentTerms) && (
            <div className={styles.commercial}>
              {agreedRate && <div><span>Agreed Rate</span><strong>{agreedRate}</strong></div>}
              {paymentTerms && <div><span>Payment Terms</span><strong>{paymentTerms}</strong></div>}
            </div>
          )}
          {error && <p className={styles.error} role="alert">{error}</p>}
          {message && <p className={styles.success} role="status">{message}</p>}
        </section>

        {(customerName || memberCode || memberPhone) && (
          <section className={styles.card} aria-label="Customer">
            <div className={styles.sectionHead}><h2>Customer</h2></div>
            <div className={styles.customerRow}>
              <div className={styles.customerIdentity}>
                <strong>{customerName || 'Marketplace member'}</strong>
                {memberCode && <span>{memberCode}</span>}
              </div>
              <div className={styles.customerActions}>
                {memberPhone && <a href={'tel:' + memberPhone.replace(/\s+/g, '')}>Call</a>}
                <button type="button" onClick={onMessage}>Message</button>
              </div>
            </div>
          </section>
        )}

        <section className={`${styles.card} ${styles.stops}`} aria-label="Stops">
          <div className={styles.sectionHead}><h2>Stops</h2></div>
          <div className={styles.stopList}>
            {stops.map((stop, index) => (
              <article className={styles.stop} key={stop.key}>
                <div className={`${styles.pin} ${stop.key === 'collection' ? styles.collectionPin : styles.deliveryPin}`} aria-hidden="true" />
                <div className={styles.stopBody}>
                  <div className={styles.stopTitleRow}>
                    <div>
                      <span className={styles.stopLabel}>{stop.label}</span>
                      <strong>{stop.address}</strong>
                    </div>
                    {index === 0 && stops.length > 1 && <span className={styles.routeArrow} aria-hidden="true">→</span>}
                  </div>
                  <span className={styles.schedule}>{stop.schedule}</span>
                  {stop.contactName && <span className={styles.contact}>{stop.contactName}</span>}
                  <div className={styles.stopActions}>
                    {stop.navigateHref && <a href={stop.navigateHref} target="_blank" rel="noopener noreferrer">Navigate</a>}
                    {stop.phone && <a href={'tel:' + stop.phone.replace(/\s+/g, '')}>Call</a>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={`${styles.card} ${styles.nextAction}`} aria-label="Status and next action">
          <div className={styles.sectionHead}><h2>Status &amp; Next Action</h2></div>
          <div className={styles.acceptedRow}><span className={styles.check}>✓</span><strong>Booking accepted</strong></div>
          <button type="button" className={styles.primary} disabled={working} onClick={onNext}>
            {working ? 'Saving…' : 'On My Way to Pickup'}
          </button>
        </section>
      </div>
    </div>
  );
}
