import { statusHighlights } from '../content';

export function CurrentPlatformStatusSection() {
  return (
    <section className="border-b border-[#e5e7eb] bg-slate-50 px-4 py-12 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-[1200px]">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-[#1d4ed8]/20 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1d4ed8]">
            Current Platform Status
          </span>
          <h2 className="mt-4 text-3xl font-bold text-[#0f172a] sm:text-4xl">Transparent about what is live versus what is still growing</h2>
          <p className="mt-4 text-slate-600">
            This Phase 2 homepage is meant to make the current product state obvious: real workflows exist today, but rollout and network growth are still controlled.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statusHighlights.map((item) => (
            <article key={item.title} className="rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#1d4ed8]">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
