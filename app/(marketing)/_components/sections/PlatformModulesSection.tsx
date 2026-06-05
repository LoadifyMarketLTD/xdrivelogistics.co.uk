import Image from 'next/image';

import { platformModules } from '../content';

export function PlatformModulesSection() {
  return (
    <section id="platform" className="border-b border-slate-200 bg-slate-50 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[#0f172a] sm:text-4xl">One Platform. Multiple Workspaces.</h2>
          <p className="mt-3 text-slate-500">Five integrated modules built for real logistics execution.</p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2 xl:grid-cols-5">
          {platformModules.map((module) => (
            <article key={module.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <Image src={module.image} alt={`${module.title} workspace`} width={1600} height={900} className="h-40 w-full object-cover" />
              <div className="p-4">
                <h3 className="text-base font-semibold text-[#0f172a]">{module.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{module.summary}</p>
                <ul className="mt-3 space-y-1 text-xs text-slate-400">
                  {module.bullets.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
