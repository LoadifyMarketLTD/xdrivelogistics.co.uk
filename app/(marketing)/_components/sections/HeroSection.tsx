import Link from 'next/link';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-[#0B2F6B]/15 bg-[#1A1F2B]" id="platform">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/xdrive-login-hero.webp.jpeg')" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-[rgba(26, 31, 43, 0.93)]" />
      <div className="relative mx-auto flex min-h-[calc(100svh-150px)] w-full max-w-7xl items-center px-4 py-12 sm:min-h-[calc(100svh-140px)] sm:px-6 lg:min-h-[calc(100vh-160px)] lg:py-16">
        <div className="max-w-3xl">
          <span className="inline-flex rounded-full border border-[#F5A300]/40 bg-[#F5A300]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#F5A300]">
            UK Logistics Operating Platform
          </span>
          <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[1.02] text-white sm:mt-6 sm:text-5xl lg:text-6xl">
            Post loads, quote work, dispatch drivers and close PODs from one workspace.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#F4F6F8] sm:mt-6 sm:text-lg sm:leading-8">
            XDrive connects customers, brokers, fleet operators, owner operators and drivers around the full job lifecycle: request, quote,
            award, assign, deliver, POD and invoice visibility.
          </p>

          <div className="mt-7 flex flex-wrap gap-3 sm:mt-8">
            <Link href="/register" className="rounded-lg bg-[#F5A300] px-6 py-3 text-sm font-semibold text-[#1A1F2B] transition hover:bg-[#F5A300]">
              Join Early Access
            </Link>
            <Link href="/request-quote" className="rounded-lg border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20">
              Request a Quote
            </Link>
          </div>
          <div className="mt-8 hidden max-w-2xl grid-cols-2 gap-3 text-white md:grid md:grid-cols-4">
            <div className="rounded-lg border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
              <p className="text-2xl font-black">2021</p>
              <p className="text-xs uppercase tracking-[0.12em] text-[#F4F6F8]">Founded</p>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
              <p className="text-2xl font-black">MVP</p>
              <p className="text-xs uppercase tracking-[0.12em] text-[#F4F6F8]">Stage</p>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
              <p className="text-2xl font-black">UK</p>
              <p className="text-xs uppercase tracking-[0.12em] text-[#F4F6F8]">Coverage</p>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
              <p className="text-2xl font-black">0 GBP</p>
              <p className="text-xs uppercase tracking-[0.12em] text-[#F4F6F8]">Early Access</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
