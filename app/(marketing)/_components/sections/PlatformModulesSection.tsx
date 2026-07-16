import Image from 'next/image';
import { platformModules } from '../content';

export function PlatformModulesSection() {
  return (
    <section className="border-b border-[#0B2F6B]/15 bg-white px-4 py-14 sm:px-6" id="modules">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1D57D8]">Operational modules</span>
          <h2 className="mt-2 text-3xl font-black text-[#1A1F2B] sm:text-4xl">Built around execution, not decoration.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#0B2F6B]">
            Five operational areas covering marketplace quoting, dispatch, driver workflows, fleet coordination and finance records.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-5">
          {platformModules.map((module) => (
            <article key={module.key} className="rounded-xl border border-[#0B2F6B]/15 bg-white p-5 shadow-[0_16px_40px_-34px_rgba(26, 31, 43, 0.6)]">
              <div className="mb-5 h-28 overflow-hidden rounded-lg bg-[#F4F6F8]">
                <Image src={module.image} alt={module.imageAlt} width={700} height={420} className="h-full w-full object-cover" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0B2F6B]">{module.status}</p>
              <h3 className="mt-2 text-lg font-semibold text-[#1A1F2B]">{module.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#0B2F6B]">{module.summary}</p>
              <div className="mt-4 space-y-2">
                {module.bullets.slice(0, 3).map((bullet) => (
                  <p key={bullet} className="text-xs font-semibold text-[#1D57D8]">+ {bullet}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
