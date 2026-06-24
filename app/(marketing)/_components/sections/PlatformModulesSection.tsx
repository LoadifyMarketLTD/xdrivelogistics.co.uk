import { HomepageVisualCard } from '../HomepageVisualCard';
import { platformModules } from '../content';

export function PlatformModulesSection() {
  return (
    <section id="platform" className="border-b border-[#e5e7eb] bg-white px-4 py-8 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center">
          <span className="inline-flex rounded-lg border border-[#1d4ed8]/20 bg-[#eff6ff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1d4ed8]">
            Functional Product Areas
          </span>
          <h2 className="mt-4 text-2xl font-bold text-[#0f172a] sm:text-4xl">Marketplace, operations, PODs and finance in one roadmap</h2>
          <p className="mx-auto mt-3 hidden max-w-3xl text-slate-500 sm:block">
            XDrive already has focused product areas for the job lifecycle, with marketplace and network activity being expanded carefully
            during Early Access rather than advertised as a fully public exchange before volume is ready.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {platformModules.map((module, index) => (
            <article key={module.key} className={`overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)] ${index > 1 ? 'hidden sm:block' : ''}`}>
              <div className="border-b border-[#e5e7eb] bg-slate-100 p-3">
                <HomepageVisualCard
                  imageSrc={module.image}
                  imageAlt={module.imageAlt}
                  label={`${module.title} module`}
                  title={module.title}
                  icon={module.icon}
                  tone="slate"
                  className="h-[120px] w-full rounded-xl sm:h-[180px]"
                />
              </div>
              <div className="p-5">
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {module.status}
                </div>
                <h3 className="mt-3 text-base font-semibold text-[#0f172a]">{module.title}</h3>
                <p className="mt-2 hidden text-sm leading-6 text-slate-500 sm:block">{module.summary}</p>
                <div className="mt-4 hidden flex-wrap gap-2 sm:flex">
                  {module.bullets.map((bullet) => (
                    <span key={bullet} className="rounded-full bg-[#eff6ff] px-2.5 py-1 text-[11px] font-medium text-[#1d4ed8]">
                      {bullet}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
