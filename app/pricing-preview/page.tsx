import Link from 'next/link';
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

const plans = [
  {
    name: 'Owner Driver',
    price: '£29.99',
    description: 'For self-employed couriers who want direct access to available work and one clean operational workspace.',
    features: ['3 months free', 'Available exchange work', 'Quote and award workflow', 'Job status and POD records'],
  },
  {
    name: 'Small Carrier',
    price: '£59.99',
    description: 'For growing courier businesses running 2–5 vehicles and coordinating work across a small fleet.',
    features: ['3 months free', '2–5 vehicle operations', 'Driver allocation', 'Operational job records'],
  },
  {
    name: 'Broker',
    price: '£79.99',
    description: 'For brokers who need to post work, find capacity and manage transport through one predictable membership.',
    features: ['3 months free', 'Post courier & freight work', 'Compare quotes', 'Award and manage jobs'],
    featured: true,
  },
  {
    name: 'Growing Carrier',
    price: '£89.99',
    description: 'For established operators running 6–15 vehicles who need stronger dispatch and network visibility.',
    features: ['3 months free', '6–15 vehicle operations', 'Dispatch workflow', 'POD and invoice readiness'],
  },
] as const;

export default function PricingPreviewPage() {
  return (
    <main className="min-h-screen bg-[#F7FAFF] text-[#002B6C]">
      <section className="relative overflow-hidden bg-white px-5 pb-20 pt-16 sm:px-8 lg:pb-28 lg:pt-24">
        <div className="absolute right-[-10rem] top-[-12rem] h-[32rem] w-[32rem] rounded-full border-[28px] border-[#003B8F] opacity-[0.06]" aria-hidden="true" />
        <div className="absolute right-[-4rem] top-[-5rem] h-[20rem] w-[20rem] rounded-full border-[10px] border-[#FDB913] opacity-20" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1240px]">
          <div className="inline-flex items-center gap-2 border border-[#FDB913]/35 bg-[#FFF8E6] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#8A5B00]">
            <Sparkles className="h-4 w-4" /> Early Access
          </div>
          <div className="mt-7 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#FDB913]">Simple XDrive Membership</p>
              <h1 className="mt-4 max-w-4xl text-[3.2rem] font-black leading-[0.96] tracking-tight sm:text-[4.6rem] lg:text-[5.3rem]">
                Join XDrive. Work for 3 months free.
              </h1>
              <p className="mt-6 max-w-3xl text-xl font-semibold leading-8 text-[#24416F]">
                One predictable monthly membership after your free period. No XDrive commission on job value and no XDrive booking fee.
              </p>
            </div>
            <div className="border-l-4 border-[#FDB913] bg-[#003B8F] p-7 text-white shadow-[0_24px_60px_rgba(0,59,143,0.18)]">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FDB913]">Launch offer</p>
              <p className="mt-2 text-5xl font-black">£0</p>
              <p className="mt-1 text-lg font-black">for your first 3 months</p>
              <p className="mt-4 text-sm font-semibold leading-6 text-white/75">Then continue on your chosen monthly rolling membership.</p>
            </div>
          </div>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/register" className="inline-flex items-center gap-2 bg-[#003B8F] px-6 py-3.5 text-sm font-black text-white shadow-[0_16px_34px_rgba(0,59,143,0.2)] transition hover:bg-[#002D73]">
              Join XDrive <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/" className="inline-flex items-center gap-2 border border-[#003B8F]/20 bg-white px-6 py-3.5 text-sm font-black text-[#003B8F] transition hover:bg-[#F0F6FF]">
              Back to homepage
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[#003B8F] px-5 py-6 text-white sm:px-8">
        <div className="mx-auto grid max-w-[1240px] gap-4 sm:grid-cols-3">
          {[
            'No XDrive commission on job value',
            'No XDrive booking fee',
            'Monthly rolling membership',
          ].map((item) => (
            <div key={item} className="flex items-center gap-3 border-l border-white/20 px-4 py-3">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-[#FDB913]" />
              <span className="font-black">{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-[1240px]">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FDB913]">Choose your role</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Simple pricing. Keep the value of your work.</h2>
            <p className="mt-5 text-lg font-semibold leading-8 text-[#405A82]">The homepage version would show the four clearest launch plans. Full fleet and enterprise options can live on the dedicated pricing page.</p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <article key={plan.name} className={`relative flex min-h-[490px] flex-col border bg-white p-6 shadow-[0_18px_50px_rgba(0,43,108,0.08)] ${plan.featured ? 'border-[#003B8F] ring-2 ring-[#003B8F]/10' : 'border-[#D7E6FA]'}`}>
                {plan.featured ? <div className="absolute right-0 top-0 bg-[#FDB913] px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.13em] text-[#002B6C]">Broker</div> : null}
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#003B8F]/60">{plan.name}</p>
                <div className="mt-5 flex items-end gap-1">
                  <span className="text-4xl font-black text-[#002B6C]">{plan.price}</span>
                  <span className="pb-1 text-sm font-bold text-[#587094]">/month</span>
                </div>
                <div className="mt-3 inline-flex w-fit bg-[#EAF7EE] px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] text-[#1F7A3D]">First 3 months free</div>
                <p className="mt-5 text-sm font-semibold leading-6 text-[#506889]">{plan.description}</p>
                <div className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex gap-3 text-sm font-bold text-[#24416F]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1F7A3D]" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <Link href="/register" className={`mt-auto flex items-center justify-between px-4 py-3 text-sm font-black transition ${plan.featured ? 'bg-[#003B8F] text-white hover:bg-[#002D73]' : 'border border-[#003B8F]/20 text-[#003B8F] hover:bg-[#F0F6FF]'}`}>
                  Start free <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#D7E6FA] bg-white px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div className="flex h-16 w-16 items-center justify-center bg-[#EEF6FF] text-[#003B8F]">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FDB913]">Clear from day one</p>
            <h3 className="mt-2 text-3xl font-black">See your free-period end date before paid membership begins.</h3>
            <p className="mt-4 max-w-3xl font-semibold leading-7 text-[#506889]">The production subscription flow should show the selected plan, free-access expiry date and the price that applies afterwards before the member confirms anything.</p>
          </div>
        </div>
      </section>

      <section className="bg-[#002B6C] px-5 py-16 text-white sm:px-8">
        <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-8 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FDB913]">Early access</p>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">Three months to use XDrive before your membership starts.</h2>
            <p className="mt-3 max-w-3xl font-semibold text-white/70">Join the network, test the workflow and decide whether XDrive earns its place in your operation.</p>
          </div>
          <Link href="/register" className="inline-flex shrink-0 items-center gap-2 bg-[#FDB913] px-6 py-3.5 text-sm font-black text-[#002B6C] transition hover:bg-[#F6AA00]">
            Request Early Access <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
