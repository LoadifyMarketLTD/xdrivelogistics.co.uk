import Link from 'next/link';
import { COMPANY_CONFIG } from '../../config/company';
import { buildControlledLegalDocument, isRtlLegalLanguage, LEGAL_LANGUAGE_LABELS, LEGAL_LANGUAGES, normalizeLegalLanguage, type ControlledLegalDocumentCode } from '../../../lib/legal/controlledLegalDocuments';
import { getLegalUiCopy } from '../../../lib/legal/legalUiCopy';

type Props = { code: ControlledLegalDocumentCode; lang?: string };

export default function ControlledLegalDocumentPage({ code, lang }: Props) {
  const language = normalizeLegalLanguage(lang);
  const document = buildControlledLegalDocument(code, language);
  const copy = getLegalUiCopy(language);
  return (
    <main dir={isRtlLegalLanguage(language) ? 'rtl' : 'ltr'} className="min-h-screen bg-[#071B3C] px-6 py-20 text-white">
      <div className="mx-auto max-w-[900px]">
        <Link href="/legal" className="text-sm font-black text-[#F5A300]">← {copy.backToLegalCentre}</Link>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">{copy.controlledLegalDocument}</p>
            <h1 className="mt-3 text-4xl font-black sm:text-5xl">{document.title}</h1>
            <p className="mt-3 text-sm font-semibold text-white/55">{copy.version} {document.version} · {copy.translation} {document.translationVersion}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {LEGAL_LANGUAGES.map((item) => (
              <Link key={item} href={`?lang=${item}`} className={`rounded-lg border px-3 py-2 text-xs font-black ${item === language ? 'border-[#F5A300] bg-[#F5A300] text-[#071B3C]' : 'border-white/15 text-white/70'}`}>
                {LEGAL_LANGUAGE_LABELS[item]}
              </Link>
            ))}
          </div>
        </div>
        {language !== 'en' && (
          <div className="mt-6 rounded-xl border border-[#F5A300]/30 bg-[#F5A300]/10 px-4 py-3 text-xs font-semibold leading-5 text-white/75">
            {copy.controlledTranslationNotice}
          </div>
        )}
        <p className="mt-6 text-[0.98rem] font-semibold leading-7 text-white/75">{document.intro}</p>
        <div className="mt-10 grid gap-8 text-[0.98rem] font-medium leading-7 text-white/78">
          {document.sections.map((section) => <section key={section.title}><h2 className="text-xl font-black text-[#F5A300]">{section.title}</h2><p className="mt-3">{section.body}</p></section>)}
          <section><h2 className="text-xl font-black text-[#F5A300]">{copy.contact}</h2><p className="mt-3">{COMPANY_CONFIG.legalName}<br />{copy.companyNumber} {COMPANY_CONFIG.companyNumber}<br />{copy.registeredOffice}: {COMPANY_CONFIG.address.full}<br />{copy.registeredInEnglandWales}<br />{copy.email}: {COMPANY_CONFIG.email}<br />{copy.phone}: {COMPANY_CONFIG.phoneDisplay}</p></section>
        </div>
      </div>
    </main>
  );
}
