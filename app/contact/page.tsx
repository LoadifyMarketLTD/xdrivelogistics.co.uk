import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Headphones, Mail, MapPin, Phone, ReceiptText, Truck } from 'lucide-react';
import { COMPANY_CONFIG } from '../config/company';

export const metadata: Metadata = {
  title: 'Contact XDrive Logistics',
  description: 'Contact XDrive Logistics for courier and freight exchange platform access, rollout questions, and operational enquiries.',
  alternates: { canonical: '/contact' },
};

const contactCards = [
  {
    label: 'General enquiries',
    value: COMPANY_CONFIG.emails.general,
    href: `mailto:${COMPANY_CONFIG.emails.general}`,
    icon: Mail,
  },
  {
    label: 'Operations',
    value: COMPANY_CONFIG.emails.operations,
    href: `mailto:${COMPANY_CONFIG.emails.operations}`,
    icon: Truck,
  },
  {
    label: 'Platform support',
    value: COMPANY_CONFIG.emails.support,
    href: `mailto:${COMPANY_CONFIG.emails.support}`,
    icon: Headphones,
  },
  {
    label: 'Finance',
    value: COMPANY_CONFIG.emails.invoices,
    secondaryValue: COMPANY_CONFIG.emails.payments,
    icon: ReceiptText,
  },
  {
    label: 'Phone',
    value: COMPANY_CONFIG.phoneDisplay,
    href: `tel:${COMPANY_CONFIG.phone}`,
    icon: Phone,
  },
  {
    label: 'Registered office',
    value: COMPANY_CONFIG.address.full,
    icon: MapPin,
  },
] as const;

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#F7FAFF] text-[#002B6C]">
      <section className="border-b border-[#D7E6FA] bg-white px-5 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-[1120px]">
          <Link href="/" className="text-sm font-black text-[#003B8F] transition hover:text-[#FDB913]">
            Back to Home
          </Link>
          <div className="mt-10 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[#FDB913]">Contact</p>
              <h1 className="mt-4 max-w-[620px] text-4xl font-black leading-[1.02] text-[#002B6C] sm:text-5xl lg:text-[3.5rem]">Talk to XDrive Logistics.</h1>
            </div>
            <p className="max-w-2xl text-lg font-semibold leading-8 text-[#49607F]">
              For platform access, rollout questions, courier and freight exchange enquiries, or account support, contact the XDrive Logistics team directly.
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-[1120px]">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {contactCards.map((card) => {
              const Icon = card.icon;
              const content = (
                <div className="flex h-full min-h-[190px] min-w-0 flex-col border border-[#D7E6FA] bg-white p-7 shadow-[0_18px_50px_rgba(0,43,108,0.06)] transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(0,43,108,0.1)]">
                  <Icon className="h-8 w-8 shrink-0 text-[#FDB913]" />
                  <div className="mt-auto pt-8">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#003B8F]/70">{card.label}</p>
                    {'secondaryValue' in card ? (
                      <div className="mt-3 grid gap-2">
                        <a href={`mailto:${card.value}`} className="min-w-0 break-all text-[0.98rem] font-black leading-6 text-[#002B6C] hover:text-[#003B8F]">
                          {card.value}
                        </a>
                        <a href={`mailto:${card.secondaryValue}`} className="min-w-0 break-all text-[0.98rem] font-black leading-6 text-[#002B6C] hover:text-[#003B8F]">
                          {card.secondaryValue}
                        </a>
                      </div>
                    ) : (
                      <p className="mt-3 break-words text-base font-black leading-6 text-[#002B6C] sm:text-[1.05rem]">{card.value}</p>
                    )}
                  </div>
                </div>
              );

              return 'href' in card ? (
                <a key={card.label} href={card.href} className="block min-w-0">
                  {content}
                </a>
              ) : (
                <div key={card.label} className="min-w-0">
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#002B6C] px-5 py-14 text-white sm:px-8 lg:py-16">
        <div className="mx-auto grid max-w-[1120px] gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#FDB913]">Controlled Early Access</p>
            <h2 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">Apply for access to the platform.</h2>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-white/70">
              Access is reviewed for courier and freight operations that fit the current UK rollout.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className="inline-flex items-center gap-2 bg-[#FDB913] px-6 py-3 text-sm font-black text-[#002B6C] transition hover:bg-[#FFD24A]">
              Request Access <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 border border-white/20 px-6 py-3 text-sm font-black text-white transition hover:bg-white/10">
              Sign In
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
