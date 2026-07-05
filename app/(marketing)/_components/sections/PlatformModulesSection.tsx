import Image from 'next/image';
import { platformModules } from '../content';

export function PlatformModulesSection() {
  return (
    <section className="border-b border-slate-200 bg-white px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1d4ed8]">Product narrative</span>
          <h2 className="mt-2 text-3xl font-black text-[#0f172a] sm:text-4xl">Five product stories taken from the live platform.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            The new homepage explains the product in the same order the real work moves across XDrive.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {platformModules.map((module) => (
            <article key={module.key} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_70px_-48px_rgba(15,23,42,0.55)]">
              <div className="grid gap-0 md:grid-cols-[240px_1fr]">
                <div className="h-full min-h-56 bg-slate-100">
                  <Image src={module.image} alt={module.imageAlt} width={700} height={420} className="h-full w-full object-cover" />
                </div>
                <div className="p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1d4ed8]">{module.status}</p>
                  <h3 className="mt-2 text-2xl font-black text-[#0f172a]">{module.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{module.summary}</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {module.bullets.map((bullet) => (
                      <p key={bullet} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                        {bullet}
                      </p>
                    ))}
                  </div>
                  <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    {module.previewItems.map((item) => (
                      <div key={item.label}>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
