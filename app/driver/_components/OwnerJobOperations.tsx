'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { useId, useRef } from 'react';
import './owner-job-operations.css';

export const OWNER_JOB_TABS = [
  ['overview', 'Overview'], ['booking', 'Booking'], ['route', 'Route & tracking'],
  ['pod', 'POD'], ['documents', 'Documents'], ['finance', 'Finance'], ['history', 'History'],
] as const;
export type OwnerJobTab = typeof OWNER_JOB_TABS[number][0];

type Props = {
  active: OwnerJobTab;
  onChange: (tab: OwnerJobTab) => void;
  header: ReactNode;
  alerts?: ReactNode;
  panels: Record<OwnerJobTab, ReactNode>;
  historyCount: number;
  podPending: boolean;
};

export default function OwnerJobOperations({active,onChange,header,alerts,panels,historyCount,podPending}: Props) {
  const id = useId();
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = OWNER_JOB_TABS.length - 1;
    const next = event.key === 'ArrowRight' ? (index+1) % (last+1) :
      event.key === 'ArrowLeft' ? (index+last) % (last+1) :
      event.key === 'Home' ? 0 : event.key === 'End' ? last : null;
    if (next === null) return;
    event.preventDefault();
    onChange(OWNER_JOB_TABS[next][0]);
    tabs.current[next]?.focus();
  }
  return <section className="xd-job-ops" aria-label="Owner Driver job operations">
    {header}
    {alerts && <div className="xd-job-alerts" aria-live="polite">{alerts}</div>}
    <nav className="xd-job-nav" aria-label="Job details sections">
      <div role="tablist" aria-label="Job details" className="xd-job-tablist">
        {OWNER_JOB_TABS.map(([key,label], index) => <button key={key} ref={node => {tabs.current[index]=node;}} type="button"
          role="tab" id={id+'-tab-'+key} aria-controls={id+'-panel-'+key}
          aria-selected={active===key} tabIndex={active===key?0:-1}
          onKeyDown={event=>keyboard(event,index)} onClick={()=>onChange(key)}>
          {label}{key==='history' && <span className="xd-job-tab-count">{historyCount}</span>}{key==='pod' && podPending && <span className="xd-job-tab-pending" aria-label="POD outstanding"/>}
        </button>)}
      </div>
    </nav>
    {OWNER_JOB_TABS.map(([key]) => <section key={key} id={id+'-panel-'+key} role="tabpanel"
      aria-labelledby={id+'-tab-'+key} tabIndex={0} hidden={active!==key} className="xd-job-tabpanel" data-job-panel={key}>
      {panels[key]}
    </section>)}
  </section>;
}

/** Display only: never changes the original job or its reference fields. */
export function ownerJobAddress(address: string | null | undefined, postcode: string | null | undefined): string {
  const a = address?.trim() ?? '';
  const p = postcode?.trim() ?? '';
  const normal = (value:string) => value.toUpperCase().replace(/\s+/g,'');
  if (!p) return a || 'Not supplied';
  if (!a) return p;
  const parts = a.split(',').map(value=>value.trim()).filter(Boolean);
  let seen=false;
  const unique=parts.filter(part=>{if(normal(part)!==normal(p))return true;if(seen)return false;seen=true;return true;});
  const clean=unique.join(', ');
  return seen || normal(clean).endsWith(normal(p)) ? clean : clean+', '+p;
}

/** Presentation-only locality, excluding country and postcode tokens. */
export function ownerJobArea(address: string | null | undefined, postcode: string | null | undefined): string {
  const p=(postcode??'').trim().toUpperCase();
  const outcode=p.replace(/\s+/g,'').replace(/\d[A-Z]{2}$/,'');
  const parts=(address??'').split(',').map(x=>x.trim()).filter(Boolean);
  const locality=parts.reverse().map(part=>part.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi,'').trim()).find(part=>part&&!/^(GB|UK|UNITED KINGDOM|GREAT BRITAIN|ENGLAND|SCOTLAND|WALES|NORTHERN IRELAND)$/i.test(part));
  const name=locality?.toUpperCase();
  return name ? (outcode&&!name.endsWith(outcode)?name+' '+outcode:name) : outcode||'Location not supplied';
}
