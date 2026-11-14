import { useEffect, useState, type ReactNode } from 'react';
import { driverGet, renewSession, type LiveJob, type LiveSession } from './liveApi';
import { routeLabel } from './routeLabel';
import './BookingWorkspace.css';

type Section = 'summary' | 'stops' | 'status';
type Mode = 'overview' | 'acceptance' | 'operation' | 'finance';
type Props = {
  job: LiveJob;
  session?: LiveSession;
  onSession?: (session:LiveSession)=>void;
  mode: Mode;
  initialSection?: Section;
  busy?: boolean;
  onBack: () => void;
  onMap: () => void;
  onOperate: () => void;
  onInvoice: () => void;
  onReturnToStatus?: () => void;
  onAccept: () => void;
  onDecline: () => void;
  operation?: ReactNode;
  podDocument?: ReactNode;
};

const stages = [
  { key: 'ALLOCATED', title: 'Accepted', detail: 'Booking confirmed' },
  { key: 'ON_WAY_TO_PICKUP', title: 'On My Way to Collection', detail: 'Navigate to collection' },
  { key: 'ON_SITE_PICKUP', title: 'On Site Collection', detail: 'Collection handover and evidence' },
  { key: 'LOADED', title: 'Loaded', detail: 'Goods, packaging and ETA recorded' },
  { key: 'ON_WAY_TO_DELIVERY', title: 'On My Way to Delivery', detail: 'Navigate to delivery' },
  { key: 'ON_SITE_DELIVERY', title: 'On Site Delivery', detail: 'Delivery handover and signature' },
  { key: 'DELIVERED', title: 'Delivered', detail: 'Confirm proof of delivery' },
  { key: 'POD_SUBMITTED', title: 'POD Recorded', detail: 'Signed documents available' },
  { key: 'INVOICE', title: 'Invoice', detail: 'Review and send the official invoice separately' },
] as const;

const backendStages: Record<string, string> = {
  allocated: 'ALLOCATED', assigned: 'ALLOCATED', accepted: 'ALLOCATED',
  on_my_way: 'ON_WAY_TO_PICKUP', on_way_to_pickup: 'ON_WAY_TO_PICKUP',
  on_site_pickup: 'ON_SITE_PICKUP', loaded: 'LOADED',
  in_transit: 'ON_WAY_TO_DELIVERY', on_way_to_delivery: 'ON_WAY_TO_DELIVERY',
  on_site_delivery: 'ON_SITE_DELIVERY', delivered: 'DELIVERED',
  pod_submitted: 'POD_SUBMITTED', completed: 'POD_SUBMITTED', invoice: 'INVOICE', invoiced: 'INVOICE',
};

