import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Mail, MapPin, Phone } from 'lucide-react';
import { COMPANY_CONFIG } from '../config/company';

export const metadata: Metadata = {
  title: 'Contact XDrive Logistics',
  description: 'Contact XDrive Logistics for courier and freight exchange platform access, rollout questions, and operational enquiries.',
};

const contactCards = [
  {
    label: 'Email',
    value: COMPANY_CONFIG.email,
    href: `mailto:${COMPANY_CONFIG.email}`,
    icon: Mail,
  },
  {
    label: 'Phone',
    value: COMPANY_CONFIG.phoneDisplay,
    href: `tel:${COMPANY_CONFIG.phone}`,
    icon: Phone,
  },
  {
    label: 'Registered Office',
    value: COMPANY_CONFIG.address.full,
    href: null,
    icon: MapPin,
  },
] as const;

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#F4F6F8] text-[#1D57D8]">
      <section className="border-b border-[#F4F6F8] bg-white px-5 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-[1120px]">
          <Link href="/" className="text-sm font-black text-[#1D57D8] transition hover:text-[#F5A300]">
            Back to Home
          </Link>
          <div className="mt-10 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[#F5A300]">Contact</p>
              <h1 className="mt-4 text-5xl font-black leading-[0.98] text-[#1D57D8] sm:text-7xl">Talk to XDrive Logistics.</h1>
            </div>
            <p className="max-w-2xl text-lg font-semibold leading-8 text-[#1D57D8]">
              For platform access, rollout questions, courier and freight exchange enquiries, or account support, contact the XDrive Logistics team directly.
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8 lg:py-20">
        <div className="mx-auto grid max-w-[1120px] gap-5 lg:grid-cols-3">
          {contactCards.map((card) => {
            const Icon = card.icon;
            const body = (
              <div className="min-h-[210px] border border-[#F4F6F8] bg-white p-7 shadow-[0_18px_50px_rgba(29, 87, 216, 0.06)] transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(29, 87, 216, 0.1)]">
                <Icon className="h-8 w-8 text-[#F5A300]" />
                <p className="mt-8 text-xs font-black uppercase tracking-[0.16em] text-[#1D57D8]/70">{card.label}</p>
                <p className="mt-3 text-xl font-black leading-7 text-[#1D57D8]">{card.value}</p>
              </div>
            );

            return card.href ? (
              <a key={card.label} href={card.href} className="block">
                {body}
              </a>
            ) : (
              <div key={card.label}>{body}</div>
            );
          })}
        </div>
      </section>

      <section className="bg-[#1D57D8] px-5 py-14 text-white sm:px-8 lg:py-16">
        <div className="mx-auto grid max-w-[1120px] gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#F5A300]">Controlled Early Access</p>
            <h2 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">Apply for access to the platform.</h2>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-white/70">
              Access is reviewed for courier and freight operations that fit the current UK rollout.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className="inline-flex items-center gap-2 bg-[#F5A300] px-6 py-3 text-sm font-black text-[#1A1F2B] transition hover:bg-[#F5A300]">
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
