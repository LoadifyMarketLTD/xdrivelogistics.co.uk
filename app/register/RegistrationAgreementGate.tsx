'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import {
  getRegistrationLegalConfig,
  type RegistrationLegalRole,
} from '../../lib/legal/registrationAgreements';

export type RegistrationAgreementGateValue = {
  agreementsAccepted: boolean;
  authorityConfirmed: boolean;
  roleDeclarationConfirmed: boolean;
  privacyAcknowledged: boolean;
};

type Props = {
  role: RegistrationLegalRole;
  value: RegistrationAgreementGateValue;
  onChange: (value: RegistrationAgreementGateValue) => void;
  disabled?: boolean;
};

const CHECKBOX_CLASS = 'mt-0.5 h-4 w-4 shrink-0 accent-[#F5A300]';

export const isRegistrationAgreementGateComplete = (value: RegistrationAgreementGateValue) =>
  value.agreementsAccepted &&
  value.authorityConfirmed &&
  value.roleDeclarationConfirmed &&
  value.privacyAcknowledged;

export default function RegistrationAgreementGate({ role, value, onChange, disabled = false }: Props) {
  const config = getRegistrationLegalConfig(role);

  const set = (key: keyof RegistrationAgreementGateValue, checked: boolean) => {
    onChange({ ...value, [key]: checked });
  };

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-[#D8E1EC] bg-[#F8FAFD]">
      <div className="border-b border-[#D8E1EC] bg-white px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFF3D6] text-[#173B73]">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-[#173B73]">Agreements & declarations</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[#667B94]">
              These confirmations apply to the XDrive role you selected. Nothing is pre-selected.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <label className="flex items-start gap-3 rounded-xl border border-[#DDE5EF] bg-white p-3 text-xs font-semibold leading-5 text-[#526983]">
          <input
            type="checkbox"
            checked={value.agreementsAccepted}
            onChange={(event) => set('agreementsAccepted', event.target.checked)}
            disabled={disabled}
            className={CHECKBOX_CLASS}
          />
          <span>
            I have read and agree to the agreements that apply to this account: {' '}
            {config.agreements.map((agreement, index) => (
              <span key={agreement.code}>
                {index > 0 ? (index === config.agreements.length - 1 ? ' and ' : ', ') : null}
                <Link href={agreement.href} target="_blank" className="font-black text-[#173B73] underline underline-offset-2">
                  {agreement.label}
                </Link>
              </span>
            ))}.
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-xl border border-[#DDE5EF] bg-white p-3 text-xs font-semibold leading-5 text-[#526983]">
          <input
            type="checkbox"
            checked={value.authorityConfirmed}
            onChange={(event) => set('authorityConfirmed', event.target.checked)}
            disabled={disabled}
            className={CHECKBOX_CLASS}
          />
          <span>{config.authorityDeclaration}</span>
        </label>

        <label className="flex items-start gap-3 rounded-xl border border-[#DDE5EF] bg-white p-3 text-xs font-semibold leading-5 text-[#526983]">
          <input
            type="checkbox"
            checked={value.roleDeclarationConfirmed}
            onChange={(event) => set('roleDeclarationConfirmed', event.target.checked)}
            disabled={disabled}
            className={CHECKBOX_CLASS}
          />
          <span>{config.roleDeclaration}</span>
        </label>

        <label className="flex items-start gap-3 rounded-xl border border-[#DDE5EF] bg-white p-3 text-xs font-semibold leading-5 text-[#526983]">
          <input
            type="checkbox"
            checked={value.privacyAcknowledged}
            onChange={(event) => set('privacyAcknowledged', event.target.checked)}
            disabled={disabled}
            className={CHECKBOX_CLASS}
          />
          <span>
            {config.privacyAcknowledgement} {' '}
            <Link href="/privacy" target="_blank" className="font-black text-[#173B73] underline underline-offset-2">
              Read Privacy Policy
            </Link>.
          </span>
        </label>

        <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-[11px] font-semibold leading-5 text-[#71849A]">
          Agreement versions are controlled by XDrive and recorded separately from optional marketing consent. Role-specific operational eligibility remains subject to onboarding and compliance checks.
        </div>
      </div>
    </section>
  );
}
