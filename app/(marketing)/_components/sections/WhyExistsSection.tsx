import { ArrowRight, CheckCircle2 } from 'lucide-react';

const points = [
  {
    label: 'The daily problem',
    text: 'Transport work is still split across calls, WhatsApp, spreadsheets, email, POD photos and invoice notes.',
  },
  {
    label: 'The XDrive structure',
    text: 'Every job keeps the request, quote, award, driver updates, documents, POD and finance status connected.',
  },
  {
    label: 'The operating result',
    text: 'Customers submit clearer loads, carriers quote faster, dispatchers plan sooner and drivers execute with fewer gaps.',
  },
] as const;

const checks = ['UK postcode-first workflows', 'Load posting with quote context', 'Operational records tied to delivery evidence', 'Role-specific workspaces'];

export function WhyExistsSection() {
  return (
    <section className="border-b border-[#0B2F6B]/15 bg-[#F4F6F8] px-4 py-14 sm:px-6" id="resources">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <span className="inline-flex rounded-full border border-[#1D57D8]/20 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1D57D8]">
            Built for real transport work
          </span>
          <h2 className="mt-4 max-w-2xl text-3xl font-black leading-tight text-[#1A1F2B] sm:text-4xl">
            Not another generic dashboard. A working layer for UK logistics execution.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#0B2F6B]">
            XDrive is shaped around the information carriers, customers and drivers need before a job can be priced, planned and completed without extra phone calls.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {checks.map((check) => (
              <span key={check} className="flex items-center gap-2 text-sm font-semibold text-[#1A1F2B]">
                <CheckCircle2 className="h-4 w-4 text-[#1D57D8]" />
                {check}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#0B2F6B]/15 bg-white p-4 shadow-[0_18px_48px_-36px_rgba(26, 31, 43, 0.55)]">
          <div className="grid gap-3">
            {points.map((point, index) => (
              <article key={point.label} className="grid gap-4 rounded-xl border border-[#0B2F6B]/15 bg-[#F4F6F8] p-5 sm:grid-cols-[180px_1fr] sm:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#1D57D8]">0{index + 1}</p>
                  <h3 className="mt-1 text-base font-semibold text-[#1A1F2B]">{point.label}</h3>
                </div>
                <p className="text-sm leading-6 text-[#0B2F6B]">{point.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#1A1F2B] px-5 py-4 text-sm font-semibold text-white">
            One job record from request to invoice visibility
            <ArrowRight className="h-4 w-4 text-[#F5A300]" />
          </div>
        </div>
      </div>
    </section>
  );
}
