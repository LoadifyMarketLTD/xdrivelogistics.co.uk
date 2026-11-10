'use client';

import type { ReactNode } from 'react';
import type { CxDateParts } from './CxLoadCard';
import './master3150-design-system.css';
import './master3150-record-card.css';
import './master3150-live-operations.css';

/**
 * Production counterpart of approved 3150 XDriveLoadCard.
 * Presentation only: callers own their Supabase queries, permissions and real
 * quote/award/booking/POD handlers. Never fetches demo data.
 */
export type Master3150CardMode = 'load' | 'quote' | 'diary';
export type Master3150CardProps = {
  mode: Master3150CardMode;
  className?: string;
  mainClassName?: string;
  routeClassName?: string;
  timesClassName?: string;
  statusClassName?: string;
  footerClassName?: string;
  from: ReactNode;
  to: ReactNode;
  pickup: CxDateParts;
  delivery: CxDateParts;
  band: ReactNode;
  posted: ReactNode;
  postedAt?: ReactNode;
  loadId: ReactNode;
  vehicle: string;
  facts?: ReactNode;
  terms?: ReactNode;
  routeMeta?: ReactNode;
  statusMeta?: ReactNode;
  footer: ReactNode;
  footerRole?: string;
  footerAriaLabel?: string;
  expanded?: boolean;
  expandedContent?: ReactNode;
  extra?: ReactNode;
  state?: string;
  stage?: string;
  sold?: boolean;
};

/* Only print dates supplied by the authorized backend. Never default to today. */
function pickupCalendar(meta: ReactNode): {weekday: string; date: string} {
  if (typeof meta !== 'string') return {weekday: 'Date', date: 'TBC'};
  const british = meta.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  const iso = meta.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const year = Number(british ? british[3] : iso?.[1]);
  const month = Number(british ? british[2] : iso?.[2]);
  const day = Number(british ? british[1] : iso?.[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (!year || !month || !day || Number.isNaN(d.getTime()) || d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) {
    return {weekday: 'Date', date: 'TBC'};
  }
  return {
    weekday: d.toLocaleDateString('en-GB', {weekday:'short', timeZone:'UTC'}),
    date: d.toLocaleDateString('en-GB', {day:'2-digit',month:'short', timeZone:'UTC'}),
  };
}

export default function Master3150Card({
  mode, className='',mainClassName='',routeClassName='',timesClassName='',statusClassName='',footerClassName='',
  from,to,pickup,delivery,band,posted,postedAt,loadId,vehicle,facts,terms,routeMeta,statusMeta,
  footer,footerRole,footerAriaLabel,expanded=false,expandedContent,extra,state,stage,sold=false,
}:Master3150CardProps) {
  const calendar = pickupCalendar(pickup.meta);
  const stageText = (stage || state || '').toLowerCase();
  const tone = /cancel|withdraw|reject|unsuccessful|expired/.test(stageText)?'muted':
    /allocated|progress|booked|accepted/.test(stageText)?'blue':
    /pending|await|unallocat/.test(stageText)?'amber':'green';
  return (
    <article className={['xd-board-card','xd-shared-job-card','master3150-record',`master3150-record--${mode}`,className].filter(Boolean).join(' ')} data-state={state} data-stage={stage} data-master-reference="3150">
      <div className="xd-card-date" aria-label="Collection date and status">
        <span>{calendar.weekday}</span>
        <strong>{calendar.date}</strong>
        <em className={tone}>{sold?'SOLD':band}</em>
      </div>
      <div className={['xd-card-main',mainClassName].filter(Boolean).join(' ')}>
        <div className={['master3150-record__route',routeClassName].filter(Boolean).join(' ')}>
          <h3><span>{from}</span><i aria-hidden="true">→</i><span>{to}</span></h3>
          {routeMeta}
        </div>
        <div className={['master3150-record__times',timesClassName].filter(Boolean).join(' ')}>
          <div><span>Collection:</span> <strong>{pickup.primary}</strong>{pickup.meta && <small>{pickup.meta}</small>}</div>
          <div><span>Delivery:</span> <strong>{delivery.primary}</strong>{delivery.meta && <small>{delivery.meta}</small>}</div>
        </div>
        <div className="xd-card-facts">
          <span className="master3150-record__vehicle-fact">{vehicle}</span>
          {facts}
        </div>
        <p className="xd-card-terms">Ref: <strong>{loadId}</strong>{terms && <> | <b>Payment Terms:</b> {terms}</>}</p>
      </div>
      <div className={['xd-card-company',statusClassName].filter(Boolean).join(' ')}>
        <small>{mode === 'diary'?'Booking status':mode === 'quote'?'Quotation':'Posted by'}</small>
        <strong>{posted}</strong>
        {postedAt && <span className="master3150-record__posted-at">{postedAt}</span>}
        {statusMeta}
        {mode !== 'quote' && <div className={['xd-card-actions',footerClassName].filter(Boolean).join(' ')} role={footerRole} aria-label={footerAriaLabel}>{footer}</div>}
      </div>
      {mode === 'quote' && <div className={['xd-card-actions','master3150-record__full-footer',footerClassName].filter(Boolean).join(' ')} role={footerRole} aria-label={footerAriaLabel}>{footer}</div>}
      {expanded && expandedContent && <div className="xd-card-expanded">{expandedContent}</div>}
      {extra}
    </article>
  );
}
