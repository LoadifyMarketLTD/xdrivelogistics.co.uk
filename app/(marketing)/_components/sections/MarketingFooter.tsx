export function MarketingFooter() {
  return (
    <footer id="contact" className="bg-slate-900 px-4 py-16 sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Platform</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-400">
            <li>Marketplace</li>
            <li>Operations</li>
            <li>Fleet</li>
            <li>Drivers</li>
            <li>Finance</li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Solutions</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-400">
            <li>Owner Operators</li>
            <li>Courier Companies</li>
            <li>Load Posters</li>
            <li>Customers</li>
            <li>Drivers</li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Company</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-400">
            <li>About</li>
            <li>Launch</li>
            <li>Contact</li>
            <li>Careers</li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Legal</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-400">
            <li>Privacy</li>
            <li>Terms</li>
            <li>Cookies</li>
            <li>GDPR</li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-12 flex max-w-7xl flex-col gap-2 border-t border-slate-700 pt-6 text-xs text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <span>XDrive Logistics Ltd</span>
        <span>Company No. 13171804</span>
        <span>Founded 1 February 2021</span>
        <span>© 2026 XDrive Logistics Ltd</span>
        <span>All Rights Reserved</span>
      </div>
    </footer>
  );
}
