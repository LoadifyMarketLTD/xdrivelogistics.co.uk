import Image from 'next/image';
import { roleCards } from '../content';

export function RolesSection() {
  return (
    <section id="solutions" className="border-b border-[#0B2F6B]/15 bg-white px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1D57D8]">Role workspaces</span>
            <h2 className="mt-2 max-w-3xl text-3xl font-black leading-tight text-[#1A1F2B] sm:text-4xl">
              One platform, different operational views.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[#0B2F6B]">
            Customers post transport needs, brokers manage freight, fleet teams run operations, owner operators quote and execute, and drivers update work from the road.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {roleCards.map((role) => (
            <article key={role.title} className="overflow-hidden rounded-xl border border-[#0B2F6B]/15 bg-white shadow-[0_16px_40px_-34px_rgba(26, 31, 43, 0.6)]">
              <div className="h-36 bg-[#F4F6F8]">
                <Image src={role.image} alt={role.imageAlt} width={700} height={420} className="h-full w-full object-cover" />
              </div>
              <div className="p-4">
                <h3 className="text-base font-semibold text-[#1A1F2B]">{role.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#0B2F6B]">{role.subtitle}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
