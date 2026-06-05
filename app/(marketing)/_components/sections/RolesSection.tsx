import Image from 'next/image';

import { roleCards } from '../content';

export function RolesSection() {
  return (
    <section id="solutions" className="border-b border-slate-200 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[#0f172a] sm:text-4xl">Built Around Every Logistics Role</h2>
          <p className="mt-3 text-slate-500">One ecosystem supporting every participant in the logistics chain.</p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {roleCards.map((role) => (
            <article key={role.title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <Image src={role.image} alt={role.title} width={1600} height={900} className="h-48 w-full object-cover" />
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
