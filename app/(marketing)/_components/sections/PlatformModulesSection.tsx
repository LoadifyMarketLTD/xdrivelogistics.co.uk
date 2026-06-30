import Image from 'next/image';
import { platformModules } from '../content';

export function PlatformModulesSection() {
  return (
    <section className="border-b border-slate-200 bg-white px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1d4ed8]">Operational modules</span>
          <h2 className="mt-2 text-3xl font-black text-[#0f172a] sm:text-4xl">Built around execution, not decoration.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            The public site should preview the platform shape without pretending that every module is already a public exchange.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-5">
          {platformModules.map((module) => (
            <article key={module.key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.6)]">
              <div className="mb-5 h-28 overflow-hidden rounded-lg bg-slate-100">
                <Image src={module.image} alt={module.imageAlt} width={700} height={420} className="h-full w-full object-cover" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{module.status}</p>
              <h3 className="mt-2 text-lg font-semibold text-[#0f172a]">{module.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{module.summary}</p>
              <div className="mt-4 space-y-2">
                {module.bullets.slice(0, 3).map((bullet) => (
                  <p key={bullet} className="text-xs font-semibold text-[#1d4ed8]">+ {bullet}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
