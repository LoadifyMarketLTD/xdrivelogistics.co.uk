import type { Metadata } from 'next';
import Link from 'next/link';
import { COMPANY_CONFIG } from '../config/company';

export const metadata: Metadata = {
  title: 'Membership & Subscription Terms | XDrive Logistics',
  description: 'Terms for XDrive early access, free periods, paid membership, renewal and cancellation.',
};

const LAST_UPDATED = '1 September 2026';

export default function SubscriptionTermsPage() {
  return <main className="min-h-screen bg-[#F7F9FC] px-6 py-20 text-[#102447]"><div className="mx-auto max-w-[900px]">
    <Link href="/pricing" className="text-sm font-black text-[#0E3FA9]">← Back to Pricing</Link>
    <p className="mt-10 text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">Membership</p>
    <h1 className="mt-3 text-4xl font-black text-[#071B3C] sm:text-5xl">Membership & Subscription Terms</h1>
    <p className="mt-3 text-sm font-semibold text-[#6A7C95]">Last updated: {LAST_UPDATED}</p>
    <div className="mt-10 grid gap-8 leading-7 text-[#405B78]">
      <S t="1. Scope">These terms apply to XDrive platform memberships. They supplement the main Terms & Conditions. If there is a conflict about membership billing, renewal or cancellation, these membership terms take priority for that issue.</S>
      <S t="2. Eligibility and approval">Early access is subject to application review and account approval. XDrive may decline or defer an application where the applicant does not fit the current rollout, verification is incomplete or access would create security, compliance or operational risk.</S>
      <S t="3. Free access period">Eligible approved launch accounts receive the advertised three-month free access period. No membership charge is due for that free period. The free period is promotional, non-transferable and may be limited to one qualifying account or business unless XDrive agrees otherwise.</S>
      <S t="4. Paid membership after the free period">After the free period, membership continues only under the plan and billing arrangement disclosed to the account holder. Current public monthly prices are shown on the Pricing page. Prices are exclusive of VAT unless expressly stated otherwise, and VAT will be added where legally applicable.</S>
      <S t="5. Monthly rolling model">The launch membership model is monthly rolling after the free period, with no minimum paid term unless a different written enterprise agreement is accepted. The applicable billing date and renewal amount must be shown before a paid subscription is activated.</S>
      <S t="6. No XDrive commission or booking fee">Under the launch membership model, XDrive does not take a percentage commission from the transport value of jobs and does not add an XDrive booking fee. This does not prevent third parties from charging their own separately disclosed fees or affect fees agreed directly between transport parties.</S>
      <S t="7. Cancellation">A monthly rolling membership may be cancelled for future renewal through the account process made available by XDrive or by contacting XDrive where self-service cancellation is unavailable. Cancellation stops future renewal; it does not normally reverse a charge for a billing period that has already started unless required by law or XDrive agrees otherwise.</S>
      <S t="8. Renewal and reminders">XDrive will present renewal information clearly and will implement any renewal reminders, cooling-off rights or other subscription notices required by applicable UK law for users who legally qualify for those protections. Business users should not assume that consumer-only statutory rights apply to a subscription entered into wholly for business purposes.</S>
      <S t="9. Plan changes">Upgrades, downgrades, additional users or fleet-size changes may change the applicable plan. Any price change affecting an existing paid membership will be communicated before it takes effect where required by contract or law.</S>
      <S t="10. Failed payment and suspension">If a membership payment fails or remains unpaid, XDrive may retry payment, request another payment method or suspend paid functionality after reasonable notice where appropriate. Suspension does not erase outstanding lawful charges.</S>
      <S t="11. Refunds">Refunds are provided where required by law, where XDrive has incorrectly charged an account, or where XDrive expressly agrees a refund. Promotional free periods have no cash value.</S>
      <S t="12. Contract confirmation">Where a paid membership is entered into online, XDrive will provide or make available the key membership information and will provide a confirmation that can be retained by the customer, such as an email or downloadable record.</S>
      <S t="13. Contact">Questions about membership or cancellation can be sent to {COMPANY_CONFIG.email}. {COMPANY_CONFIG.legalName}, Company No. {COMPANY_CONFIG.companyNumber}, registered office {COMPANY_CONFIG.address.full}, registered in England and Wales.</S>
    </div>
    <div className="mt-12 flex flex-wrap gap-4 border-t border-[#E2E8F1] pt-7 text-sm font-black text-[#0E3FA9]"><Link href="/terms">Terms</Link><Link href="/pricing">Pricing</Link><Link href="/complaints">Complaints</Link><Link href="/privacy">Privacy</Link></div>
  </div></main>;
}

function S({t, children}:{t:string; children:React.ReactNode}){return <section><h2 className="text-xl font-black text-[#071B3C]">{t}</h2><div className="mt-3">{children}</div></section>}
