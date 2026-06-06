import { featureCards } from '../content';

export function FeaturesSection() {
  return (
    <section className="border-b border-slate-200 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-center text-3xl font-bold text-[#0f172a] sm:text-4xl">Core Features</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {featureCards.map(({ title, description, icon: Icon }) => (
            <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#1d4ed8]/40 hover:shadow-md">
              <div className="inline-flex rounded-lg border border-slate-200 bg-[#eff6ff] p-2 text-[#1d4ed8]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[#0f172a]">{title}</h3>
              <p className="mt-2 text-sm text-slate-500">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
