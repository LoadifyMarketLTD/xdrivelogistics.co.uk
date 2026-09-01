import type { Metadata } from 'next';
import Link from 'next/link';
import { COMPANY_CONFIG } from '../config/company';

export const metadata: Metadata = { title: 'Complaints | XDrive Logistics', description: 'How to raise platform, membership and conduct complaints with XDrive Logistics.' };
const LAST_UPDATED='1 September 2026';

export default function ComplaintsPage(){return <main className="min-h-screen bg-[#F7F9FC] px-6 py-20 text-[#102447]"><div className="mx-auto max-w-[900px]">
<Link href="/" className="text-sm font-black text-[#0E3FA9]">← Back to XDrive</Link><p className="mt-10 text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">Support & Resolution</p><h1 className="mt-3 text-4xl font-black text-[#071B3C] sm:text-5xl">Complaints & Disputes</h1><p className="mt-3 text-sm font-semibold text-[#6A7C95]">Last updated: {LAST_UPDATED}</p>
<div className="mt-10 grid gap-8 leading-7 text-[#405B78]">
<S t="1. What this process covers">Use this process for complaints about XDrive platform access, membership billing, account administration, platform conduct, data handling or the operation of XDrive features. A dispute about the underlying transport service remains primarily between the customer/broker and carrier/driver unless XDrive is itself a contracting party.</S>
<S t="2. How to complain">Email {COMPANY_CONFIG.email} with your name, business, account email, relevant job/invoice reference, a clear description of the issue, key dates and the outcome you are seeking. Do not send passwords or unnecessary sensitive documents.</S>
<S t="3. Acknowledgement and investigation">We aim to acknowledge a complaint promptly and assign it for review. Complex matters involving multiple users, security, fraud, data protection or third-party evidence may take longer. We may ask for additional information before reaching an outcome.</S>
<S t="4. Urgent safety, fraud or security issues">Mark urgent reports clearly. XDrive may preserve records, restrict access or take other proportionate protective action while an issue is investigated.</S>
<S t="5. Membership billing complaints">Billing complaints should identify the plan, billing date and charge. Where a duplicate, incorrect or unauthorised XDrive charge is confirmed, we will correct it and provide any refund legally or contractually due.</S>
<S t="6. Conduct and marketplace disputes">Where appropriate we may review platform records such as postings, quotes, award records, timestamps, messages, POD or account activity. XDrive does not automatically decide liability under a third-party transport contract merely because records are stored on the platform.</S>
<S t="7. Privacy complaints">Privacy complaints can be raised with XDrive first. You also retain the right to complain to the UK Information Commissioner's Office where applicable; see our Privacy Policy for details.</S>
<S t="8. Legal rights">Nothing in this complaints process removes any legal remedy or mandatory right available to you. If a dispute cannot be resolved informally, the governing-law and jurisdiction provisions in the applicable contract continue to apply.</S>
<S t="9. Contact">{COMPANY_CONFIG.legalName}, Company No. {COMPANY_CONFIG.companyNumber}, registered office {COMPANY_CONFIG.address.full}, registered in England and Wales. Email: {COMPANY_CONFIG.email}. Phone: {COMPANY_CONFIG.phoneDisplay}.</S>
</div><div className="mt-12 flex flex-wrap gap-4 border-t border-[#E2E8F1] pt-7 text-sm font-black text-[#0E3FA9]"><Link href="/terms">Terms</Link><Link href="/subscription-terms">Subscription Terms</Link><Link href="/privacy">Privacy</Link><Link href="/contact">Contact</Link></div>
</div></main>}
function S({t,children}:{t:string;children:React.ReactNode}){return <section><h2 className="text-xl font-black text-[#071B3C]">{t}</h2><div className="mt-3">{children}</div></section>}
