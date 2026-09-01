import type { Metadata } from 'next';
import Link from 'next/link';
import { COMPANY_CONFIG } from '../config/company';

export const metadata: Metadata = { title: 'Acceptable Use Policy | XDrive Logistics', description: 'Rules for lawful and responsible use of the XDrive platform.' };
const LAST_UPDATED='1 September 2026';

export default function AcceptableUsePage(){return <main className="min-h-screen bg-[#071B3C] px-6 py-20 text-white"><div className="mx-auto max-w-[900px]">
<Link href="/" className="text-sm font-black text-[#F5A300]">← Back to XDrive</Link><p className="mt-10 text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">Legal</p><h1 className="mt-3 text-4xl font-black sm:text-5xl">Acceptable Use Policy</h1><p className="mt-3 text-sm font-semibold text-white/55">Last updated: {LAST_UPDATED}</p>
<div className="mt-10 grid gap-8 leading-7 text-white/78">
<S t="1. Purpose">This policy protects the XDrive network, its users and transport records. It applies to all public and authenticated use of the platform.</S>
<S t="2. Accurate commercial activity">Do not post fake jobs, fabricated availability, misleading route or load information, deceptive prices or quotes, sham accounts, manipulated POD, falsified compliance documents or reviews intended to distort trust or competition.</S>
<S t="3. Lawful transport only">Do not use XDrive to arrange or facilitate unlawful transport. Restricted, hazardous, controlled, high-risk or regulated goods may only be handled where every required licence, declaration, vehicle standard, insurance condition and legal control is satisfied by the responsible parties.</S>
<S t="4. Platform security">Do not probe, attack, overload, scrape, crawl, reverse engineer, bypass authentication or access controls, introduce malware, automate account creation, harvest data or attempt to obtain another user's credentials or confidential information.</S>
<S t="5. Accounts and access">Do not sell, rent or improperly share accounts. Users must operate through authorised identities and roles. Companies are responsible for removing access when staff, contractors or drivers no longer require it.</S>
<S t="6. Personal data and communications">Use contact, location, identity and job information only for legitimate platform and transport purposes. Do not spam, harass, threaten, discriminate, publish another user's personal data or reuse platform data for unrelated marketing without a lawful basis.</S>
<S t="7. Fair marketplace conduct">Do not collude to manipulate prices, impersonate another business, interfere with awarded work, intentionally evade agreed payment responsibilities or use XDrive to circumvent sanctions, court orders or legal restrictions.</S>
<S t="8. Enforcement">XDrive may investigate, preserve evidence, restrict functionality, suspend or terminate access, remove unlawful content and make reports to competent authorities where reasonably necessary. Serious security, fraud or safety issues may be acted on immediately.</S>
<S t="9. Reporting abuse">Report suspected fraud, unsafe activity, data misuse or prohibited content to {COMPANY_CONFIG.email}. Include the relevant job or account reference where possible.</S>
</div><div className="mt-12 flex flex-wrap gap-4 border-t border-white/10 pt-7 text-sm font-black text-[#F5A300]"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/complaints">Complaints</Link></div>
</div></main>}
function S({t,children}:{t:string;children:React.ReactNode}){return <section><h2 className="text-xl font-black text-[#F5A300]">{t}</h2><div className="mt-3">{children}</div></section>}
