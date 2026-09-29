import Link from 'next/link';
import { COMPANY_CONFIG } from '../../config/company';
import type { RoleTradingTermsDocument } from '../../../lib/legal/roleTradingTerms';

export default function RoleTradingTermsDocumentPage({ document }: { document: RoleTradingTermsDocument }) {
  return (
    <main className="min-h-screen bg-[#071B3C] px-6 py-20 text-white">
      <div className="mx-auto max-w-[900px]">
        <Link href="/legal" className="text-sm font-black text-[#F5A300]">← Back to Legal Centre</Link>
        <p className="mt-10 text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">Role-specific trading terms</p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">{document.title}</h1>
        <p className="mt-3 text-sm font-semibold text-white/55">Version {document.version} · Last updated: {document.lastUpdated}</p>
        <p className="mt-6 text-[0.98rem] font-semibold leading-7 text-white/75">{document.intro}</p>
        <div className="mt-10 grid gap-8 text-[0.98rem] font-medium leading-7 text-white/78">
          {document.sections.map((section, index) => (
            <section key={section.title}>
              <h2 className="text-xl font-black text-[#F5A300]">{index + 1}. {section.title}</h2>
              <p className="mt-3">{section.body}</p>
            </section>
          ))}
          <section>
            <h2 className="text-xl font-black text-[#F5A300]">{document.sections.length + 1}. Contact</h2>
            <p className="mt-3">{COMPANY_CONFIG.legalName}<br />Company No. {COMPANY_CONFIG.companyNumber}<br />Registered office: {COMPANY_CONFIG.address.full}<br />Registered in England and Wales<br />Email: {COMPANY_CONFIG.email}<br />Phone: {COMPANY_CONFIG.phoneDisplay}</p>
          </section>
        </div>
        <div className="mt-12 flex flex-wrap gap-4 border-t border-white/10 pt-7 text-sm font-black text-[#F5A300]">
          <Link href="/terms">Platform Terms</Link>
          <Link href="/subscription-terms">Membership Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/complaints">Complaints</Link>
        </div>
      </div>
    </main>
  );
}
