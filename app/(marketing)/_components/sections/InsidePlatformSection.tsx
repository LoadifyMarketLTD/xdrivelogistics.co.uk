import { platformModules } from '../content';

export function InsidePlatformSection() {
  return (
    <section className="border-b border-[#e5e7eb] bg-slate-50 px-4 py-12 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-[1200px]">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-[#1d4ed8]/20 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1d4ed8]">
            Inside the XDrive Platform
          </span>
          <h2 className="mt-4 text-3xl font-bold text-[#0f172a] sm:text-4xl">A clearer view of the XDrive workflows</h2>
          <p className="mt-4 text-slate-600">
            Expand each area to see what the module is for, who it supports, the problem it solves and the current early-access status.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {platformModules.map((module, index) => {
            const Icon = module.icon;

            return (
              <details
                key={module.key}
                open={index === 0}
                className="group rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.5)]"
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      {module.status}
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="rounded-xl border border-[#dbeafe] bg-[#eff6ff] p-2 text-[#1d4ed8]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-lg font-semibold text-[#0f172a]">{module.title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{module.summary}</p>
                  </div>
                  <span className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>

                <div className="mt-5 grid gap-4 border-t border-slate-200 pt-5 md:grid-cols-3">
                  <article className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Who it is for</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{module.audience}</p>
                  </article>
                  <article className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Problem it solves</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{module.problem}</p>
                  </article>
                  <article className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">What users will be able to do</p>
                    <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
                      {module.actions.map((action) => (
                        <li key={action}>• {action}</li>
                      ))}
                    </ul>
                  </article>
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}
