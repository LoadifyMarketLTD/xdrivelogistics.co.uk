import type { Metadata } from 'next';
import Link from 'next/link';
import { COMPANY_CONFIG } from '../config/company';

export const metadata: Metadata = {
  title: 'Company',
  description: 'Learn about XDrive Logistics Ltd, our platform, our mission and our UK logistics operations.',
};

const capabilities = [
  'Freight marketplace and transport job management',
  'Courier, owner-operator and fleet workspaces',
  'Driver allocation, status tracking and proof of delivery',
  'Operational records, invoicing and finance workflows',
];

export default function CompanyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-20 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm font-semibold text-amber-400 transition hover:text-amber-300">
          ← Back to Home
        </Link>

        <section className="mt-10 border border-slate-800 bg-slate-900 p-6 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Company</p>
          <h1 className="mt-3 text-3xl font-bold sm:text-5xl">Built for modern UK logistics operations</h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300">
            {COMPANY_CONFIG.legalName} is a UK logistics technology and transport operations company. XDrive brings freight customers,
            courier companies, owner-operators and drivers into one operational platform designed to make transport work easier to
            publish, allocate, complete, document and invoice.
          </p>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="border border-slate-800 bg-slate-900 p-6 sm:p-8">
            <h2 className="text-xl font-semibold">What XDrive provides</h2>
            <ul className="mt-5 space-y-3 text-slate-300">
              {capabilities.map((capability) => (
                <li key={capability} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 bg-amber-400" aria-hidden="true" />
                  <span>{capability}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="border border-slate-800 bg-slate-900 p-6 sm:p-8">
            <h2 className="text-xl font-semibold">Company details</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-slate-500">Legal name</dt>
                <dd className="mt-1 text-slate-200">{COMPANY_CONFIG.legalName}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Company number</dt>
                <dd className="mt-1 text-slate-200">{COMPANY_CONFIG.companyNumber}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Registered office</dt>
                <dd className="mt-1 text-slate-200">{COMPANY_CONFIG.address.full}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Established</dt>
                <dd className="mt-1 text-slate-200">1 February 2021</dd>
              </div>
            </dl>
          </section>
        </div>

        <section className="mt-8 border border-amber-500/40 bg-amber-500/10 p-6 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-8">
          <div>
            <h2 className="text-xl font-semibold">Speak with XDrive Logistics</h2>
            <p className="mt-2 text-slate-300">Contact our Blackburn team about transport, partnerships or platform access.</p>
          </div>
          <Link href="/contact" className="mt-5 inline-flex min-h-11 items-center justify-center bg-amber-400 px-5 font-semibold text-slate-950 transition hover:bg-amber-300 sm:mt-0">
            Contact us
          </Link>
        </section>
      </div>
    </main>
  );
}
