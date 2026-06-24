import { HomepageVisualCard } from '../HomepageVisualCard';
import { roleCards } from '../content';

export function RolesSection() {
  return (
    <section id="solutions" className="border-b border-[#e5e7eb] px-4 py-8 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center">
          <span className="inline-flex rounded-lg border border-[#1d4ed8]/20 bg-[#eff6ff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1d4ed8]">
            Platform Roles
          </span>
          <h2 className="mt-4 text-2xl font-bold text-[#0f172a] sm:text-4xl">Built for the people inside a transport job</h2>
          <p className="mx-auto mt-3 hidden max-w-3xl text-slate-500 sm:block">
            XDrive supports customers, owner operators, courier and fleet companies, fleet drivers and future brokers or forwarders. Each
            workspace is designed around a practical role, not around a generic dashboard.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:mt-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {roleCards.map((role, index) => (
            <article key={role.title} className={`group overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)] ${index > 1 ? 'hidden md:block' : ''}`}>
              <HomepageVisualCard
                imageSrc={role.image}
                imageAlt={role.imageAlt}
                label={role.visualLabel}
                title={role.title}
                icon={role.icon}
                tone={role.tone}
                className="h-[125px] w-full md:h-[260px] lg:h-[260px]"
              />
              <div className="p-4">
                <h3 className="text-base font-semibold text-[#0f172a]">{role.title}</h3>
                <p className="mt-2 hidden text-sm leading-6 text-slate-500 sm:block">{role.subtitle}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
