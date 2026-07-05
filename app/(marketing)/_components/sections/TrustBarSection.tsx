import { trustMetrics } from '../content';

export function TrustBarSection() {
  return (
    <section className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {trustMetrics.map((item) => (
          <article key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
            <p className="mt-1 text-base font-semibold text-[#0f172a]">{item.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
