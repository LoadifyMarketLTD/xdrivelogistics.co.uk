import { ArrowRight } from 'lucide-react';

import { workflow } from '../content';

export function WorkflowSection() {
  return (
    <section id="how-it-works" className="border-b border-[#e5e7eb] px-4 py-12 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="text-center text-3xl font-bold text-[#0f172a] sm:text-4xl">How XDrive Works</h2>
        <p className="mx-auto mt-3 max-w-3xl text-center text-slate-500">
          A simple operating flow for transport jobs, from first request to final delivery record.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          {workflow.map(({ title, detail, icon: Icon }, index) => (
            <article key={title} className="relative rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)]">
              <div className="mb-3 inline-flex rounded-lg border border-[#e5e7eb] bg-slate-50 p-2 text-[#1d4ed8]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-[#0f172a]">{title}</h3>
              <p className="mt-2 text-xs text-slate-500">{detail}</p>
              {index < workflow.length - 1 ? <ArrowRight className="mt-3 h-4 w-4 text-slate-300" /> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
