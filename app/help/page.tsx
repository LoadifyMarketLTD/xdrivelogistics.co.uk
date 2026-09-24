import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { getCanonicalSiteOrigin } from '../../lib/siteUrl';

export const metadata: Metadata = {
  title: 'Help & FAQ',
  description: 'Clear factual answers about XDrive membership, transport jobs, quotes, POD, payments, verification and the current early-access platform model.',
  alternates: { canonical: '/help' },
};

const faqs = [
  { q: 'What is XDrive?', a: 'XDrive is a UK courier and freight exchange platform operated by XDrive Logistics Ltd, company number 13171804. It connects customers and brokers posting transport work with owner drivers and carriers who can quote for that work, then continue awarded jobs through dispatch, status updates, POD and finance-ready records.' },
  { q: 'Who can join?', a: 'Current early access is designed for customers and shippers, transport brokers, owner drivers and fleet operators. Applications may be reviewed before full access is enabled.' },
  { q: 'How does the 3-month free period work?', a: 'Eligible standard launch memberships include three months of platform access before paid membership begins. The plan, renewal amount and billing date are shown before any paid subscription is activated.' },
  { q: 'Does XDrive charge commission on jobs?', a: 'Under the current launch membership model, XDrive does not take a percentage commission from the transport price and does not add an XDrive booking fee. Membership charges are separate from the commercial price agreed for transport work.' },
  { q: 'Who pays for the transport job?', a: 'The parties to the transport job remain responsible for the agreed transport charges and payment terms between them. XDrive does not currently hold client funds or operate as an escrow or banking service under the platform model.' },
  { q: 'How are jobs posted and awarded?', a: 'Customers and brokers can post job requirements, carriers and owner drivers can submit quotes, and the poster can compare and award the job. The awarded job then becomes the operational record used for dispatch and completion.' },
  { q: 'What happens after a job is awarded?', a: 'The job can move through driver allocation, collection, in-transit updates, delivery and proof of delivery without creating a separate disconnected record.' },
  { q: 'What is POD?', a: 'Proof of Delivery (POD) is delivery evidence attached to the job record, such as confirmation details, timestamps and supported delivery evidence captured through the XDrive workflow.' },
  { q: 'How does XDrive handle verification?', a: 'XDrive can require identity, company, vehicle or insurance documents relevant to a member role and can record review status and expiry information. Public Product Status pages distinguish current capability from planned functionality.' },
  { q: 'Does XDrive perform every transport job?', a: 'No. XDrive normally operates as the platform intermediary. A transport job is performed by the carrier or owner driver who accepts it unless XDrive Logistics Ltd expressly contracts separately to provide or arrange the transport service itself.' },
  { q: 'What happens after the free period?', a: 'Standard launch membership is intended to be monthly rolling after the free period. Cancellation mechanics and billing details are shown in the Membership & Subscription Terms and billing flow. Published membership prices are shown before applicable VAT unless stated otherwise.' },
  { q: 'Where can I get help or raise a complaint?', a: 'Use the Contact page for general help and the Complaints & Disputes page for formal complaints, billing issues, platform conduct or dispute escalation.' },
] as const;

export default function HelpPage() {
  const canonicalSiteOrigin = getCanonicalSiteOrigin();
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
    isPartOf: { '@id': `${canonicalSiteOrigin}/#website` },
    about: { '@id': `${canonicalSiteOrigin}/#platform` },
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#102447]">
      <script
        id="xdrive-faq-schema"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <header className="border-b border-[#E2E8F1] bg-white">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <Link href="/"><Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={218} height={59} priority className="h-[44px] w-auto" /></Link>
          <div className="flex items-center gap-4 text-sm font-black text-[#0E3FA9]"><Link href="/platform">Platform</Link><Link href="/trust">Trust</Link><Link href="/contact">Contact</Link><Link href="/login">Sign In</Link></div>
        </div>
      </header>
      <main>
        <section className="bg-white px-5 py-20 sm:px-8 lg:py-28">
          <div className="mx-auto max-w-[1240px]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">Help & FAQ</p>
            <h1 className="mt-5 max-w-4xl text-[3.2rem] font-black leading-[0.96] tracking-tight text-[#0A234F] sm:text-[4.6rem]">Clear answers before you join XDrive.</h1>
            <p className="mt-7 max-w-3xl text-lg font-semibold leading-8 text-[#516987]">Membership, quoting, job ownership, POD, payments, verification and platform responsibilities — explained in plain language.</p>
          </div>
        </section>
        <section className="px-5 py-16 sm:px-8 lg:py-20">
          <div className="mx-auto grid max-w-[1240px] gap-4 md:grid-cols-2">
            {faqs.map((item, index) => (
              <details key={item.q} className="group rounded-2xl border border-[#E2E8F1] bg-white p-5 shadow-[0_12px_34px_rgba(8,38,86,0.05)]">
                <summary className="cursor-pointer list-none text-base font-black leading-6 text-[#0A234F] [&::-webkit-details-marker]:hidden"><span className="mr-3 text-[#F5A300]">{String(index + 1).padStart(2,'0')}</span>{item.q}</summary>
                <p className="mt-3 pl-9 text-sm font-semibold leading-6 text-[#60758F]">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="bg-gradient-to-br from-[#071B3C] to-[#0B2F6B] px-5 py-16 text-white sm:px-8">
          <div className="mx-auto flex max-w-[1240px] flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="text-3xl font-black">Still need help?</h2><p className="mt-3 font-semibold text-white/70">Contact XDrive or review the legal and membership documents before registering.</p></div>
            <div className="flex flex-wrap gap-3"><Link href="/contact" className="inline-flex items-center gap-2 rounded-lg bg-[#F5A300] px-5 py-3 text-sm font-black text-white">Contact XDrive <ArrowRight className="h-4 w-4" /></Link><Link href="/subscription-terms" className="rounded-lg border border-white/20 px-5 py-3 text-sm font-black">Membership Terms</Link></div>
          </div>
        </section>
      </main>
    </div>
  );
}
