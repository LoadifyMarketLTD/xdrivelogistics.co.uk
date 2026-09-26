'use client';

import { useRef, useState } from 'react';
import { startStripeCompanyOnboarding } from '../../../lib/startStripeCompanyOnboarding';
import { ActionButton } from './WorkspaceUI';

type Props = { companyId: string; getAccessToken: () => Promise<string | null> };

export default function StripeSetupAction({ companyId, getAccessToken }: Props) {
  const inFlight = useRef(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const [opened, setOpened] = useState(false);
  const start = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setOpening(true);
    setError('');
    setOpened(false);
    try {
      await startStripeCompanyOnboarding(companyId, getAccessToken);
      setOpened(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Stripe setup could not be started. Please try again.');
    } finally {
      inFlight.current = false;
      setOpening(false);
    }
  };
  return (
    <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
      <div>
        <ActionButton disabled={opening} onClick={() => void start()} title="Open Stripe setup in a new tab">
          {opening ? 'Opening Stripe...' : 'Set up / activate Stripe'}
        </ActionButton>
      </div>
      <div style={{ fontWeight: 400, lineHeight: '18px' }}>
        Stripe opens in a new tab. Keep this load form open to retain your details.
        {' '}Once your company Stripe account is active, return here and publish the load again.
        {' '}Only a company owner or admin can complete Stripe setup.
      </div>
      {opened && <div role="status">Stripe setup opened. The load has not been published.</div>}
      {error && <div role="alert">{error}</div>}
    </div>
  );
}
