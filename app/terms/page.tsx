import type { Metadata } from 'next';
import Link from 'next/link';
import { COMPANY_CONFIG } from '../config/company';

export const metadata: Metadata = {
  title: 'Terms & Conditions | XDrive Logistics',
  description: 'Terms governing XDrive Logistics platform access, marketplace use and transport operations.',
};

const LAST_UPDATED = '1 September 2026';

const sections = [
  ['1. Who we are', <>{COMPANY_CONFIG.legalName} is a private limited company registered in England and Wales under company number {COMPANY_CONFIG.companyNumber}, with registered office at {COMPANY_CONFIG.address.full}. XDrive operates a courier and freight exchange and related operational software. Unless XDrive expressly contracts in writing to provide a transport service itself, XDrive acts as the platform operator and intermediary and is not the carrier, broker, employer, agent or contracting transport party for a job agreed between platform users.</>],
  ['2. Business use and accounts', <>The platform is intended primarily for businesses, self-employed transport professionals, carriers, brokers and transport customers acting in the course of business. Account information must be accurate and kept current. You are responsible for credentials, authorised users and activity on your account. We may require identity, company, insurance, tax or compliance information before or during access.</>],
  ['3. Marketplace jobs and contracts', <>A posted job is an invitation to submit an offer unless the posting expressly states otherwise. A quote is not awarded work until accepted through the applicable XDrive workflow or otherwise confirmed by the parties. When a customer or broker awards a third-party carrier or driver, the resulting transport contract is between those parties unless XDrive is expressly identified as a contracting party. Users are responsible for checking commercial terms, route, load, vehicle suitability, timing, insurance and any special requirements before acceptance.</>],
  ['4. Driver, carrier and vehicle compliance', <>Users must hold every licence, permission, operator authorisation, insurance policy, qualification and document legally required for the vehicle, load and transport activity they perform. Requirements vary by vehicle and operation; CPC, tachograph or operator-licensing requirements apply only where the law requires them. Users must not represent expired, invalid or inapplicable documents as compliant.</>],
  ['5. Membership, free period and platform fees', <>Current membership prices and included features are shown on the Pricing page and are subject to the separate Membership & Subscription Terms. The launch offer provides the advertised free access period to eligible approved accounts. XDrive does not take a percentage commission from the transport value of jobs and does not add an XDrive booking fee under the launch membership model. This does not prevent a carrier, broker, payment provider or other third party from charging its own separately disclosed fees.</>],
  ['6. Transport prices, invoices and payment between users', <>Job prices, payment terms, waiting time, accessorial charges, VAT treatment and invoicing between platform users are the responsibility of the relevant contracting parties. XDrive does not hold client funds under the current platform model. Where XDrive issues its own invoice for membership or separately contracted services, the invoice will identify the charge, VAT treatment and payment terms. Late commercial payments may be subject to contractual or statutory remedies only where legally applicable.</>],
  ['7. Proof of delivery and operational records', <>Statuses, timestamps, messages, POD, photographs, signatures, documents and invoice-readiness records may be stored against the job record. Users must upload only lawful, accurate and relevant evidence and must respect data-protection rights when capturing names, signatures, photographs or location information.</>],
  ['8. Prohibited use', <>You must not post fake or unlawful work, submit deceptive quotes, manipulate ratings or records, scrape or reverse engineer the service, bypass access controls, share accounts improperly, introduce malware, misuse personal data, harass users or use XDrive for unlawful goods or activity. Our Acceptable Use Policy forms part of these Terms.</>],
  ['9. Verification, tax and reporting obligations', <>We may collect and verify seller, business and tax information where required by law. Where UK digital-platform reporting rules apply, XDrive may be required to obtain, verify, retain and report prescribed seller information to HM Revenue & Customs and provide required reporting information to affected sellers.</>],
  ['10. Suspension and termination', <>We may restrict, suspend or terminate access where reasonably necessary for security, fraud prevention, non-payment, material breach, legal compliance, risk to other users or platform integrity. Where practicable we will explain the reason and give an opportunity to remedy a remediable breach. Membership cancellation and renewal are governed by the Membership & Subscription Terms.</>],
  ['11. Availability and changes', <>We aim to provide a reliable platform but do not guarantee uninterrupted or error-free availability. We may maintain, improve, replace or retire features. Material changes affecting paid membership will be communicated reasonably in advance where practicable and where required by law.</>],
  ['12. Liability', <>Nothing in these Terms excludes liability that cannot lawfully be excluded, including liability for death or personal injury caused by negligence, fraud or fraudulent misrepresentation. Subject to those rights, XDrive is not responsible for the independent acts, omissions, solvency, insurance, performance or cargo handling of third-party users. For business users, our aggregate liability arising from platform membership is limited to the membership fees actually paid to XDrive during the 12 months before the event giving rise to the claim, except where a different limit is required by law or agreed in a separate written contract.</>],
  ['13. Intellectual property', <>XDrive software, branding, content and platform design are owned by or licensed to {COMPANY_CONFIG.legalName}. You receive only the limited right to use the service for your authorised business purposes. User-uploaded content remains owned by the relevant user, but you grant XDrive the rights reasonably necessary to host, process, display and transmit it to provide the service.</>],
  ['14. Data protection and cookies', <>Our Privacy Policy explains how personal data is processed. Our Cookie Policy explains cookies and other storage/access technologies. These documents form part of the transparency information for use of XDrive.</>],
  ['15. Complaints and disputes', <>Please use our Complaints page first so we can investigate platform, membership or conduct concerns. Disputes concerning the underlying transport contract remain primarily between the contracting customer/broker and carrier/driver unless XDrive is itself a party to that contract.</>],
  ['16. Governing law', <>These Terms are governed by the law of England and Wales. For business users, the courts of England and Wales have exclusive jurisdiction, subject to any mandatory legal rights that apply otherwise.</>],
  ['17. Changes to these Terms', <>We may update these Terms for legal, security, operational or product reasons. The current version and effective date will be published here. Where a change materially affects paid membership or existing rights, we will provide any notice required by law or contract.</>],
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#071B3C] px-6 py-20 text-white">
      <div className="mx-auto max-w-[900px]">
        <Link href="/" className="text-sm font-black text-[#F5A300]">← Back to XDrive</Link>
        <p className="mt-10 text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">Legal</p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">Terms & Conditions</h1>
        <p className="mt-3 text-sm font-semibold text-white/55">Last updated: {LAST_UPDATED}</p>
        <div className="mt-10 grid gap-8 text-[0.98rem] font-medium leading-7 text-white/78">
          {sections.map(([title, body]) => <section key={String(title)}><h2 className="text-xl font-black text-[#F5A300]">{title}</h2><div className="mt-3">{body}</div></section>)}
          <section><h2 className="text-xl font-black text-[#F5A300]">18. Contact</h2><p className="mt-3">{COMPANY_CONFIG.legalName}<br />Company No. {COMPANY_CONFIG.companyNumber}<br />Registered office: {COMPANY_CONFIG.address.full}<br />Registered in England and Wales<br />Email: {COMPANY_CONFIG.email}<br />Phone: {COMPANY_CONFIG.phoneDisplay}</p></section>
        </div>
        <div className="mt-12 flex flex-wrap gap-4 border-t border-white/10 pt-7 text-sm font-black text-[#F5A300]"><Link href="/subscription-terms">Membership & Subscription Terms</Link><Link href="/acceptable-use">Acceptable Use</Link><Link href="/privacy">Privacy</Link><Link href="/cookies">Cookies</Link><Link href="/complaints">Complaints</Link></div>
      </div>
    </main>
  );
}
