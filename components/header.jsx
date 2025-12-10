import Link from 'next/link'

export default function Header() {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo / brand */}
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-sm font-semibold tracking-[0.3em] uppercase text-slate-200">
            XDrive
          </span>
          <span className="hidden sm:inline text-xs text-slate-400">
            Logistics · Danny Courier LTD
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-5 text-sm">
          <Link
            href="/"
            className="text-slate-200 hover:text-[#D4AF37] transition-colors"
          >
            Home
          </Link>
          <Link
            href="/services"
            className="text-slate-200 hover:text-[#D4AF37] transition-colors"
          >
            Services
          </Link>
          <Link
            href="/why-us"
            className="text-slate-200 hover:text-[#D4AF37] transition-colors"
          >
            Why us
          </Link>
          <Link
            href="/loads"
            className="text-slate-200 hover:text-[#D4AF37] transition-colors"
          >
            Loads
          </Link>
          <Link
            href="/contact"
            className="text-slate-200 hover:text-[#D4AF37] transition-colors"
          >
            Contact
          </Link>
        </nav>
      </div>
    </header>
  )
}
