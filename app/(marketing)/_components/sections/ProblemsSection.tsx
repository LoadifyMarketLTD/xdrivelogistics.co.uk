import { problemCards } from '../content';

export function ProblemsSection() {
  return (
    <section className="border-b border-[#e5e7eb] bg-slate-50 px-4 py-12 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[#0f172a] sm:text-4xl">Problems XDrive Is Designed To Solve</h2>
          <p className="mx-auto mt-3 max-w-3xl text-slate-500">
            The platform is being shaped around the operational problems transport teams deal with every day.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {problemCards.map((card) => (
            <article key={card.title} className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-[#1d4ed8]">{card.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{card.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
