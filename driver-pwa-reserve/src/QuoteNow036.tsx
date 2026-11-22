import { useState, type ReactNode } from 'react';
import './QuoteNow036.css';

type ExtraDraft = { id: number; description: string; amount: string };
type Props = {
  company: string;
  reference: string;
  service: string;
  vehicle: string;
  distanceMiles?: number | null;
  travelMinutes?: number | null;
  terms: string;
  route: ReactNode;
  quoteAmount: string;
  setQuoteAmount: (value: string) => void;
  quoteEta: string;
  setQuoteEta: (value: string) => void;
  quoteNotes: string;
  setQuoteNotes: (value: string) => void;
  busy: boolean;
  onBack: () => void;
  onSubmit: (extrasTotal: number, extraDetails: string) => void;
};

const etaOptions: [string,string][] = [
  ['','Not supplied'],['5','ASAP · 5 min'],['15','15 minutes'],
  ['30','30 minutes'],['45','45 minutes'],['60','1 hour'],
  ['90','1 hour 30 min'],['120','2 hours']
];
const money = (value: number) => new Intl.NumberFormat('en-GB', {style:'currency',currency:'GBP'}).format(value);

export default function QuoteNow036(props: Props) {
  const [extras,setExtras] = useState<ExtraDraft[]>([]);
  const [extraError,setExtraError] = useState('');
  const [nextExtraId,setNextExtraId] = useState(1);
  const base = Number(props.quoteAmount);
  const validBase = props.quoteAmount.trim()!=='' && Number.isFinite(base) && base>0;
  const invalidExtras = extras.some(e=>e.description.trim()===''||e.amount.trim()===''||!Number.isFinite(Number(e.amount))||Number(e.amount)<0);
  const extrasTotal = extras.reduce((sum,e)=>sum+(Number(e.amount)||0),0);
  const total = (validBase?base:0)+extrasTotal;

  function addExtra() {
    if (extras.length>=5) return;
    setExtras(old=>[...old,{id:nextExtraId,description:'',amount:''}]);
    setNextExtraId(n=>n+1);
    setExtraError('');
  }
  function updateExtra(id: number, patch: Partial<ExtraDraft>) {
    setExtras(old=>old.map(e=>e.id===id?{...e,...patch}:e));
    setExtraError('');
  }
  function handleSubmit() {
    if (!validBase || props.busy) return;
    if (invalidExtras) {
      setExtraError('Complete each extra description and its non-negative amount.');
      return;
    }
    if (!Number.isFinite(total) || total<=0) {
      setExtraError('Enter a valid total quotation.');
      return;
    }
    const details = extras.length
      ? 'Extras: '+extras.map(e=>e.description.trim()+' '+money(Number(e.amount))).join('; ')
      : '';
    props.onSubmit(Number(extrasTotal.toFixed(2)), details);
  }

  return <div className="xd036-quote">
    <div className="xd036-top">
      <button type="button" className="xd036-back" onClick={props.onBack}>← Load details</button>
      <span>NEW QUOTATION</span>
    </div>
    <div className="xd036-page-title">
      <h1>Quote Now</h1>
      <p>{props.reference} · Your commercial offer</p>
    </div>
    <section className="xd036-card xd036-summary">
      <span className="xd036-eyebrow">LOAD SUMMARY</span>
      <h2>{props.company}</h2>
      <div className="xd036-tags">
        <span className="xd036-hot">{props.service}</span>
        <span className="xd036-required">{props.vehicle} required</span>
      </div>
      <div className="xd036-route">{props.route}</div>
      <div className="xd036-distance">
        {props.distanceMiles!=null&&<strong>{props.distanceMiles.toFixed(2)} miles</strong>}
        {props.travelMinutes!=null&&<strong>Approx. {props.travelMinutes} min</strong>}
        {props.distanceMiles==null&&props.travelMinutes==null&&<span>Route distance not supplied</span>}
      </div>
    </section>
    <section className="xd036-card xd036-input-card">
      <label className="xd036-field">
        <span>Will pick up within</span>
        <select aria-label="Will pick up within" value={props.quoteEta} onChange={e=>props.setQuoteEta(e.target.value)}>
          {etaOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <div className="xd036-field">
        <span>Your vehicle</span>
        <div className="xd036-readonly" aria-label="Required vehicle; validated by XDrive">{props.vehicle.replaceAll('_',' ')}</div>
        <small>Vehicle eligibility is verified by XDrive; this is not a local role or vehicle selector.</small>
      </div>
      <div className="xd036-money-row">
        <div className="xd036-field"><span>Currency</span><div className="xd036-readonly">GBP (£)</div></div>
        <label className="xd036-field">
          <span>My quote · total including VAT where applicable *</span>
          <input type="number" inputMode="decimal" min="0.01" step="0.01" value={props.quoteAmount}
            onChange={e=>props.setQuoteAmount(e.target.value)} aria-label="Your quote total including VAT where applicable" placeholder="Your price" />
        </label>
      </div>
      <div className="xd036-field xd036-extras-field">
        <span>Extras <small>(optional)</small></span>
        {extras.length>0&&<div className="xd036-extra-list">
          {extras.map(extra=><div className="xd036-extra" key={extra.id}>
            <input aria-label="Extra description" placeholder="Extra description" maxLength={100}
              value={extra.description} onChange={e=>updateExtra(extra.id,{description:e.target.value})}/>
            <input type="number" inputMode="decimal" min="0" step="0.01" aria-label="Extra amount GBP" placeholder="£ amount"
              value={extra.amount} onChange={e=>updateExtra(extra.id,{amount:e.target.value})}/>
            <button type="button" onClick={()=>{setExtras(current=>current.filter(e=>e.id!==extra.id));setExtraError('')}} aria-label="Remove extra">×</button>
          </div>)}
        </div>}
        <button type="button" className="xd036-add-extra" onClick={addExtra} disabled={extras.length>=5}>+ Add extra</button>
        {extraError&&<p role="alert" className="xd036-error">{extraError}</p>}
      </div>
    </section>
    <section className="xd036-card xd036-notes-card">
      <label className="xd036-field">
        <span>Notes to broker <small>(optional)</small></span>
        <textarea rows={4} value={props.quoteNotes} onChange={e=>props.setQuoteNotes(e.target.value)}
          placeholder="Your message, ETA or conditions" />
      </label>
    </section>
    <div className="xd036-total"><span>Total quotation</span><strong>{money(total)}</strong></div>
    <p className="xd036-terms">{props.terms || 'Payment terms not supplied'} · Extras are included in the quoted total and described in the broker message.</p>
    <button type="button" className="xd036-submit" disabled={!validBase||props.busy} onClick={handleSubmit}>
      {props.busy?'Saving…':'Submit Quote →'}
    </button>
  </div>;
}
