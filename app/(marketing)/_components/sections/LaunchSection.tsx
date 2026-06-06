import Link from 'next/link';

export function LaunchSection() {
  return (
    <section className="border-b border-slate-200 bg-[#1d4ed8] px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-4xl font-bold text-white sm:text-5xl">Be Part of the XDrive Launch</h2>
        <p className="mt-4 max-w-2xl text-blue-100">
          Join the first wave of transport professionals helping shape the future of UK logistics.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/register" className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-[#1d4ed8] transition hover:bg-blue-50">
            Join Early Access
          </Link>
          <Link href="/request-quote" className="rounded-lg border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
            Request Demo
          </Link>
        </div>
      </div>
    </section>
  );
}
