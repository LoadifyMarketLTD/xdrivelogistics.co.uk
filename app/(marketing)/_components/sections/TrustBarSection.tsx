import { trustCards } from '../content';

export function TrustBarSection() {
  return (
    <section className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto grid max-w-7xl gap-3 md:grid-cols-3 xl:grid-cols-6">
        {trustCards.map((card, index) => (
          <article key={card.label} className={`rounded-lg border border-slate-200 bg-slate-50 p-4 text-center ${index > 2 ? 'hidden md:block' : ''}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{card.label}</p>
            <p className="mt-2 text-sm font-bold text-[#0f172a]">{card.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
