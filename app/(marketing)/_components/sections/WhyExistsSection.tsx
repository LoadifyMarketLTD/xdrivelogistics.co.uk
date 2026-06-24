import { whyExistsCards } from '../content';

export function WhyExistsSection() {
  return (
    <section className="border-b border-[#e5e7eb] bg-white px-4 py-8 sm:px-6 sm:py-14" id="resources">
      <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-2 lg:items-start">
        {/* Left: title + body */}
        <div>
          <span className="inline-flex rounded-full border border-[#1d4ed8]/20 bg-[#eff6ff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1d4ed8]">
            Why XDrive Exists
          </span>
          <h2 className="mt-4 text-2xl font-bold text-[#0f172a] sm:text-4xl">
            Built from real UK courier and transport experience
          </h2>
          <p className="mt-4 text-[15px] font-semibold italic text-slate-500">
            XDrive is a functional early-access platform built from real UK courier and transport experience, not a generic software idea.
          </p>
          <p className="mt-4 text-slate-600 leading-7">
            Transport work is often managed across phone calls, WhatsApp messages, spreadsheets, emails, separate POD files and disconnected
            finance records. XDrive brings those daily workflows into one operational workspace, helping transport
            customers, courier companies, owner operators and drivers keep jobs, updates, documents and records connected.
          </p>
        </div>

        {/* Right: 3 trust cards */}
        <div className="hidden flex-col gap-4 md:flex">
          {whyExistsCards.map((card) => (
            <article key={card.title} className="rounded-xl border border-[#e5e7eb] bg-slate-50 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-[#0f172a]">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{card.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
