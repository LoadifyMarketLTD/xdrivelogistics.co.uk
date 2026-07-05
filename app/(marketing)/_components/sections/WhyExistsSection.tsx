import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { productChecks, proofPoints } from '../content';

export function WhyExistsSection() {
  return (
    <section className="border-b border-slate-200 bg-[#f8fafc] px-4 py-14 sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <span className="inline-flex rounded-full border border-[#1d4ed8]/20 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1d4ed8]">
            Built from the product itself
          </span>
          <h2 className="mt-4 max-w-2xl text-3xl font-black leading-tight text-[#0f172a] sm:text-4xl">
            This homepage now follows the same chain the product is trying to clean up.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Instead of describing XDrive as a generic transport brand, the page now explains the actual operating surfaces already present in the platform.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {productChecks.map((check) => (
              <span key={check} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-[#0f766e]" />
                {check}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.55)]">
          <div className="grid gap-3">
            {proofPoints.map((point, index) => (
              <article key={point.title} className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-[180px_1fr] sm:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#1d4ed8]">0{index + 1}</p>
                  <h3 className="mt-1 text-base font-semibold text-[#0f172a]">{point.title}</h3>
                </div>
                <p className="text-sm leading-6 text-slate-600">{point.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#0f172a] px-5 py-4 text-sm font-semibold text-white">
            One product story from intake to finance visibility
            <ArrowRight className="h-4 w-4 text-[#f5c542]" />
          </div>
        </div>
      </div>
    </section>
  );
}
