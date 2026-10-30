'use client';

import type { ReactNode } from 'react';
import styles from './WorkflowFrame.module.css';

type FrameProps = {
  title: string;
  bookingReference: string;
  routeLabel: string;
  badge: string;
  agreedRate?: string | null;
  paymentTerms?: string | null;
  error?: string;
  message?: string;
  children: ReactNode;
  onBack: () => void;
};

export function WorkflowFrame({title,bookingReference,routeLabel,badge,agreedRate,paymentTerms,error,message,children,onBack}:FrameProps){
  return <div className={styles.page}>
    <header className={styles.header}><button type="button" aria-label="Back to Bookings" onClick={onBack}>‹</button><h1>{title}</h1><span aria-hidden="true" /></header>
    <div className={styles.content}>
      <section className={`${styles.card} ${styles.hero}`}>
        <div className={styles.heroTop}><small>BOOKING {bookingReference}</small><span>{badge}</span></div>
        <h2>{routeLabel}</h2>
        {(agreedRate||paymentTerms)&&<div className={styles.financials}>
          {agreedRate&&<div><small>Agreed Rate</small><strong>{agreedRate}</strong></div>}
          {paymentTerms&&<div><small>Payment Terms</small><strong>{paymentTerms}</strong></div>}
        </div>}
        {error&&<p className={styles.error} role="alert">{error}</p>}
        {message&&<p className={styles.success} role="status">{message}</p>}
      </section>
      {children}
    </div>
  </div>;
}

export function WorkflowCard({title,children,className=''}:{title?:string;children:ReactNode;className?:string}){
  return <section className={`${styles.card} ${className}`}>{title&&<h2 className={styles.cardTitle}>{title}</h2>}{children}</section>;
}

export function PrimaryAction({children,onClick,disabled=false}:{children:ReactNode;onClick:()=>void;disabled?:boolean}){
  return <button type="button" className={styles.primary} onClick={onClick} disabled={disabled}>{children}</button>;
}

export function SecondaryLink({children,href}:{children:ReactNode;href:string}){
  return <a className={styles.secondaryLink} href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

export { styles as workflowStyles };
