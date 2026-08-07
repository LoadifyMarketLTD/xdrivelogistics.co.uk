import { roadmapItems, type RoadmapStatus } from '../content';

const statusStyles: Record<RoadmapStatus, string> = {
  'In Progress': 'border-[#f5c542]/40 bg-[#f5c542]/10 text-[#b45309]',
  'Coming Soon': 'border-[#1d4ed8]/20 bg-[#1d4ed8]/10 text-[#1d4ed8]',
  Planned: 'border-slate-300/60 bg-slate-100 text-slate-500',
};

export function WhatsNextSection() {
  return (
    <section className="border-b border-[#D7E6FA] bg-[#F7FAFF] px-4 py-14 sm:px-6 sm:py-16" id="whats-next">
      <div className="mx-auto max-w-[1200px]">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-[#FDB913]/40 bg-[#FDB913]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#b45309]">
            What&apos;s Next
          </span>
          <h2 className="mt-4 text-3xl font-black leading-tight text-[#002B6C] sm:text-4xl">
            Where XDrive is headed
          </h2>
          <p className="mt-4 text-sm leading-6 text-[#49607F]">
            A transparent view of the platform development roadmap — from the features being actively built to the modules planned for later phases.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {roadmapItems.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="flex flex-col rounded-2xl border border-[#D7E6FA] bg-white p-6 shadow-[0_12px_30px_rgba(0,43,108,0.06)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#002B6C]/5">
                    <Icon className="h-5 w-5 text-[#002B6C]" />
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${statusStyles[item.status]}`}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FDB913]">
                  {item.phase}
                </p>
                <h3 className="mt-1 text-base font-black text-[#002B6C]">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#49607F]">{item.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
