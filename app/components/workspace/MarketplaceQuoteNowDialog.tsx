'use client';

import type { ReactNode } from 'react';

import { ActionButton, WorkspaceDialog } from './WorkspaceUI';
import { recoverWorkspaceVehicleImage, workspaceVehicleImageSrc } from './vehiclePresentation';

export type MarketplaceQuoteNowTarget = {
  id: string;
  memberName: string;
  memberCode?: string | null;
  requestedVehicle: string;
  pickup: string;
  delivery: string;
  pickupWhen: ReactNode;
  deliveryWhen: ReactNode;
};

export type MarketplaceQuoteNowOption = {
  value: string;
  label: string;
};

export type MarketplaceQuoteNowExtra = {
  id: string;
  kind: string;
  amount: string;
};

export default function MarketplaceQuoteNowDialog({
  target,
  working,
  errorContent,
  vehicleValue,
  vehiclePlaceholder = 'Choose vehicle later',
  vehicleOptions = [],
  vehicleLoading = false,
  onVehicleChange,
  selectedVehicleImageSrc,
  currencyValue,
  currencyOptions,
  onCurrencyChange,
  currencySymbol,
  amount,
  onAmountChange,
  extras,
  extraOptions,
  onAddExtra,
  onExtraKindChange,
  onExtraAmountChange,
  onRemoveExtra,
  total,
  extrasTotal,
  message,
  onMessageChange,
  onClose,
  onSubmit,
}: {
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
  onSubmit: () => void;
}) {
  const mark = target.memberName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'XD';

  const baseAmount = Number(amount);
  const safeBaseAmount = Number.isFinite(baseAmount) && baseAmount > 0 ? baseAmount : 0;

  return (
    <WorkspaceDialog
      ariaLabel="Submit marketplace quote"
      title="Quote Now"
      width={468}
      maxHeight={760}
      onDismiss={onClose}
      dismissDisabled={working}
      headerActions={
        <button
          type="button"
          className="xdrive-quote-modal__close"
          aria-label="Close quote form"
          disabled={working}
          onClick={onClose}
        >
          ×
        </button>
      }
      actions={
        <>
          <ActionButton tone="secondary" disabled={working} onClick={onClose}>Cancel</ActionButton>
          <ActionButton tone="success" disabled={working || total <= 0} onClick={onSubmit}>
            {working ? 'Submitting…' : 'Submit Quote'}
          </ActionButton>
        </>
      }
    >
      <div className="xdrive-quote-modal">
        <section className="xdrive-quote-modal__member">
          <div className="xdrive-quote-modal__mark" aria-hidden="true">{mark}</div>
          <div className="xdrive-quote-modal__member-copy">
            <strong>{target.memberName}</strong>
            <span>Member ID: <b>{target.memberCode ?? '—'}</b></span>
            <span>Load ID: <b>{target.id.slice(0, 8).toUpperCase()}</b></span>
            <span>Requested: <b>{target.requestedVehicle}</b></span>
          </div>
          <img
            className="xdrive-quote-modal__requested-vehicle"
            src={workspaceVehicleImageSrc(target.requestedVehicle)}
            onError={(event) => recoverWorkspaceVehicleImage(event.currentTarget)}
            alt=""
            aria-hidden="true"
          />
        </section>

        <section className="xdrive-quote-modal__route">
          <div><span>From:</span><strong>{target.pickup}</strong><time>{target.pickupWhen}</time></div>
          <div><span>To:</span><strong>{target.delivery}</strong><time>{target.deliveryWhen}</time></div>
        </section>

        {errorContent}

        <section className="xdrive-quote-modal__form">
          <div className="xdrive-quote-modal__field-row">
            <label htmlFor="marketplace-quote-vehicle">Vehicle:<sup>*</sup></label>
            <div className="xdrive-quote-modal__vehicle-select">
              <select
                id="marketplace-quote-vehicle"
                value={vehicleValue}
                onChange={(event) => onVehicleChange(event.target.value)}
                disabled={vehicleLoading}
              >
                <option value="">{vehicleLoading ? 'Loading active fleet…' : vehiclePlaceholder}</option>
                {vehicleOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {selectedVehicleImageSrc ? <img src={selectedVehicleImageSrc} onError={(event) => recoverWorkspaceVehicleImage(event.currentTarget)} alt="" aria-hidden="true" /> : null}
            </div>
          </div>

          <div className="xdrive-quote-modal__field-row">
            <label htmlFor="marketplace-quote-currency">Choose currency:</label>
            <select
              id="marketplace-quote-currency"
              className="xdrive-quote-modal__currency"
              value={currencyValue}
              onChange={(event) => onCurrencyChange(event.target.value)}
            >
              {currencyOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="xdrive-quote-modal__field-row xdrive-quote-modal__price-row">
            <label htmlFor="marketplace-quote-amount">My Quote:<sup>*</sup><small>price (exc. VAT)</small></label>
            <div className="xdrive-quote-modal__money">
              <span>{currencySymbol}</span>
              <input
                id="marketplace-quote-amount"
                autoFocus
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(event) => onAmountChange(event.target.value)}
              />
            </div>
            <button type="button" className="xdrive-quote-modal__extras-trigger" onClick={onAddExtra}>
              Extras <b>＋</b>
            </button>
          </div>

          {extras.length > 0 ? (
            <div className="xdrive-quote-modal__extras">
              {extras.map((extra) => (
                <div key={extra.id} className="xdrive-quote-modal__extra-row">
                  <select value={extra.kind} onChange={(event) => onExtraKindChange(extra.id, event.target.value)}>
                    {extraOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <div className="xdrive-quote-modal__money xdrive-quote-modal__money--small">
                    <span>{currencySymbol}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={extra.amount}
                      onChange={(event) => onExtraAmountChange(extra.id, event.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="xdrive-quote-modal__extra-remove"
                    aria-label="Remove extra"
                    onClick={() => onRemoveExtra(extra.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="xdrive-quote-modal__total">
            <span>Total:</span><strong>{currencySymbol} {total.toFixed(2)}</strong>
            {extrasTotal > 0 ? (
              <small>
                {currencySymbol}{safeBaseAmount.toFixed(2)} quote + {currencySymbol}{extrasTotal.toFixed(2)} extras
              </small>
            ) : null}
          </div>

          <label className="xdrive-quote-modal__notes">
            <span>Notes:</span>
            <textarea
              value={message}
              onChange={(event) => onMessageChange(event.target.value)}
              rows={4}
              placeholder="Add availability, timing or commercial notes…"
            />
          </label>
        </section>
      </div>
    </WorkspaceDialog>
  );
}
