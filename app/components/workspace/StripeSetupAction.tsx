'use client';

import { useRef, useState } from 'react';
import { startStripeCompanyOnboarding } from '../../../lib/startStripeCompanyOnboarding';
import { ActionButton } from './WorkspaceUI';

type Props = { companyId: string; getAccessToken: () => Promise<string | null>; context?: 'post_load' | 'quote' | 'commercial' };

export default function StripeSetupAction({ companyId, getAccessToken, context = 'post_load' }: Props) {
  const inFlight = useRef(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const [failureCode, setFailureCode] = useState('');
  const [opened, setOpened] = useState(false);
  const start = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setOpening(true);
    setError('');
    setFailureCode('');
    setOpened(false);
    try {
      await startStripeCompanyOnboarding(companyId, getAccessToken);
      setOpened(true);
    } catch (reason) {
      setFailureCode(reason && typeof reason === 'object' && 'code' in reason ? String(reason.code ?? '') : '');
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
        {context === 'post_load' ? 'Stripe opens in a new tab. Keep this load form open to retain your details.' : 'Stripe opens in a new tab. Keep this workspace open to retain your details.'}
        {' '}{context === 'post_load' ? 'Once your company Stripe account is active, return here and publish the load again.' : 'Once the company Stripe account is active, return here and re-check the requirements. No quote or load is submitted automatically.'}
        {' '}Only a company owner or admin can complete Stripe setup.
      </div>
      {opened && <div role="status">{context === 'post_load' ? 'Stripe setup opened. The load has not been published.' : 'Stripe setup opened. No commercial action has been submitted.'}</div>}
      {error && <div role="alert">{error}</div>}
      {error && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {failureCode !== 'STRIPE_PLATFORM_SETUP_REQUIRED' && <a href={'/settings/payments?companyId=' + encodeURIComponent(companyId)} target="_blank" rel="noopener noreferrer">Open payment setup page</a>}
        <a href="/support/feedback?category=payments" target="_blank" rel="noopener noreferrer">Contact XDrive support</a>
      </div>}
    </div>
  );
}
