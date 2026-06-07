import { HomepageVisualCard } from '../HomepageVisualCard';
import { platformModules } from '../content';

export function PlatformModulesSection() {
  return (
    <section id="platform" className="border-b border-[#e5e7eb] bg-white px-4 py-12 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[#0f172a] sm:text-4xl">Operational Modules</h2>
          <p className="mt-3 text-slate-500">Five compact modules designed for practical logistics execution.</p>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {platformModules.map((module) => (
            <article key={module.key} className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)]">
              <div className="border-b border-[#e5e7eb] bg-slate-100 p-3">
                <HomepageVisualCard
                  imageSrc={module.image}
                  imageAlt={module.imageAlt}
                  label={`${module.title} module`}
                  title={module.title}
                  icon={module.icon}
                  tone="slate"
                  className="h-[180px] w-full rounded-xl"
                />
              </div>
              <div className="p-5">
                <h3 className="text-base font-semibold text-[#0f172a]">{module.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{module.summary}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
