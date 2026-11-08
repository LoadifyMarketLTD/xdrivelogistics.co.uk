'use client';

import { useState, type ReactNode } from 'react';
import Canonical3150QuoteInformation, { CANONICAL_3150_QUOTE_TABS, type Canonical3150QuoteTab } from './Canonical3150QuoteInformation';
import './canonical3150-quote-tabs.css';

/** Canonical original 3150 drawer and four-tab navigation: DemoQuotePanel.tsx is the visual source. */
export type MarketplaceQuoteNowTarget = {
  id: string;
  memberName: string;
  memberCode?: string | null;
  requestedVehicle: string;
  pickup: string;
  delivery: string;
  pickupWhen: ReactNode;
  deliveryWhen: ReactNode;
  pickupDate?: string | null;
  deliveryDate?: string | null;
  pickupStart?: string | null;
  deliveryTime?: string | null;
  pallets?: number | null;
  weight?: string | null;
  dimensions?: string | null;
  cargo?: string | null;
  service?: string | null;
  notes?: string | null;
  paymentTerms?: string | null;
  hardPod?: string | null;
};
export type MarketplaceQuoteNowOption = { value: string; label: string };
export type MarketplaceQuoteNowExtra = { id: string; kind: string; amount: string };
export type Canonical3150QuoteMeta = { service: string; etaToCollection: string; validityHours: string };

type QuoteProps = {
  target: MarketplaceQuoteNowTarget;
  working: boolean;
  errorContent?: ReactNode;
  vehicleValue: string;
  vehiclePlaceholder?: string;
  vehicleOptions?: MarketplaceQuoteNowOption[];
  vehicleLoading?: boolean;
  onVehicleChange: (value: string) => void;
  selectedVehicleImageSrc?: string | null;
  currencyValue: string;
  currencyOptions: MarketplaceQuoteNowOption[];
  onCurrencyChange: (value: string) => void;
  currencySymbol: string;
  amount: string;
  onAmountChange: (value: string) => void;
  extras: MarketplaceQuoteNowExtra[];
  extraOptions: MarketplaceQuoteNowOption[];
  onAddExtra: () => void;
  onExtraKindChange: (id: string, kind: string) => void;
  onExtraAmountChange: (id: string, amount: string) => void;
  onRemoveExtra: (id: string) => void;
  total: number;
  extrasTotal: number;
  message: string;
  onMessageChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (meta: Canonical3150QuoteMeta) => void;
  draftOwnerId?: string | null;
};

