import { trustCards } from '../content';

export function TrustBarSection() {
  return (
    <section className="border-b border-slate-200 bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-3 md:grid-cols-3 xl:grid-cols-6">
        {trustCards.map((card) => (
          <article key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{card.label}</p>
            <p className="mt-2 text-sm font-semibold text-[#0f172a]">{card.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
