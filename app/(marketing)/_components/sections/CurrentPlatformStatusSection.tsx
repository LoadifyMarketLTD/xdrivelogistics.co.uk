import { statusHighlights } from '../content';

export function CurrentPlatformStatusSection() {
  return (
    <section className="border-b border-[#F4F6F8] bg-[#F4F6F8] px-4 py-12 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-[1200px]">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-[#1D57D8]/20 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1D57D8]">
            Current Platform Status
          </span>
          <h2 className="mt-4 text-3xl font-bold text-[#1A1F2B] sm:text-4xl">Transparent about where XDrive is today</h2>
          <p className="mt-4 text-[#0B2F6B]">
            XDrive is functional for approved early-access users across supported logistics roles, while public marketplace volume and wider
            partner network activity continue to grow in a controlled way.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statusHighlights.map((item) => (
            <article key={item.title} className="rounded-2xl border border-[#F4F6F8] bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#1D57D8]">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#0B2F6B]">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
