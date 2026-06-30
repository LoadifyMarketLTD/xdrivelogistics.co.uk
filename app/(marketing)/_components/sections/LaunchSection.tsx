import Link from 'next/link';

const benefits = [
  'Approved-user early access',
  'GBP 0.00 during MVP',
  'Valid until 31 December 2026',
  'No paywall for approved users',
] as const;

export function LaunchSection() {
  return (
    <section className="border-b border-slate-200 bg-[#0f172a] px-4 py-14 text-white sm:px-6" id="launch">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <div>
          <span className="inline-flex rounded-full border border-[#f5c542]/40 bg-[#f5c542]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f5c542]">
            Early Access
          </span>
          <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-4xl">
            Bring real customers, carriers and drivers into a controlled MVP rollout.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
            XDrive is not presented as a finished public marketplace. It is an approved-access logistics platform being hardened around real workflows.
          </p>
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {benefits.map((benefit) => (
              <div key={benefit} className="rounded-lg border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-slate-100">
                {benefit}
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-lg bg-[#f5c542] px-5 py-3 text-sm font-semibold text-[#0f172a] transition hover:bg-[#ffd45a]">
              Join Early Access
            </Link>
            <Link href="/request-quote" className="rounded-lg border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              Request Demo
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
