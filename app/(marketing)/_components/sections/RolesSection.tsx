import { HomepageVisualCard } from '../HomepageVisualCard';
import { roleCards } from '../content';

export function RolesSection() {
  return (
    <section id="solutions" className="border-b border-[#e5e7eb] px-4 py-12 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[#0f172a] sm:text-4xl">Built for Real UK Logistics Workflows</h2>
          <p className="mt-3 text-slate-500">
            From job requests to POD and invoice closure, XDrive is being built around the practical steps transport teams handle every day.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {roleCards.map((role) => (
            <article key={role.title} className="group overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)]">
              <HomepageVisualCard
                imageSrc={role.image}
                imageAlt={role.imageAlt}
                label={role.visualLabel}
                title={role.title}
                icon={role.icon}
                tone={role.tone}
                className="h-[220px] w-full md:h-[260px] lg:h-[260px]"
              />
              <div className="p-4">
                <h3 className="text-base font-semibold text-[#0f172a]">{role.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{role.subtitle}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