function stageIndex(job: LiveJob): number {
  if (job.podRecorded || job.status === 'POD_SUBMITTED') return stages.findIndex(s => s.key === 'POD_SUBMITTED');
  return stages.findIndex(stage => stage.key === job.status);
}
function timestamp(raw?: string): string | null {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}
function timeLabel(day?: string, time?: string): string {
  return [time && time !== 'Not provided' ? time : '', day || ''].filter(Boolean).join(' · ') || 'Time not provided';
}
function normalisedPhone(phone?: string): string | null {
  const value = String(phone || '').trim();
  return /^\+?[\d\s()\-]{7,24}$/.test(value) ? value.replace(/[\s()\-]/g, '') : null;
}
function Line({ title, value }: { title: string; value: ReactNode }) {
  return <div className="xb-info-line"><dt>{title}</dt><dd>{value || 'Not provided'}</dd></div>;
}
function RouteStop({ number, title, address, schedule, onMap }: {
  number: number; title: string; address: string; schedule: string; onMap: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return <div className="xb-stop">
    <span className={'xb-stop-number'+(number===2?' xb-drop':'')}>{number}</span>
    <div className="xb-stop-body">
      <strong>{title}</strong>
      <small>{schedule}</small>
      <p>{address}</p>
      <div className="xb-stop-actions">
        <button type="button" onClick={onMap}>View on Map</button>
        <button type="button" className="xb-subtle" onClick={() => {
          void navigator.clipboard.writeText(address).then(() => setCopied(true)).catch(() => setCopied(false));
        }}>{copied ? 'Copied' : 'Copy address'}</button>
      </div>
    </div>
  </div>;
}
function StatusProgress({ job, session, onSession, onOperate, operationsAllowed = true }: {
  job: LiveJob; session?:LiveSession; onSession?:(session:LiveSession)=>void;
  onOperate: () => void; operationsAllowed?: boolean;
}) {
  const [invoiceStatus,setInvoiceStatus]=useState<{state:'unknown'|'missing'|'draft'|'created'|'sent';number?:string}>({state:'unknown'});
  useEffect(()=>{
    if(!session || !job.podRecorded)return;
    let active=true;
    setInvoiceStatus({state:'unknown'});
    void (async()=>{
      try {
        const fresh=await renewSession(session);
        if(active)onSession?.(fresh);
        const context=await driverGet('/finance/jobs/'+encodeURIComponent(job.id)+'/invoice-context',fresh.token,8000);
        const rows=Array.isArray(context.rows)?context.rows:[];
        const row=rows.find(value=>value&&typeof value==='object'&&!Array.isArray(value)&&value.id===job.id) as {invoice?:unknown}|undefined;
        const found=row?.invoice||context.invoice;
        const candidate=found&&typeof found==='object'&&!Array.isArray(found)?found as Record<string,unknown>:null;
        const id=typeof candidate?.id==='string'?candidate.id:'';
        if(!id){if(active)setInvoiceStatus({state:'missing'});return;}
        const detail=await driverGet('/finance/invoices/'+encodeURIComponent(id),fresh.token,8000);
        const invoice=detail.invoice&&typeof detail.invoice==='object'&&!Array.isArray(detail.invoice)?detail.invoice as Record<string,unknown>:candidate!;
        const sent=invoice.delivery_state==='sent'&&typeof invoice.delivery_message_id==='string'&&invoice.delivery_message_id.length>0;
        const draft=String(invoice.status||'').toLowerCase()==='draft';
        if(active)setInvoiceStatus({
          state:sent?'sent':draft?'draft':'created',
          number:String(invoice.invoice_number||invoice.id||id),
        });
      }catch{if(active)setInvoiceStatus({state:'unknown'});}
    })();
    return()=>{active=false};
  },[job.id,job.podRecorded,session?.token]);
  const current = stageIndex(job);
  const history = job.statusHistory || [];
  const statusEvent = (key: string) => {
    const matching = history.filter(event => backendStages[event.status.toLowerCase()] === key);
    return matching.length ? matching[matching.length - 1] : undefined;
  };
  const podRecorded = Boolean(job.podRecorded || job.status === 'POD_SUBMITTED');
  return <section className="xb-panel xb-status-panel" aria-label="Booking status timeline">
    <div className="xb-panel-heading"><h2>Booking status</h2><span className="xb-reference">{podRecorded ? 'POD RECORDED' : 'LIVE STATUS'}</span></div>
    <ol className="xb-timeline">{stages.map((stage, index) => {
      const isCurrent = index === current && !podRecorded;
      const event = statusEvent(stage.key);
      const complete = index < current || (podRecorded && index <= current) || (stage.key === 'INVOICE' && (Boolean(event)||invoiceStatus.state==='sent'));
      return <li key={stage.key} className={'xb-stage'+(complete?' xb-stage-done':'')+(isCurrent?' xb-stage-current':'')}>
        <span className="xb-stage-symbol" aria-hidden="true">{complete ? '✓' : isCurrent ? '●' : String(index+1)}</span>
        <div className="xb-stage-content">
          <strong>{stage.title}</strong><small>{stage.detail}</small>
          {stage.key==='INVOICE' ? <small>
            {invoiceStatus.state==='sent'?'Invoice '+(invoiceStatus.number||'')+' sent · provider accepted email':
             invoiceStatus.state==='draft'?'Invoice '+(invoiceStatus.number||'')+' saved as draft':
             invoiceStatus.state==='created'?'Invoice '+(invoiceStatus.number||'')+' created · sending not confirmed':
             invoiceStatus.state==='missing'?'Invoice not created':'Invoice state not verified'}
          </small> : event ? <time dateTime={event.at}>{timestamp(event.at) || 'Recorded, time unavailable'}</time>
            : complete ? <small>Stage progressed · timestamp unavailable</small> : null}
          {event?.notes && <p className="xb-event-note">{event.notes}</p>}
          {isCurrent && operationsAllowed && <button type="button" className="xb-stage-action" onClick={onOperate}>Open current step</button>}
        </div>
      </li>;
    })}</ol>
    {history.length === 0 && <p className="xb-evidence-note">The server did not return the historical timestamps. No event times have been invented.</p>}

  </section>;
}
export default function BookingWorkspace({
  job, session, onSession, mode, initialSection = 'summary', busy = false,
  onBack, onMap, onOperate, onInvoice, onReturnToStatus, onAccept, onDecline, operation, podDocument,
}: Props) {
  const [section, setSection] = useState<Section>(initialSection);
  const [decision, setDecision] = useState<'accept'|'decline'|null>(null);
  const awaiting = Boolean(job.acceptanceRequired && !job.offerExpired && job.offerId);
  const expired = Boolean(job.offerExpired);
  const podRecorded = Boolean(job.podRecorded || job.status === 'POD_SUBMITTED');
  const phone = normalisedPhone(job.contactPhone);
  const pickup = job.pickupAddress || routeLabel(job.from, job.fromOutcode);
  const delivery = job.deliveryAddress || routeLabel(job.to, job.toOutcode);
  const reference = job.yourRef || job.customerRef || job.id;
  const total = job.quote == null ? 'Not supplied' : new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP',
  }).format(job.quote);

  return <article className="xb-workspace" aria-label="Booking workspace">
    <header className="xb-heading">
      <div className="xb-heading-top">
        <h1>{job.company || 'Transport customer'}</h1>
        <p>Booking {reference}</p>
      </div>
      <div className="xb-heading-bottom">
        <span className="xb-state">{awaiting ? 'ACCEPTANCE REQUIRED' : expired ? 'EXPIRED OFFER' : podRecorded ? 'POD RECORDED' : job.status.replaceAll('_',' ')}</span>
        <button type="button" className="xb-back" onClick={onBack} aria-label="Back">← <span>Back</span></button>
      </div>
    </header>
    <div className="xb-tabs" role="tablist" aria-label="Booking information">
      {(['summary','stops','status'] as const).map(key => <button key={key} type="button"
        id={'xb-tab-'+key} role="tab" aria-controls={'xb-panel-'+key}
        aria-selected={section===key} className={section===key?'xb-tab-active':''}
        onClick={() => {setSection(key);setDecision(null);}}>
        {key[0].toUpperCase()+key.slice(1)}
      </button>)}
    </div>
    <div id={'xb-panel-'+section} role="tabpanel" aria-labelledby={'xb-tab-'+section}>
      {section === 'summary' && <section className="xb-panel">
        <div className="xb-panel-heading"><h2>Booking summary</h2><span className="xb-reference">{reference}</span></div>
        <div className="xb-contact-actions">
          {phone ? <>
            <a href={'tel:'+phone}>Call</a>
            <a href={'sms:'+phone}>Message</a>
          </> : <span className="xb-contact-unavailable">Customer phone not supplied. Contact details are unavailable.</span>}
        </div>
        <div className="xb-mini-route">
          <div><span>Collection</span><strong>{routeLabel(job.from, job.fromOutcode)}</strong><small>{timeLabel(job.pickupDate,job.pickup)}</small></div>
          <div><span>Delivery</span><strong>{routeLabel(job.to, job.toOutcode)}</strong><small>{timeLabel(job.deliveryDate,job.delivery)}</small></div>
        </div>
        <button type="button" className="xb-map-button" onClick={onMap}>View on Map</button>
        <dl className="xb-info">
          <Line title="Vehicle" value={job.vehicle}/><Line title="Service" value={String(job.service||'Transport').replaceAll('_',' ')}/><Line title="Agreed rate" value={total}/>
          <Line title="Payment terms" value={job.terms}/><Line title="Distance" value={job.distanceMiles!=null?job.distanceMiles+' miles':'Not provided'}/><Line title="Posted" value={job.postedAt?timestamp(job.postedAt)||'Not provided':'Not provided'}/><Line title="Weight" value={job.weight>0?job.weight+' kg':'Not provided'}/>
          <Line title="Number of items" value={job.items ?? 'Not provided'}/>
          <Line title="Customer reference" value={job.customerRef}/><Line title="Your reference" value={job.yourRef}/>
        </dl>
        <div className="xb-instructions"><h3>Special instructions</h3><p>{job.notes?.trim() || 'No special instructions supplied.'}</p></div>
      </section>}
      {section === 'stops' && <section className="xb-panel">
        <div className="xb-panel-heading"><h2>Route stops</h2><span className="xb-reference">2 stops</span></div>
        <RouteStop number={1} title="Collection Details" address={pickup}
          schedule={timeLabel(job.pickupDate,job.pickup)} onMap={onMap}/>
        <RouteStop number={2} title="Delivery Details" address={delivery}
          schedule={timeLabel(job.deliveryDate,job.delivery)} onMap={onMap}/>
      </section>}
      {section === 'status' && (mode === 'finance' ?
        <div className="xb-finance-panel" aria-label="POD and Invoice">
          {operation}
          {onReturnToStatus && <button type="button" className="xb-documents-back" onClick={onReturnToStatus}>← Booking status timeline</button>}
        </div> : mode === 'operation' && !podRecorded ?
        <div className="xb-status-workflow">
          <section className="xb-panel xb-current-panel" aria-label="Current booking operation">
            <div className="xb-panel-heading"><h2>Current booking step</h2><span className="xb-reference">{job.status.replaceAll('_',' ')}</span></div>
            {operation}
          </section>
          <StatusProgress job={job} session={session} onSession={onSession} onOperate={onOperate} operationsAllowed={!awaiting && !expired}/>
        </div> :
        <div className="xb-status-workflow">
          <StatusProgress job={job} session={session} onSession={onSession} onOperate={onOperate} operationsAllowed={!awaiting && !expired}/>
          {podRecorded && <section className="xb-panel xb-documents-panel" aria-label="Proof of delivery and invoice documents">
            <div className="xb-panel-heading"><h2>POD &amp; Invoice</h2><span className="xb-reference">SIGNED DOCUMENTS</span></div>
            <p className="xb-panel-description">The official signed POD is read-only. The invoice is managed separately in XDrive Finance.</p>
            <div className="xb-documents-actions">
              {podDocument}
              <button type="button" className="xb-primary xb-full" onClick={onInvoice}>Open POD & Invoice</button>
            </div>
          </section>}
        </div>)}
    </div>
    {awaiting && <section className="xb-decision" aria-label="Accept booking confirmation">
      {decision === null ? <>
        <p>Review the locations, collection and delivery times, price, vehicle, payment terms and special instructions before accepting this booking.</p>
        <div className="xb-decision-actions">
          <button type="button" className="xb-secondary" onClick={() => setDecision('decline')}>Decline</button>
          <button type="button" className="xb-primary" onClick={() => setDecision('accept')}>Review & Accept</button>
        </div>
      </> : <>
        <h2>{decision === 'accept' ? 'Accept booking' : 'Decline booking'}</h2>
        <strong className="xb-decision-ref">{reference}</strong>
        <p>{decision === 'accept'
          ? 'I accept this booking with the details displayed in this confirmation, including collection and delivery locations and times, agreed price, payment terms, vehicle requirements and special instructions.'
          : 'Declining this booking will notify the transport customer. This action cannot be undone from this screen.'}</p>
        <dl className="xb-info">
          <Line title="Collection" value={pickup+' · '+timeLabel(job.pickupDate,job.pickup)}/>
          <Line title="Delivery" value={delivery+' · '+timeLabel(job.deliveryDate,job.delivery)}/>
          <Line title="Agreed rate" value={total}/>
          <Line title="Payment terms" value={job.terms}/>
          <Line title="Vehicle" value={job.vehicle}/>
        </dl>
        <div className="xb-decision-actions">
          <button type="button" className="xb-secondary" disabled={busy} onClick={() => setDecision(null)}>Back</button>
          <button type="button" className={decision === 'accept' ? 'xb-primary' : 'xb-danger'}
            disabled={busy} onClick={decision === 'accept' ? onAccept : onDecline}>
            {busy ? 'Processing…' : decision === 'accept' ? 'Confirm Acceptance' : 'Confirm Decline'}
          </button>
        </div>
      </>}
    </section>}
    {expired && <p className="xb-evidence-note">This booking offer has expired. No acceptance action is available.</p>}
    {!awaiting && !expired && !podRecorded && mode === 'overview' && section!=='status' &&
      <div className="xb-next-action"><button type="button" className="xb-primary xb-full" onClick={onOperate}>Continue Booking</button></div>}


  </article>;
}

