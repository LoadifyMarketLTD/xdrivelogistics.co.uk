import Link from 'next/link'

export default function Hero() {
  return (
    <section className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-12 md:py-16 grid md:grid-cols-2 gap-10 items-center">
        {/* Text principal */}
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Danny Courier LTD · UK same-day specialists
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl font-semibold leading-tight">
            XDrive Logistics
            <span className="block text-lg md:text-2xl text-[#D4AF37] mt-1">
              Reliable courier & logistics solutions across the UK
            </span>
          </h1>

          <ul className="mt-5 space-y-2 text-sm text-slate-200">
            <li>• Same-day courier and nationwide next-day delivery</li>
            <li>• Luton tail-lift and long-wheel-base vans available</li>
            <li>• Experienced, fully-insured drivers and live job tracking</li>
            <li>• Flexible pricing for ad-hoc work and contract runs</li>
          </ul>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center rounded-full bg-[#D4AF37] px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-yellow-900/40 hover:bg-[#e7c45c] transition-colors"
            >
              Get a Quote
            </Link>

            <Link
              href="/loads"
              className="inline-flex items-center rounded-full border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors"
            >
              View live loads board
            </Link>
          </div>

          <p className="mt-3 text-xs text-slate-400 max-w-md">
            Built to feel familiar for Courier Exchange drivers, dar optimizat
            pentru flota ta: dashboard clar, job details complete și legătură
            directă cu clienții.
          </p>
        </div>

        {/* Card info lateral (static, fără formulare) */}
        <div className="hidden md:block">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_0_40px_rgba(0,0,0,0.6)] space-y-3 text-sm">
            <h2 className="text-sm font-semibold text-slate-50">
              Quick snapshot
            </h2>
