import type { Metadata } from 'next';
import Link from 'next/link';
import { COMPANY_CONFIG } from '../config/company';

export const metadata: Metadata = {
  title: 'Cookie & Storage Policy | XDrive Logistics',
  description: 'How XDrive Logistics uses cookies and similar storage and access technologies.',
};

const LAST_UPDATED='1 September 2026';

export default function CookiesPage(){return <main className="min-h-screen bg-[#071B3C] px-6 py-20 text-white"><div className="mx-auto max-w-[900px]">
<Link href="/" className="text-sm font-black text-[#F5A300]">← Back to XDrive</Link><p className="mt-10 text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">Privacy</p><h1 className="mt-3 text-4xl font-black sm:text-5xl">Cookie & Storage Policy</h1><p className="mt-3 text-sm font-semibold text-white/55">Last updated: {LAST_UPDATED}</p>
<div className="mt-10 grid gap-8 leading-7 text-white/78">
<S t="1. What this policy covers">This policy covers cookies and similar technologies that store information on, or access information from, a user's device, including browser storage used for authentication, security or preferences.</S>
<S t="2. Strictly necessary technologies">XDrive may use technologies that are strictly necessary to provide a service requested by the user, including authentication/session handling, security, fraud prevention, load balancing and essential account state. These should be limited to what is necessary for the requested service.</S>
<S t="3. Optional technologies">Analytics, advertising, behavioural tracking or optional preference technologies must not be activated unless XDrive has the consent or other lawful permission required by applicable UK rules. Where consent is required, users must be able to make a real choice and change that choice later.</S>
<S t="4. Current public-site position">The public XDrive site is intended to operate without advertising trackers or non-essential behavioural tracking. Authentication and core platform services may use necessary storage/access technologies. If optional analytics or marketing technologies are introduced, the consent mechanism and this policy must be updated before activation.</S>
<S t="5. Third-party services">Platform functionality may involve service providers for hosting, authentication, security, communications or payments. A third party may process device or technical information when its service is actually used. XDrive reviews these integrations and should not permit non-essential third-party tracking to run without the required consent.</S>
<S t="6. Managing choices">Where optional technologies are available, XDrive will provide an appropriate preference mechanism. Browser controls can also delete or block stored information, but blocking technologies that are strictly necessary may prevent login or other requested platform functionality.</S>
<S t="7. Retention">Session technologies normally expire when the session ends. Persistent technologies should have a defined and proportionate duration. XDrive reviews whether each technology remains necessary and whether its retention period remains appropriate.</S>
<S t="8. Relationship with the Privacy Policy">Where cookie or storage data identifies or relates to an individual, the Privacy Policy explains the purposes, lawful bases, recipients, retention and data-protection rights that apply.</S>
<S t="9. Changes">We will update this policy when technologies or legal requirements change. Material introduction of optional tracking will be accompanied by the required consent or preference controls before that tracking is enabled.</S>
<S t="10. Contact">Questions about cookies or storage/access technologies can be sent to {COMPANY_CONFIG.email}. {COMPANY_CONFIG.legalName}, Company No. {COMPANY_CONFIG.companyNumber}, registered office {COMPANY_CONFIG.address.full}, registered in England and Wales.</S>
</div><div className="mt-12 flex flex-wrap gap-4 border-t border-white/10 pt-7 text-sm font-black text-[#F5A300]"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/complaints">Complaints</Link></div>
</div></main>}
function S({t,children}:{t:string;children:React.ReactNode}){return <section><h2 className="text-xl font-black text-[#F5A300]">{t}</h2><div className="mt-3">{children}</div></section>}
