'use client';

import { ActionButton } from '../../components/workspace/WorkspaceUI';

type QuoteTarget = {
  id: string;
  memberName: string;
  memberCode?: string | null;
  pickup: string;
  delivery: string;
  pickupAt?: string | null;
  vehicle: string;
};

const when = (value?: string | null) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

export default function MarketplaceQuoteModal({
  target,
  amount,
  message,
  working,
  onAmountChange,
  onMessageChange,
  onSubmit,
  onClose,
}: {
  target: QuoteTarget | null;
  amount: string;
  message: string;
  working: boolean;
  onAmountChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  if (!target) return null;

  return (
    <div className="driver-quote-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !working) onClose(); }}>
      <section className="driver-quote-modal" role="dialog" aria-modal="true" aria-labelledby="driver-quote-modal-title">
        <header className="driver-quote-modal__header">
          <strong id="driver-quote-modal-title">Quote Now</strong>
          <button type="button" aria-label="Close quote form" disabled={working} onClick={onClose}>×</button>
        </header>

        <div className="driver-quote-modal__context">
          <div>
            <span>Member</span>
            <strong>{target.memberName}</strong>
            {target.memberCode && <small>ID {target.memberCode}</small>}
          </div>
          <div>
            <span>Load</span>
            <strong>{target.id.slice(0, 8).toUpperCase()}</strong>
            <small>{target.vehicle}</small>
          </div>
          <div className="driver-quote-modal__route">
            <span>From</span><strong>{target.pickup}</strong><small>{when(target.pickupAt)}</small>
          </div>
          <div className="driver-quote-modal__route">
            <span>To</span><strong>{target.delivery}</strong>
          </div>
        </div>

        <div className="driver-quote-modal__form">
          <label>
            <span>My quote price (exc. VAT)</span>
            <div className="driver-quote-modal__money"><b>£</b><input autoFocus type="number" min="1" step="0.01" value={amount} onChange={(event) => onAmountChange(event.target.value)} placeholder="0.00" /></div>
          </label>
          <div className="driver-quote-modal__total"><span>Total</span><strong>£ {Number(amount) > 0 ? Number(amount).toFixed(2) : '0.00'}</strong></div>
          <label>
            <span>Notes</span>
            <textarea rows={4} value={message} onChange={(event) => onMessageChange(event.target.value)} placeholder="Optional message to the posting member" />
          </label>
        </div>

        <footer className="driver-quote-modal__footer">
          <ActionButton tone="secondary" disabled={working} onClick={onClose}>Cancel</ActionButton>
          <ActionButton tone="success" disabled={working || !amount || Number(amount) <= 0} onClick={onSubmit}>{working ? 'Submitting…' : 'Submit Quote'}</ActionButton>
        </footer>
      </section>
    </div>
  );
}
