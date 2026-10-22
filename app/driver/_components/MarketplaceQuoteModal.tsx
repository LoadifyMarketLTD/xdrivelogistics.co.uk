'use client';

import { useEffect, useMemo, useState } from 'react';

import MarketplaceQuoteNowDialog, {
  type MarketplaceQuoteNowExtra,
} from '../../components/workspace/MarketplaceQuoteNowDialog';
import WorkspaceRestrictionBanner from '../../components/workspace/WorkspaceRestrictionBanner';
import { AlertBanner } from '../../components/workspace/WorkspaceUI';

export type MarketplaceQuoteSubmitPayload = {
  totalAmount: number;
  baseAmount: number;
  additionalExtrasGbp: number;
  message: string;
};

type QuoteTarget = {
  id: string;
  memberName: string;
  memberCode?: string | null;
  pickup: string;
  delivery: string;
  pickupAt?: string | null;
  deliveryAt?: string | null;
  vehicle: string;
};

type QuoteExtraKind = 'congestion' | 'ferry' | 'tolls' | 'ulez';

const QUOTE_EXTRA_OPTIONS: Array<{ value: QuoteExtraKind; label: string }> = [
  { value: 'congestion', label: 'Congestion Charge' },
  { value: 'ferry', label: 'Ferry Charge' },
  { value: 'tolls', label: 'Tolls' },
  { value: 'ulez', label: 'ULEZ' },
];

const cxWhen = (value?: string | null) => {
  if (!value) return 'ASAP';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'ASAP';
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '';
  const zone = parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
  return `${hour}:${minute}${zone ? ` (${zone})` : ''} ${date.toLocaleDateString('en-GB')}`;
};

export default function MarketplaceQuoteModal({
  target,
  amount,
  message,
  working,
  error,
  onAmountChange,
  onMessageChange,
  onSubmit,
  onClose,
}: {
  target: QuoteTarget | null;
  amount: string;
  message: string;
  working: boolean;
  error?: string;
  onAmountChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onSubmit: (payload: MarketplaceQuoteSubmitPayload) => void;
  onClose: () => void;
}) {
  const [extras, setExtras] = useState<MarketplaceQuoteNowExtra[]>([]);

  useEffect(() => {
    setExtras([]);
  }, [target?.id]);

  const baseAmount = Number(amount);
  const safeBaseAmount = Number.isFinite(baseAmount) && baseAmount > 0 ? baseAmount : 0;
  const extrasTotal = useMemo(
    () => extras.reduce((sum, extra) => {
      const value = Number(extra.amount);
      return sum + (Number.isFinite(value) && value > 0 ? value : 0);
    }, 0),
    [extras],
  );
  const total = safeBaseAmount + extrasTotal;

  if (!target) return null;

  return (
    <MarketplaceQuoteNowDialog
      target={{
        id: target.id,
        memberName: target.memberName,
        memberCode: target.memberCode,
        requestedVehicle: target.vehicle,
        pickup: target.pickup,
        delivery: target.delivery,
        pickupWhen: cxWhen(target.pickupAt),
        deliveryWhen: cxWhen(target.deliveryAt),
      }}
      working={working}
      errorContent={error ? (
        <div className="xdrive-quote-modal__error">
          <AlertBanner tone="danger">{error}</AlertBanner>
          <WorkspaceRestrictionBanner operation="quote" inline />
        </div>
      ) : null}
      vehicleValue=""
      vehicleOptions={[]}
      onVehicleChange={() => undefined}
      currencyValue="GBP"
      currencyOptions={[{ value: 'GBP', label: 'GBP - Pounds' }]}
      onCurrencyChange={() => undefined}
      currencySymbol="£"
      amount={amount}
      onAmountChange={onAmountChange}
      extras={extras}
      extraOptions={QUOTE_EXTRA_OPTIONS}
      onAddExtra={() => setExtras((current) => [
        ...current,
        { id: `${Date.now()}-${current.length}`, kind: 'congestion', amount: '' },
      ])}
      onExtraKindChange={(id, kind) => setExtras((current) => current.map((item) => (
        item.id === id ? { ...item, kind: kind as QuoteExtraKind } : item
      )))}
      onExtraAmountChange={(id, extraAmount) => setExtras((current) => current.map((item) => (
        item.id === id ? { ...item, amount: extraAmount } : item
      )))}
      onRemoveExtra={(id) => setExtras((current) => current.filter((item) => item.id !== id))}
      total={total}
      extrasTotal={extrasTotal}
      message={message}
      onMessageChange={onMessageChange}
      onClose={onClose}
      onSubmit={() => onSubmit({
        totalAmount: total,
        baseAmount: safeBaseAmount,
        additionalExtrasGbp: extrasTotal,
        message: message.trim(),
      })}
    />
  );
}
