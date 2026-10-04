'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { isRtlLegalLanguage, LEGAL_LANGUAGE_LABELS, LEGAL_LANGUAGES, type LegalLanguage } from '../../lib/legal/controlledLegalDocuments';
import {
  getRegistrationLegalConfig,
  type RegistrationLegalRole,
} from '../../lib/legal/registrationAgreements';
import { getAgreementAcceptanceLead, getTransportControlHeading, getTransportControlNotice } from '../../lib/legal/registrationDeclarations';
import { getLegalUiCopy } from '../../lib/legal/legalUiCopy';

export type RegistrationAgreementGateValue = {
  agreementsAccepted: boolean;
  authorityConfirmed: boolean;
  roleDeclarationConfirmed: boolean;
  privacyAcknowledged: boolean;
  languageComprehensionConfirmed: boolean;
  signerFullName: string;
};

type Props = {
  role: RegistrationLegalRole;
  value: RegistrationAgreementGateValue;
  onChange: (value: RegistrationAgreementGateValue) => void;
  language: LegalLanguage;
  onLanguageChange: (language: LegalLanguage) => void;
  disabled?: boolean;
};

const CHECKBOX_CLASS = 'mt-0.5 h-4 w-4 shrink-0 accent-[#F5A300]';

export const isRegistrationAgreementGateComplete = (value: RegistrationAgreementGateValue) =>
  value.agreementsAccepted &&
  value.authorityConfirmed &&
  value.roleDeclarationConfirmed &&
  value.privacyAcknowledged &&
  value.languageComprehensionConfirmed &&
  value.signerFullName.trim().length >= 2;

export default function RegistrationAgreementGate({ role, value, onChange, language, onLanguageChange, disabled = false }: Props) {
  const config = getRegistrationLegalConfig(role, language);
  const transportControlNotice = getTransportControlNotice(language);
  const transportControlHeading = getTransportControlHeading(language);
  const agreementAcceptanceLead = getAgreementAcceptanceLead(language);
  const copy = getLegalUiCopy(language);

  const set = <K extends keyof RegistrationAgreementGateValue>(key: K, nextValue: RegistrationAgreementGateValue[K]) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <section dir={isRtlLegalLanguage(language) ? 'rtl' : 'ltr'} className="mt-4 overflow-hidden rounded-2xl border border-[#D8E1EC] bg-[#F8FAFD]">
      <div className="border-b border-[#D8E1EC] bg-white px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFF3D6] text-[#173B73]">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-[#173B73]">{copy.agreementsHeading}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[#667B94]">
              {copy.agreementsDescription}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <label className="block rounded-xl border border-[#DDE5EF] bg-white p-3 text-xs font-semibold text-[#526983]">
          <span className="mb-2 block font-black text-[#173B73]">{copy.signerName}</span>
          <input type="text" value={value.signerFullName} onChange={(event) => set('signerFullName', event.target.value)} disabled={disabled} maxLength={120} autoComplete="name" className="w-full rounded-lg border border-[#D8E1EC] bg-white px-3 py-2 font-bold text-[#173B73]" placeholder={copy.signerPlaceholder} />
          <span className="mt-2 block text-[11px] leading-4 text-[#71849A]">{copy.signerExplanation}</span>
        </label>

        <label className="block rounded-xl border border-[#DDE5EF] bg-white p-3 text-xs font-semibold text-[#526983]">
          <span className="mb-2 block font-black text-[#173B73]">{copy.languageLabel}</span>
          <select value={language} onChange={(event) => onLanguageChange(event.target.value as LegalLanguage)} disabled={disabled} className="w-full rounded-lg border border-[#D8E1EC] bg-white px-3 py-2 font-bold text-[#173B73]">
            {LEGAL_LANGUAGES.map((item) => <option key={item} value={item}>{LEGAL_LANGUAGE_LABELS[item]}</option>)}
          </select>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-[#DDE5EF] bg-white p-3 text-xs font-semibold leading-5 text-[#526983]">
          <input
            type="checkbox"
            checked={value.languageComprehensionConfirmed}
            onChange={(event) => set('languageComprehensionConfirmed', event.target.checked)}
            disabled={disabled}
            className={CHECKBOX_CLASS}
          />
          <span>{copy.languageComprehensionConfirmation}</span>
        </label>

        <div className="rounded-xl border border-[#F5D48A] bg-[#FFF8E8] px-3 py-3 text-[11px] font-semibold leading-5 text-[#5A4A24]">
          <span className="mb-1 block font-black text-[#173B73]">{transportControlHeading}</span>
          {transportControlNotice}
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-[#DDE5EF] bg-white p-3 text-xs font-semibold leading-5 text-[#526983]">
          <input
            type="checkbox"
            checked={value.agreementsAccepted}
            onChange={(event) => set('agreementsAccepted', event.target.checked)}
            disabled={disabled}
            className={CHECKBOX_CLASS}
          />
          <span>
            {agreementAcceptanceLead} {' '}
            {config.agreements.map((agreement, index) => (
              <span key={agreement.code}>
                {index > 0 ? (index === config.agreements.length - 1 ? ' and ' : ', ') : null}
                <Link href={`${agreement.href}?lang=${language}`} target="_blank" className="font-black text-[#173B73] underline underline-offset-2">
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
            <Link href={`/legal/privacy?lang=${language}`} target="_blank" className="font-black text-[#173B73] underline underline-offset-2">
              {copy.privacyLinkLabel}
            </Link>.
          </span>
        </label>

        <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-[11px] font-semibold leading-5 text-[#71849A]">
          {copy.legalControlFooter}
        </div>
      </div>
    </section>
  );
}