export default function MarketplaceQuoteNowDialog({
  target, working, errorContent, vehicleValue, vehiclePlaceholder = 'Choose vehicle later',
  vehicleOptions = [], vehicleLoading = false, onVehicleChange, selectedVehicleImageSrc,
  currencyValue, currencyOptions, onCurrencyChange, currencySymbol, amount, onAmountChange,
  extras, extraOptions, onAddExtra, onExtraKindChange, onExtraAmountChange, onRemoveExtra,
  total, extrasTotal, message, onMessageChange, onClose, onSubmit, draftOwnerId,
}: QuoteProps) {
  const [activeTab, setActiveTab] = useState<Canonical3150QuoteTab>('Quote');
  const [service, setService] = useState('Standard');
  const [eta, setEta] = useState('');
  const [validity, setValidity] = useState('24');
  const [draftNotice, setDraftNotice] = useState('');
  const load = {
    id: target.id, from: target.pickup, to: target.delivery, customer: target.memberName,
    vehicle: target.requestedVehicle, pickupDate: target.pickupDate, deliveryDate: target.deliveryDate,
    pickupStart: target.pickupStart, deliveryTime: target.deliveryTime, pallets: target.pallets,
    weight: target.weight, dimensions: target.dimensions, cargo: target.cargo, service: target.service,
    notes: target.notes, paymentTerms: target.paymentTerms, hardPod: target.hardPod,
  };
  const draftKey = draftOwnerId ? `xdrive-3150-quote-draft:${draftOwnerId}:${target.id}` : null;
  const saveDraft = () => {
    if (!draftKey) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ amount, vehicleValue, currencyValue, message, service, eta, validity }));
      setDraftNotice('Draft saved on this device. Not submitted.');
    } catch { setDraftNotice('Unable to save draft on this device.'); }
  };
  const restoreDraft = () => {
    if (!draftKey) return;
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || 'null') as Record<string,string> | null;
      if (!draft) { setDraftNotice('No draft saved for this load.'); return; }
      onAmountChange(draft.amount || '');
      onVehicleChange(draft.vehicleValue || '');
      if (currencyOptions.some((item) => item.value === draft.currencyValue)) onCurrencyChange(draft.currencyValue);
      onMessageChange(draft.message || '');
      setService(draft.service || 'Standard'); setEta(draft.eta || ''); setValidity(draft.validity || '24');
      setDraftNotice('Draft restored.');
    } catch { setDraftNotice('Saved draft is unavailable.'); }
  };
  const submit = () => {
    if (working || !(Number(amount) > 0) || !(total > 0) || !eta) return;
    onSubmit({ service, etaToCollection: eta, validityHours: validity });
  };
  return <div className="xdrive3150-live-quote">
    <div className="xd-quote-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !working) onClose(); }}>
      <section className="xd-quote-panel" role="dialog" aria-modal="true" aria-label="Submit marketplace quote">
        <header className="xd-quote-top"><h2>Submit Quote - Load {target.id.slice(0,8).toUpperCase()}</h2><button type="button" disabled={working} onClick={onClose} aria-label="Close quote panel">×</button></header>
        <div className="xd-quote-route"><strong>{load.from.toUpperCase()} <span aria-hidden="true">→</span> {load.to.toUpperCase()}</strong><small>{load.pickupDate || 'Date TBC'} | {load.service || 'On Demand'} | Posted by {load.customer}</small></div>
        <nav className="xd-quote-nav" aria-label="Quote details sections">
          {CANONICAL_3150_QUOTE_TABS.map((tab) => <button type="button" key={tab} className={activeTab === tab ? 'active' : ''} aria-current={activeTab === tab ? 'page' : undefined} onClick={() => setActiveTab(tab)}>{tab}</button>)}
        </nav>
        {activeTab === 'Quote' ? <div className="xd-quote-grid">
          <Canonical3150QuoteInformation tab="Quote" load={load} onReturn={() => setActiveTab('Quote')} />
          <form className="xd-quote-form" onSubmit={(event) => { event.preventDefault(); submit(); }}>
            <h3>Your Quote</h3>
            {errorContent}
            <label>Your Price ({currencyValue}) *<div className="xd-quote-price"><span>{currencySymbol}</span><input id="marketplace-quote-amount" type="number" inputMode="decimal" min="0.01" step="0.01" required placeholder="0.00" value={amount} onChange={(event) => onAmountChange(event.target.value)}/></div></label>
            <label>Service Type *<select value={service} onChange={(event) => setService(event.target.value)}><option>Standard</option><option>Same Day</option><option>Next Day</option><option>Express</option></select></label>
            <label>Vehicle *<select id="marketplace-quote-vehicle" disabled={vehicleLoading} value={vehicleValue} onChange={(event) => onVehicleChange(event.target.value)}>
              <option value="">{vehicleLoading ? 'Loading active fleet' : vehiclePlaceholder}</option>
              {vehicleOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select></label>
            {selectedVehicleImageSrc ? <img className="xd-quote-selected-vehicle" src={selectedVehicleImageSrc} alt="" aria-hidden="true" /> : null}
            <label>ETA to Collection *<select className="xd-quote-eta" value={eta} required onChange={(event) => setEta(event.target.value)}><option value="">Select ETA</option><option value="ASAP">ASAP</option><option value="ONTIME">On Time</option><option value="15">15 Minutes</option><option value="30">30 Minutes</option><option value="45">45 Minutes</option><option value="60">1 Hour</option><option value="90">1 Hour 30 Minutes</option><option value="120">2 Hours</option></select></label>
            <label>Quote Valid For *<select value={validity} onChange={(event) => setValidity(event.target.value)}><option value="1">1 Hour</option><option value="4">4 Hours</option><option value="12">12 Hours</option><option value="24">24 Hours</option><option value="48">48 Hours</option></select></label>
            <label>Notes to Customer (Optional)<textarea maxLength={250} rows={4} value={message} onChange={(event) => onMessageChange(event.target.value)} placeholder="Vehicle availability, equipment, collection ETA and other information"/></label>
            <small className="xd-quote-counter">{message.length} / 250</small>
            <details className="xd-quote-commercial-extras"><summary>Additional charges &amp; currency</summary>
              <label>Currency<select value={currencyValue} onChange={(event) => onCurrencyChange(event.target.value)}>{currencyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <button type="button" onClick={onAddExtra}>Add Extra</button>
              {extras.map((extra) => <div key={extra.id} className="xd-quote-extra-row"><select aria-label="Additional charge type" value={extra.kind} onChange={(event) => onExtraKindChange(extra.id,event.target.value)}>{extraOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><input aria-label="Additional charge amount" type="number" min="0" step="0.01" value={extra.amount} onChange={(event) => onExtraAmountChange(extra.id,event.target.value)}/><button type="button" aria-label="Remove extra" onClick={() => onRemoveExtra(extra.id)}>Remove</button></div>)}
              {extrasTotal > 0 && <p>Additional charges: {currencySymbol}{extrasTotal.toFixed(2)}. Total: {currencySymbol}{total.toFixed(2)}</p>}
            </details>
            {draftNotice && <p role="status" className="xd-quote-message">{draftNotice}</p>}
            <button className="xd-quote-submit" disabled={working || !(total > 0) || !eta} type="submit">{working ? 'Submitting...' : 'Submit Quote'}</button>
            <div className="xd-quote-bottom"><button type="button" disabled={!draftKey || working} onClick={saveDraft}>Save Draft</button><button type="button" disabled={!draftKey || working} onClick={restoreDraft}>Restore Draft</button><button type="button" disabled={working} onClick={onClose}>Cancel</button></div>
          </form>
        </div> : <Canonical3150QuoteInformation tab={activeTab} load={load} onReturn={() => setActiveTab('Quote')} />}
      </section>
    </div>
  </div>;
}