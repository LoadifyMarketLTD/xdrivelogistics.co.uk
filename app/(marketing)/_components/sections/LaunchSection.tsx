import Link from 'next/link';

export function LaunchSection() {
  return (
    <section className="border-b border-[#e5e7eb] bg-[#1d4ed8] px-4 py-12 sm:px-6 sm:py-20" id="launch">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="text-4xl font-bold text-white sm:text-5xl">Be Part of the XDrive Early Access Launch</h2>
        <p className="mt-4 max-w-2xl text-blue-100">
          We are inviting selected UK transport customers, courier companies, owner operators and drivers to test the platform before wider
          release.
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
