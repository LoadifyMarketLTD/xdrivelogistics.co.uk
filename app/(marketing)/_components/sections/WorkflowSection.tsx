import { workflow } from '../content';

export function WorkflowSection() {
  return (
    <section id="how-it-works" className="border-b border-slate-200 bg-[#f8fafc] px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[360px_1fr] lg:items-start">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1d4ed8]">How it works</span>
            <h2 className="mt-2 text-3xl font-black leading-tight text-[#0f172a] sm:text-4xl">
              The job record moves forward, not sideways.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              XDrive is designed around a transport lifecycle that keeps commercial, operational and delivery records attached to one job.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.6)]">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
              {workflow.map(({ title, detail, icon: Icon }, index) => (
                <article key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#1d4ed8] ring-1 ring-slate-200">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-black text-slate-300">{String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-[#0f172a]">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{detail}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