export function BookingListCard({job, busy = false, onDetails, onStatus, onOperate, onInvoice}: {
  job: LiveJob; busy?: boolean;
  onDetails: () => void; onStatus: () => void; onOperate: () => void; onInvoice: () => void;
}) {
  const offered = Boolean(job.acceptanceRequired && job.offerId);
  const expired = Boolean(job.offerExpired);
  const delivered = Boolean(job.podRecorded || job.status === 'DELIVERED' || job.status === 'POD_SUBMITTED');
  const reference = job.yourRef || job.customerRef || job.id;
  const stage = stages.find(item => item.key === job.status)?.title || job.status.replaceAll('_',' ');
  const price = job.quote == null ? 'Price not provided' : new Intl.NumberFormat('en-GB', {style:'currency', currency:'GBP'}).format(job.quote);
  return <article className="xb-list-card" aria-label={'Booking '+reference}>
    <div className="xb-list-top"><div><strong>{job.company || 'Transport customer'}</strong>
      <small>Ref: {reference}</small></div>
      <span className="xb-list-state">{offered ? expired ? 'OFFER EXPIRED' : 'ACCEPTANCE REQUIRED' : delivered ? 'DELIVERED' : stage.toUpperCase()}</span>
    </div>
    <div className="xb-list-route">
      <div><span className="xb-list-route-pin" aria-hidden="true">1</span><div><b>{routeLabel(job.from, job.fromOutcode)}</b><small>Collection · {timeLabel(job.pickupDate,job.pickup)}</small></div></div>
      <div><span className="xb-list-route-pin xb-list-drop" aria-hidden="true">2</span><div><b>{routeLabel(job.to, job.toOutcode)}</b><small>Delivery · {timeLabel(job.deliveryDate,job.delivery)}</small></div></div>
    </div>
    <div className="xb-list-metadata">
      <span>{String(job.service||'Transport').replaceAll('_',' ')}</span>
      <span>{job.vehicle || 'Vehicle not provided'}</span><span>{price}</span>
      <span>Payment: {job.terms || 'Not provided'}</span>
      {job.distanceMiles!=null&&<span>{job.distanceMiles} miles</span>}
      {job.weight>0&&<span>{job.weight} kg</span>}
    </div>
    {job.postedAt&&timestamp(job.postedAt)&&<small className="xb-list-posted">Posted: {timestamp(job.postedAt)}</small>}
    <div className="xb-list-actions">
      <button type="button" className="xb-secondary" onClick={onDetails} disabled={busy}>View Booking</button>
      <button type="button" className="xb-primary" onClick={onStatus} disabled={busy}>
        {offered ? 'Review Incoming Job' : 'Summary / Stops / Status'}
      </button>
    </div>
    {!offered && !expired && <div className="xb-list-actions xb-list-secondary-actions">
      {delivered ? <button type="button" className="xb-secondary" onClick={onInvoice}>POD & Invoice</button>
        : <button type="button" className="xb-secondary" onClick={onOperate}>Continue Delivery</button>}
    </div>}
  </article>;
}
