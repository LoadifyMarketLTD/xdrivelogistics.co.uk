import Image from 'next/image';
import Link from 'next/link';

export function LaunchSection() {
  return (
    <section className="relative overflow-hidden border-b border-[#e5e7eb]" id="launch">
      {/* Launch background photography */}
      <Image
        src="/finance-admin-office.webp"
        alt=""
        fill
        className="object-cover object-center"
        aria-hidden="true"
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-[#0f172a]/70" />

      <div className="relative px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Be Part of the XDrive Early Access Launch</h2>
            <p className="mt-4 text-blue-100">
              We are inviting selected UK transport customers, courier companies, owner operators and drivers to test the platform before
              wider release.
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-[#1d4ed8] transition hover:bg-blue-50"
            >
              Join Early Access
            </Link>
            <Link
              href="/request-quote"
              className="rounded-lg border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Request Demo
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
