// app/layout.jsx
import './globals.css'

export const metadata = {
  title: 'XDrive Logistics — Danny Courier LTD',
  description:
    'XDrive Logistics — smart courier exchange for UK drivers and shippers, powered by Danny Courier LTD.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <div className="flex flex-col min-h-screen">
          <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-30">
            <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
              <a href="/" className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-900 font-black text-lg">
                  X
                </div>
                <div className="leading-tight">
                  <div className="font-semibold tracking-tight">
                    XDrive Logistics
                  </div>
                  <div className="text-xs text-slate-400">
                    by Danny Courier LTD
                  </div>
                </div>
              </a>
              <nav className="hidden md:flex items-center gap-6 text-sm">
                <a href="#how" className="hover:text-amber-400">
                  How it works
                </a>
                <a href="#drivers" className="hover:text-amber-400">
                  For drivers
                </a>
                <a href="#shippers" className="hover:text-amber-400">
                  For customers
                </a>
                <a href="#contact" className="hover:text-amber-400">
                  Contact
                </a>
              </nav>
              <a
                href="#contact"
                className="hidden sm:inline-flex items-center rounded-full border border-amber-500/70 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500 hover:text-slate-950 transition"
              >
                Get a quote
              </a>
            </div>
          </header>

          <main className="flex-1">
            {children}
          </main>

          <footer className="border-t border-slate-800 bg-slate-950/90 mt-10">
            <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
              <div>
                © {new Date().getFullYear()} XDrive Logistics · Danny Courier
                LTD · 101 Cornelian Street, Blackburn, BB1 9QL, UK
              </div>
              <div className="flex gap-4">
                <a href="mailto:info@xdrivelogistics.co.uk" className="hover:text-amber-400">
                  info@xdrivelogistics.co.uk
                </a>
                <span>+44 7323 272138</span>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
