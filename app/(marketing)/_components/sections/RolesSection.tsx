import Image from 'next/image';

import { roleCards } from '../content';

export function RolesSection() {
  return (
    <section id="solutions" className="border-b border-[#e5e7eb] px-4 py-12 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[#0f172a] sm:text-4xl">Built for Real UK Logistics Workflows</h2>
          <p className="mt-3 text-slate-500">
            From job requests to POD and invoice closure, XDrive is being built around the practical steps transport teams handle every day.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {roleCards.map((role) => (
            <article key={role.title} className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)]">
              <Image src={role.image} alt={`${role.title} logistics workflow context`} width={1600} height={900} className="h-[150px] w-full object-cover sm:h-[180px]" />
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
