import { platformModules } from '../content';

export function PlatformModulesSection() {
  return (
    <section id="platform" className="border-b border-[#e5e7eb] bg-white px-4 py-12 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[#0f172a] sm:text-4xl">Operational Modules</h2>
          <p className="mt-3 text-slate-500">Five compact modules designed for practical logistics execution.</p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2 xl:grid-cols-5">
          {platformModules.map((module) => (
            <article key={module.key} className="rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)]">
              <div className="inline-flex rounded-lg border border-[#e5e7eb] bg-slate-50 p-2 text-[#1d4ed8]">
                <module.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-[#0f172a]">{module.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{module.summary}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
