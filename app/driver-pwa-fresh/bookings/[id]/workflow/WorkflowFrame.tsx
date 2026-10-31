'use client';

import type { ReactNode } from 'react';
import styles from './WorkflowFrame.module.css';
import {FreshHeader} from '../../../FreshNavigation';

type FrameProps = {
  title: string;
  bookingReference?: string | null;
  routeLabel: string;
  badge: string;
  agreedRate?: string | null;
  paymentTerms?: string | null;
  error?: string;
  message?: string;
  children: ReactNode;
  onBack: () => void;
  compact?: boolean;
};

export function WorkflowFrame({title,bookingReference,routeLabel,badge,agreedRate,paymentTerms,error,message,children,onBack,compact=false}:FrameProps){
  return <div className={`${styles.page} ${compact?styles.compact:''}`}>
    <FreshHeader title={title} onBack={onBack}/>
    <div className={styles.content}>
      {['Booking Details','Invoice Draft','Invoice Issued','Invoice Sent / Payment Tracking'].includes(title) && <section className={`${styles.card} ${styles.hero}`}>
        <div className={styles.heroTop}>{bookingReference?<small>BOOKING {bookingReference}</small>:<span aria-hidden="true"/>}<span>{badge}</span></div>
        <h2>{routeLabel}</h2>
        {(agreedRate||paymentTerms)&&<div className={styles.financials}>
          {agreedRate&&<div><small>Agreed Rate</small><strong>{agreedRate}</strong></div>}
          {paymentTerms&&<div><small>Payment Terms</small><strong>{paymentTerms}</strong></div>}
        </div>}
      </section>}
      {error&&<p className={styles.error} role="alert">{error}</p>}
      {message&&<p className={styles.success} role="status">{message}</p>}
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
